
-- Enable Realtime for machines and esp32_status tables
DO $$
BEGIN
  -- Add machines to supabase_realtime if not already present
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'machines'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.machines;
  END IF;

  -- Add esp32_status to supabase_realtime if not already present
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'esp32_status'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.esp32_status;
  END IF;
END $$;
