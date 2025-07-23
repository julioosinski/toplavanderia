-- Criar tabela para monitoramento do status do ESP32
CREATE TABLE public.esp32_status (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  esp32_id text NOT NULL,
  ip_address text,
  signal_strength integer,
  network_status text DEFAULT 'unknown',
  last_heartbeat timestamp with time zone,
  firmware_version text,
  uptime_seconds integer DEFAULT 0,
  is_online boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(esp32_id)
);

-- Habilitar RLS
ALTER TABLE public.esp32_status ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - apenas admins podem ver e modificar status do ESP32
CREATE POLICY "Only admins can view esp32 status" 
ON public.esp32_status 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'admin'
));

CREATE POLICY "Only admins can modify esp32 status" 
ON public.esp32_status 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'admin'
));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_esp32_status_updated_at
BEFORE UPDATE ON public.esp32_status
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar campos de monitoramento nas configurações do sistema
ALTER TABLE public.system_settings 
ADD COLUMN heartbeat_interval_seconds integer DEFAULT 30,
ADD COLUMN max_offline_duration_minutes integer DEFAULT 5,
ADD COLUMN signal_threshold_warning integer DEFAULT -70,
ADD COLUMN enable_esp32_monitoring boolean DEFAULT true;