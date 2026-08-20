-- Reconciliação local a cada 2 min (sem depender de secret HTTP).
-- Também protege cleanup diário para não cancelar TX já autorizadas.

-- ---------------------------------------------------------------------------
-- cleanup_stale_pending_transactions — NÃO cancela pagamento autorizado
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_stale_pending_transactions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só abandonos sem autorização Cielo/Stone. Pagos órfãos ficam para reconcile.
  UPDATE public.transactions t
  SET
    status = 'cancelled',
    updated_at = now(),
    metadata = COALESCE(t.metadata, '{}'::jsonb) || jsonb_build_object(
      'cancelled_by', 'cleanup_stale_pending',
      'cancelled_at', to_jsonb(now())
    )
  WHERE t.status = 'pending'
    AND t.created_at < now() - INTERVAL '1 day'
    AND COALESCE((t.metadata->>'payment_authorized')::boolean, false) = false
    AND COALESCE((t.metadata->>'reconciliation_pending')::boolean, false) = false;

  UPDATE public.payment_sessions ps
  SET state = 'EXPIRED', updated_at = now()
  WHERE ps.state IN ('CREATED', 'PAYMENT_PENDING')
    AND ps.created_at < now() - INTERVAL '1 day'
    AND EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = ps.transaction_id AND t.status = 'cancelled'
    );
END;
$$;

-- ---------------------------------------------------------------------------
-- run_payment_reconcile_local — expire + reenfileira liberação de órfãos autorizados
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_payment_reconcile_local()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _expired integer := 0;
  _enqueued integer := 0;
  _skipped integer := 0;
  _row RECORD;
  _cmd uuid;
BEGIN
  SELECT public.expire_stale_payment_sessions(30) INTO _expired;

  FOR _row IN
    SELECT *
    FROM public.list_orphan_totem_releases(60, 45)
  LOOP
    IF _row.has_in_flight_command THEN
      _skipped := _skipped + 1;
      CONTINUE;
    END IF;

    -- Só reenfileira se já marcado autorizado ou pending de reconciliação.
    IF NOT EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = _row.transaction_id
        AND (
          COALESCE((t.metadata->>'payment_authorized')::boolean, false) = true
          OR COALESCE((t.metadata->>'reconciliation_pending')::boolean, false) = true
        )
    ) THEN
      _skipped := _skipped + 1;
      CONTINUE;
    END IF;

    _cmd := public.enqueue_totem_machine_release(_row.transaction_id);
    IF _cmd IS NOT NULL THEN
      _enqueued := _enqueued + 1;
    ELSE
      _skipped := _skipped + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'expired_sessions', _expired,
    'enqueued_releases', _enqueued,
    'skipped', _skipped,
    'ran_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_payment_reconcile_local()
  TO service_role;

-- ---------------------------------------------------------------------------
-- pg_cron a cada 2 minutos
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  jid bigint;
BEGIN
  FOR jid IN
    SELECT jobid FROM cron.job WHERE jobname = 'reconcile-payments-local'
  LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'reconcile-payments-local',
  '*/2 * * * *',
  $$ SELECT public.run_payment_reconcile_local(); $$
);
