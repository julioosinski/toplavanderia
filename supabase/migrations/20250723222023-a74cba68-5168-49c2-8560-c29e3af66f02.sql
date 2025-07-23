-- Adicionar tabela para configurações de rede e sistema
CREATE TABLE public.system_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wifi_ssid text,
  wifi_password text,
  esp32_host text,
  esp32_port integer DEFAULT 80,
  tef_terminal_id text,
  tef_config text,
  default_cycle_time integer DEFAULT 40,
  default_price numeric DEFAULT 5.00,
  auto_mode boolean DEFAULT false,
  notifications_enabled boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - apenas admins podem ver e modificar configurações
CREATE POLICY "Only admins can view system settings" 
ON public.system_settings 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'admin'
));

CREATE POLICY "Only admins can modify system settings" 
ON public.system_settings 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'admin'
));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar campos para ciclo de tempo nas máquinas
ALTER TABLE public.machines 
ADD COLUMN cycle_time_minutes integer DEFAULT 40;

-- Inserir configurações padrão
INSERT INTO public.system_settings (id) VALUES (gen_random_uuid());