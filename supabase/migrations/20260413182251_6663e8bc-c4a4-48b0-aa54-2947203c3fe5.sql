
-- Recreate public_machines view with additional operational fields needed by Totem
CREATE OR REPLACE VIEW public.public_machines AS
SELECT id, name, type, status, price_per_cycle, capacity_kg,
       cycle_time_minutes, location, esp32_id, temperature,
       last_maintenance, relay_pin, updated_at, laundry_id
FROM public.machines;

-- Ensure anon can read it
GRANT SELECT ON public.public_machines TO anon;
