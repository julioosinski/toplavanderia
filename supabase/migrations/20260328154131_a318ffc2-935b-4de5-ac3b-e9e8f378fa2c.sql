-- Adicionar coluna paygo_provedor à tabela system_settings
-- Valores típicos: GETNET, CIELO, REDECARD, STONE, etc. (enum da SDK PayGO)
-- Quando NULL/vazio, o pinpad escolhe a rede automaticamente (sem multi-adquirência forçada)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'system_settings'
      AND column_name = 'paygo_provedor'
  ) THEN
    ALTER TABLE public.system_settings ADD COLUMN paygo_provedor text DEFAULT NULL;
  END IF;
END $$;