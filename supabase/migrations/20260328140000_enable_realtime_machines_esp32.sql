-- Realtime: totem (anon) precisa receber eventos de UPDATE em machines/esp32_status
-- quando o painel admin altera preço, ciclo ou status. Sem isto, só atualiza ao reabrir o app.
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'machines'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.machines;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'esp32_status'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.esp32_status;
  END IF;
END $migration$;
