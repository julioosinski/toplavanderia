-- Corrigir Security Definer View
DROP VIEW IF EXISTS public.public_machines;

CREATE VIEW public.public_machines 
WITH (security_invoker=true) AS
SELECT 
  id, name, type, status, price_per_kg, capacity_kg,
  cycle_time_minutes, location, esp32_id, temperature, last_maintenance
FROM public.machines;

GRANT SELECT ON public.public_machines TO anon, authenticated;