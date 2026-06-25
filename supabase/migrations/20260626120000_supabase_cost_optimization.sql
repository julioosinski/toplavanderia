-- Otimização de armazenamento e carga Supabase
-- 1) Corrige cleanup pending_commands (status real = completed, não executed)
-- 2) Purge histórico imediato + jobs OTA antigos
-- 3) Marca ESP offline via cron (não a cada heartbeat na edge)

-- ---------------------------------------------------------------------------
-- pending_commands: status corrigido + backfill
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_pending_commands()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.pending_commands
  WHERE status IN ('completed', 'failed', 'cancelled')
    AND created_at < now() - INTERVAL '24 hours';

  -- Comandos presos em processing há mais de 6h
  DELETE FROM public.pending_commands
  WHERE status = 'processing'
    AND created_at < now() - INTERVAL '6 hours';
END;
$$;

-- Backfill: linhas que nunca eram apagadas (bug executed vs completed)
DELETE FROM public.pending_commands
WHERE status IN ('completed', 'failed', 'cancelled')
  AND created_at < now() - INTERVAL '24 hours';

-- ---------------------------------------------------------------------------
-- esp32_ota_jobs: purge jobs terminalizados (>90 dias)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_esp32_ota_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.esp32_ota_jobs
  WHERE status IN ('completed', 'failed', 'cancelled')
    AND created_at < now() - INTERVAL '90 days';
END;
$$;

DELETE FROM public.esp32_ota_jobs
WHERE status IN ('completed', 'failed', 'cancelled')
  AND created_at < now() - INTERVAL '90 days';

-- ---------------------------------------------------------------------------
-- esp32_status: offline stale — cron a cada 2 min (substitui scan global no heartbeat)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_stale_esp32_offline()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.esp32_status
  SET is_online = false, updated_at = now()
  WHERE is_online = true
    AND (
      last_heartbeat IS NULL
      OR last_heartbeat < now() - INTERVAL '3 minutes'
    );
END;
$$;

DO $$
DECLARE
  jid bigint;
BEGIN
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname IN (
    'cleanup-esp32-ota-jobs-weekly',
    'mark-stale-esp32-offline'
  ) LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'cleanup-esp32-ota-jobs-weekly',
  '0 4 * * 0',
  $$ SELECT public.cleanup_esp32_ota_jobs(); $$
);

SELECT cron.schedule(
  'mark-stale-esp32-offline',
  '*/2 * * * *',
  $$ SELECT public.mark_stale_esp32_offline(); $$
);
