
ALTER TABLE public.machines RENAME COLUMN price_per_kg TO price_per_cycle;

-- Recriar views que referenciam a coluna renomeada
DROP VIEW IF EXISTS machine_status_view;
CREATE VIEW machine_status_view WITH (security_invoker = on) AS
SELECT m.id,
    m.name,
    m.type,
    m.esp32_id,
    m.relay_pin,
    m.laundry_id,
    m.price_per_cycle,
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
SELECT id, name, type, status, price_per_cycle, capacity_kg, cycle_time_minutes,
       location, esp32_id, temperature, last_maintenance
FROM machines;
