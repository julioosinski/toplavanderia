
-- Habilita extensões necessárias para agendamento
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Função: limpa pending_commands já executados/falhos há mais de 24h
CREATE OR REPLACE FUNCTION public.cleanup_pending_commands()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.pending_commands
  WHERE status IN ('executed', 'failed', 'cancelled')
    AND created_at < now() - INTERVAL '24 hours';
END;
$$;

-- Função: cancela transações 'pending' antigas (>1 dia) que nunca foram concluídas
CREATE OR REPLACE FUNCTION public.cleanup_stale_pending_transactions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.transactions
  SET status = 'cancelled', updated_at = now()
  WHERE status = 'pending'
    AND created_at < now() - INTERVAL '1 day';
END;
$$;

-- Função: remove ESP32s órfãos (sem heartbeat há mais de 30 dias e sem máquina ativa)
CREATE OR REPLACE FUNCTION public.cleanup_orphan_esp32_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.esp32_status e
  WHERE (e.last_heartbeat IS NULL OR e.last_heartbeat < now() - INTERVAL '30 days')
    AND NOT EXISTS (
      SELECT 1 FROM public.machines m WHERE m.esp32_id = e.esp32_id
    );
END;
$$;

-- Agendamentos (idempotente: remove jobs prévios com mesmo nome antes de criar)
DO $$
DECLARE
  jid bigint;
BEGIN
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname IN (
    'cleanup-audit-logs-daily',
    'cleanup-pending-commands-hourly',
    'cleanup-stale-transactions-daily',
    'cleanup-orphan-esp32-weekly'
  ) LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'cleanup-audit-logs-daily',
  '15 3 * * *',
  $$ SELECT public.cleanup_old_logs(); $$
);

SELECT cron.schedule(
  'cleanup-pending-commands-hourly',
  '0 * * * *',
  $$ SELECT public.cleanup_pending_commands(); $$
);

SELECT cron.schedule(
  'cleanup-stale-transactions-daily',
  '30 3 * * *',
  $$ SELECT public.cleanup_stale_pending_transactions(); $$
);

SELECT cron.schedule(
  'cleanup-orphan-esp32-weekly',
  '45 3 * * 0',
  $$ SELECT public.cleanup_orphan_esp32_status(); $$
);
