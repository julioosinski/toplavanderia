-- Fase 1: Limpeza do Banco de Dados
-- Excluir máquinas duplicadas da "Lavanderia Principal" (567a7bb6-8d26-4d9c-bbe3-f8dcc28e7569)
-- Mantém apenas as máquinas da "TOP LAVANDERIA SINUELO" (8ace0bcb-83a9-4555-a712-63ef5f52e709)
DELETE FROM public.machines 
WHERE laundry_id = '567a7bb6-8d26-4d9c-bbe3-f8dcc28e7569';

-- Limpar ESP32s offline há muito tempo (mais de 30 dias)
DELETE FROM public.esp32_status 
WHERE is_online = false 
  AND last_heartbeat < NOW() - INTERVAL '30 days';

-- Fase 2: Correção da Tabela esp32_status
-- Remover coluna location (desnecessária)
ALTER TABLE public.esp32_status DROP COLUMN IF EXISTS location;

-- Adicionar constraint para laundry_id não nulo
ALTER TABLE public.esp32_status 
ALTER COLUMN laundry_id SET NOT NULL;

-- Criar índice composto único correto (se ainda não existir)
CREATE UNIQUE INDEX IF NOT EXISTS esp32_status_esp32_laundry_idx 
ON public.esp32_status(esp32_id, laundry_id);

-- Adicionar constraint check para relay_status ser JSONB válido
ALTER TABLE public.esp32_status 
ADD CONSTRAINT relay_status_valid CHECK (
  relay_status IS NULL OR jsonb_typeof(relay_status) = 'object'
);

-- Normalizar relay_status existentes para formato consistente
UPDATE public.esp32_status 
SET relay_status = jsonb_build_object('status', 'off')
WHERE relay_status = '{}'::jsonb OR relay_status IS NULL;

-- Criar função para validar configuração de máquina
CREATE OR REPLACE FUNCTION validate_machine_config()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se já existe outra máquina usando o mesmo ESP32 + relay_pin
  IF EXISTS (
    SELECT 1 FROM public.machines 
    WHERE esp32_id = NEW.esp32_id 
      AND relay_pin = NEW.relay_pin 
      AND laundry_id = NEW.laundry_id
      AND id != NEW.id
  ) THEN
    RAISE EXCEPTION 'Já existe uma máquina usando ESP32 % com relay % nesta lavanderia', 
      NEW.esp32_id, NEW.relay_pin;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para validar configuração antes de inserir/atualizar
DROP TRIGGER IF EXISTS validate_machine_config_trigger ON public.machines;
CREATE TRIGGER validate_machine_config_trigger
  BEFORE INSERT OR UPDATE ON public.machines
  FOR EACH ROW
  EXECUTE FUNCTION validate_machine_config();