-- Remove a constraint antiga que está causando conflito
ALTER TABLE public.esp32_status 
DROP CONSTRAINT IF EXISTS esp32_status_esp32_id_key;

-- Garantir que a constraint correta existe
ALTER TABLE public.esp32_status 
DROP CONSTRAINT IF EXISTS esp32_status_esp32_id_laundry_id_key;

ALTER TABLE public.esp32_status 
ADD CONSTRAINT esp32_status_esp32_id_laundry_id_key 
UNIQUE (esp32_id, laundry_id);