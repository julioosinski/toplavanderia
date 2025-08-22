-- Add NFSe integration fields to system_settings table
ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS zapier_webhook_url TEXT,
ADD COLUMN IF NOT EXISTS nfse_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS company_cnpj TEXT,
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS company_email TEXT;