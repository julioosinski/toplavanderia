ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS cielo_client_id text DEFAULT NULL;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS cielo_access_token text DEFAULT NULL;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS cielo_merchant_code text DEFAULT NULL;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS cielo_environment text DEFAULT 'sandbox';