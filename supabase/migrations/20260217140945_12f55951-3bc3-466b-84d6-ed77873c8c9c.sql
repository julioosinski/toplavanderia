
-- Add registration_status column to esp32_status
ALTER TABLE public.esp32_status ADD COLUMN IF NOT EXISTS registration_status TEXT DEFAULT 'approved';
-- Values: 'pending', 'approved', 'rejected'

-- Add device_name column for friendly name from BLE
ALTER TABLE public.esp32_status ADD COLUMN IF NOT EXISTS device_name TEXT;
