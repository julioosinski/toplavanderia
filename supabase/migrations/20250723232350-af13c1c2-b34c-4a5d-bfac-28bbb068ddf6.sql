-- Adicionar campo esp32_id nas máquinas para vincular cada máquina a um ESP32 específico
ALTER TABLE public.machines 
ADD COLUMN esp32_id text DEFAULT 'main',
ADD COLUMN relay_pin integer DEFAULT 1;

-- Adicionar comentário para documentar o uso
COMMENT ON COLUMN public.machines.esp32_id IS 'ID do ESP32 responsável por esta máquina';
COMMENT ON COLUMN public.machines.relay_pin IS 'Pino do relé no ESP32 para esta máquina';

-- Atualizar configurações do sistema para suportar múltiplos ESP32s
ALTER TABLE public.system_settings
ADD COLUMN esp32_configurations jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.system_settings.esp32_configurations IS 'Configurações de múltiplos ESP32s em formato JSON';

-- Inserir configurações padrão para múltiplos ESP32s
UPDATE public.system_settings 
SET esp32_configurations = '[
  {
    "id": "main",
    "name": "ESP32 Principal",
    "host": "192.168.1.100",
    "port": 80,
    "location": "Conjunto A",
    "machines": ["lavadora_01", "secadora_01"]
  },
  {
    "id": "secondary",
    "name": "ESP32 Secundário",
    "host": "192.168.1.101", 
    "port": 80,
    "location": "Conjunto B",
    "machines": ["lavadora_02", "secadora_02"]
  }
]'::jsonb
WHERE id IS NOT NULL;

-- Atualizar máquinas existentes para usar ESP32s específicos
UPDATE public.machines 
SET esp32_id = CASE 
  WHEN name LIKE '%01' THEN 'main'
  WHEN name LIKE '%02' THEN 'secondary'
  ELSE 'main'
END,
relay_pin = CASE 
  WHEN type = 'washer' THEN 1
  WHEN type = 'dryer' THEN 2
  ELSE 1
END;

-- Atualizar tabela esp32_status para melhor suporte a múltiplos dispositivos
ALTER TABLE public.esp32_status
ADD COLUMN location text,
ADD COLUMN machine_count integer DEFAULT 0,
ADD COLUMN relay_status jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.esp32_status.location IS 'Localização física do ESP32';
COMMENT ON COLUMN public.esp32_status.machine_count IS 'Número de máquinas conectadas ao ESP32';
COMMENT ON COLUMN public.esp32_status.relay_status IS 'Status dos relés em formato JSON';

-- Inserir dados padrão para os ESP32s
INSERT INTO public.esp32_status (esp32_id, location, machine_count, is_online, network_status)
VALUES 
  ('main', 'Conjunto A', 2, false, 'unknown'),
  ('secondary', 'Conjunto B', 2, false, 'unknown')
ON CONFLICT (esp32_id) DO UPDATE SET
  location = EXCLUDED.location,
  machine_count = EXCLUDED.machine_count,
  updated_at = now();