-- Add unique constraint to esp32_status table for proper upsert handling
ALTER TABLE public.esp32_status 
ADD CONSTRAINT esp32_status_esp32_id_laundry_id_key 
UNIQUE (esp32_id, laundry_id);