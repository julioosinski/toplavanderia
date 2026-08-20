-- Credenciais Stone POS em system_settings (configuração admin; SDK Android na fase B).

ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS stone_code text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stone_app_key text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stone_environment text DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS stone_device_serial text DEFAULT NULL;

COMMENT ON COLUMN public.system_settings.stone_code IS
  'Stone Code do estabelecimento (parceiro Stone)';
COMMENT ON COLUMN public.system_settings.stone_app_key IS
  'AppKey / chave de aplicação Stone';
COMMENT ON COLUMN public.system_settings.stone_environment IS
  'sandbox | production';
COMMENT ON COLUMN public.system_settings.stone_device_serial IS
  'Serial opcional do terminal POS Stone vinculado ao totem';
