-- Migração: Separação de Configurações por Lavanderia
-- Objetivo: Garantir que cada lavanderia tenha suas próprias configurações

-- 1. Popular laundry_id nos registros existentes (usar a primeira lavanderia ativa)
DO $$
DECLARE
  first_laundry_id UUID;
BEGIN
  -- Buscar a primeira lavanderia ativa
  SELECT id INTO first_laundry_id 
  FROM public.laundries 
  WHERE is_active = true 
  ORDER BY created_at ASC 
  LIMIT 1;

  -- Atualizar registros sem laundry_id
  IF first_laundry_id IS NOT NULL THEN
    UPDATE public.system_settings
    SET laundry_id = first_laundry_id
    WHERE laundry_id IS NULL;
  END IF;
END $$;

-- 2. Adicionar constraint NOT NULL no laundry_id
ALTER TABLE public.system_settings 
ALTER COLUMN laundry_id SET NOT NULL;

-- 3. Adicionar constraint UNIQUE para garantir uma configuração por lavanderia
ALTER TABLE public.system_settings
ADD CONSTRAINT system_settings_laundry_id_unique UNIQUE (laundry_id);

-- 4. Criar função para gerar configurações padrão
CREATE OR REPLACE FUNCTION public.create_default_system_settings(_laundry_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  settings_id UUID;
BEGIN
  -- Verificar se já existe configuração para esta lavanderia
  SELECT id INTO settings_id
  FROM public.system_settings
  WHERE laundry_id = _laundry_id;

  -- Se não existe, criar uma nova
  IF settings_id IS NULL THEN
    INSERT INTO public.system_settings (
      laundry_id,
      esp32_port,
      default_cycle_time,
      default_price,
      auto_mode,
      notifications_enabled,
      heartbeat_interval_seconds,
      max_offline_duration_minutes,
      signal_threshold_warning,
      enable_esp32_monitoring,
      paygo_enabled,
      paygo_port,
      paygo_timeout,
      paygo_retry_attempts,
      paygo_retry_delay,
      nfse_enabled
    ) VALUES (
      _laundry_id,
      80,
      40,
      5.00,
      false,
      true,
      30,
      5,
      -70,
      true,
      false,
      8080,
      30000,
      3,
      2000,
      false
    )
    RETURNING id INTO settings_id;
  END IF;

  RETURN settings_id;
END;
$$;

-- 5. Criar trigger para criar configurações ao inserir nova lavanderia
CREATE OR REPLACE FUNCTION public.create_settings_for_new_laundry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Criar configurações padrão para a nova lavanderia
  PERFORM public.create_default_system_settings(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_create_settings_for_new_laundry ON public.laundries;

CREATE TRIGGER trigger_create_settings_for_new_laundry
AFTER INSERT ON public.laundries
FOR EACH ROW
EXECUTE FUNCTION public.create_settings_for_new_laundry();

-- 6. Criar configurações para lavanderias que não têm
INSERT INTO public.system_settings (
  laundry_id,
  esp32_port,
  default_cycle_time,
  default_price,
  auto_mode,
  notifications_enabled,
  heartbeat_interval_seconds,
  max_offline_duration_minutes,
  signal_threshold_warning,
  enable_esp32_monitoring,
  paygo_enabled,
  paygo_port,
  paygo_timeout,
  paygo_retry_attempts,
  paygo_retry_delay,
  nfse_enabled
)
SELECT 
  l.id,
  80,
  40,
  5.00,
  false,
  true,
  30,
  5,
  -70,
  true,
  false,
  8080,
  30000,
  3,
  2000,
  false
FROM public.laundries l
LEFT JOIN public.system_settings ss ON ss.laundry_id = l.id
WHERE ss.id IS NULL;
