-- Add PayGO configuration fields to system_settings table
ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS paygo_host text,
ADD COLUMN IF NOT EXISTS paygo_port integer DEFAULT 8080,
ADD COLUMN IF NOT EXISTS paygo_automation_key text,
ADD COLUMN IF NOT EXISTS paygo_cnpj_cpf text,
ADD COLUMN IF NOT EXISTS paygo_timeout integer DEFAULT 30000,
ADD COLUMN IF NOT EXISTS paygo_retry_attempts integer DEFAULT 3,
ADD COLUMN IF NOT EXISTS paygo_retry_delay integer DEFAULT 2000,
ADD COLUMN IF NOT EXISTS paygo_enabled boolean DEFAULT false;