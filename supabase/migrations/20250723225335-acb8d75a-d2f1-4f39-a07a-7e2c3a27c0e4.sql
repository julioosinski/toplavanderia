-- Atualizar configurações padrão do sistema com um host ESP32 de teste
UPDATE public.system_settings 
SET 
  esp32_host = '192.168.1.100',
  esp32_port = 80,
  updated_at = now()
WHERE id IS NOT NULL;