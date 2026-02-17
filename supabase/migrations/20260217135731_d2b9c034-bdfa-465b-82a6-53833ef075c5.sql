
-- 1. Limpar dados fantasma da lavanderia errada
DELETE FROM esp32_status WHERE laundry_id = '567a7bb6-8d26-4d9c-bbe3-f8dcc28e7569';

-- 2. Marcar ESP32s desatualizados como offline
UPDATE esp32_status SET is_online = false, network_status = 'timeout'
WHERE last_heartbeat < NOW() - INTERVAL '10 minutes';

-- 3. Corrigir RLS esp32_status - remover acesso público total
DROP POLICY IF EXISTS "esp32_full_access" ON esp32_status;

-- ESP32 heartbeat edge functions usam service_role, então não precisam de policy
-- Usuários autenticados podem ler (para o painel admin)
CREATE POLICY "esp32_select_authenticated" ON esp32_status
  FOR SELECT USING (auth.role() = 'authenticated');

-- Permitir INSERT/UPDATE para anon (ESP32 heartbeat via API REST) 
-- mas restrito por laundry_id existente
CREATE POLICY "esp32_upsert_public" ON esp32_status
  FOR INSERT WITH CHECK (true);

CREATE POLICY "esp32_update_public" ON esp32_status
  FOR UPDATE USING (true);

-- 4. Corrigir RLS pending_commands - remover acesso público total
DROP POLICY IF EXISTS "System can manage pending commands" ON pending_commands;

CREATE POLICY "pending_commands_insert_authenticated" ON pending_commands
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "pending_commands_update_authenticated" ON pending_commands
  FOR UPDATE USING (auth.role() = 'authenticated');

-- 5. Corrigir views para usar security_invoker
DROP VIEW IF EXISTS machine_status_view;
CREATE VIEW machine_status_view WITH (security_invoker = on) AS
SELECT m.id,
    m.name,
    m.type,
    m.esp32_id,
    m.relay_pin,
    m.laundry_id,
    m.price_per_kg,
    m.cycle_time_minutes,
    m.location,
    m.capacity_kg,
    e.is_online,
    e.ip_address,
    e.signal_strength,
    e.relay_status,
    e.last_heartbeat,
    CASE
        WHEN ((e.is_online = false) OR (e.last_heartbeat < (now() - '00:05:00'::interval))) THEN 'offline'::text
        WHEN ((e.relay_status ->> ('relay_'::text || (m.relay_pin)::text)) = 'on'::text) THEN 'running'::text
        WHEN ((e.relay_status ->> ('relay_'::text || (m.relay_pin)::text)) = 'off'::text) THEN 'available'::text
        ELSE COALESCE(m.status, 'offline'::text)
    END AS computed_status
FROM machines m
LEFT JOIN esp32_status e ON ((m.esp32_id = e.esp32_id) AND (m.laundry_id = e.laundry_id));

DROP VIEW IF EXISTS public_machines;
CREATE VIEW public_machines WITH (security_invoker = on) AS
SELECT id, name, type, status, price_per_kg, capacity_kg, cycle_time_minutes, 
       location, esp32_id, temperature, last_maintenance
FROM machines;

-- 6. Criar trigger para atualizar total_revenue e total_uses automaticamente
CREATE OR REPLACE FUNCTION public.update_machine_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Quando transação é completada, atualizar stats da máquina
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
    UPDATE machines
    SET total_revenue = COALESCE(total_revenue, 0) + NEW.total_amount,
        total_uses = COALESCE(total_uses, 0) + 1,
        updated_at = now()
    WHERE id = NEW.machine_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_machine_stats_on_transaction
AFTER INSERT OR UPDATE ON transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_machine_stats();
