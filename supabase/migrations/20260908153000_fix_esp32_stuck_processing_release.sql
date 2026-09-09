-- Pagamento aprovado sem pulso: comando claimed (processing) nunca era reentregue
-- se o ESP caísse após o poll, e o cron pulava esses "em voo" para sempre.

-- ---------------------------------------------------------------------------
-- reclaim_stale_processing_esp32_commands — cron: não depende do poll do ESP
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reclaim_stale_processing_esp32_commands()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n integer := 0;
BEGIN
  -- TX já cancelada/estornada: não reentregar.
  UPDATE public.pending_commands pc
  SET
    status = 'failed',
    error_message = COALESCE(pc.error_message, 'transaction_cancelled_before_delivery'),
    updated_at = now()
  FROM public.transactions t
  WHERE pc.transaction_id = t.id
    AND pc.status IN ('pending', 'processing')
    AND t.status IN ('cancelled', 'refunded');

  -- processing órfão (timeout HTTP no ESP, Wi-Fi caiu após o claim): volta a pending.
  UPDATE public.pending_commands pc
  SET
    status = 'pending',
    error_message = NULL,
    last_retry_at = NULL,
    updated_at = now()
  WHERE pc.status = 'processing'
    AND COALESCE(pc.last_retry_at, pc.updated_at, pc.created_at) < now() - interval '15 seconds'
    AND pc.created_at >= now() - interval '6 hours'
    AND (
      pc.transaction_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.transactions t
        WHERE t.id = pc.transaction_id
          AND t.status IN ('pending', 'processing')
      )
    );

  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reclaim_stale_processing_esp32_commands()
  TO service_role;

-- ---------------------------------------------------------------------------
-- claim_pending_esp32_commands — janela longa + case-insensitive + cycle_time
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.claim_pending_esp32_commands(text, integer);

CREATE OR REPLACE FUNCTION public.claim_pending_esp32_commands(
  _esp32_id text,
  _limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  relay_pin integer,
  action text,
  machine_id uuid,
  transaction_id uuid,
  payload jsonb,
  cycle_time_minutes integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id text;
BEGIN
  IF _esp32_id IS NULL OR btrim(_esp32_id) = '' THEN
    RETURN;
  END IF;

  _id := btrim(_esp32_id);

  UPDATE public.pending_commands pc
  SET
    status = 'failed',
    error_message = COALESCE(pc.error_message, 'transaction_cancelled_before_delivery'),
    updated_at = now()
  FROM public.transactions t
  WHERE pc.transaction_id = t.id
    AND pc.status IN ('pending', 'processing')
    AND t.status IN ('cancelled', 'refunded')
    AND (
      pc.esp32_id = _id
      OR lower(pc.esp32_id) = lower(_id)
    );

  -- OFF criado antes de um ON já confirmado não deve ser reentregue.
  UPDATE public.pending_commands pc
  SET
    status = 'failed',
    error_message = COALESCE(pc.error_message, 'stale_off_after_newer_on'),
    updated_at = now()
  WHERE (
      pc.esp32_id = _id
      OR lower(pc.esp32_id) = lower(_id)
    )
    AND pc.action = 'off'
    AND pc.status IN ('pending', 'processing')
    AND EXISTS (
      SELECT 1
      FROM public.pending_commands on_cmd
      WHERE (
          on_cmd.esp32_id = pc.esp32_id
          OR lower(on_cmd.esp32_id) = lower(pc.esp32_id)
        )
        AND on_cmd.action IN ('on', 'activate', 'turn_on')
        AND on_cmd.status = 'completed'
        AND COALESCE(on_cmd.executed_at, on_cmd.created_at) > pc.created_at
    );

  -- Só expira pending muito antigo (6h). 10 min matava pagamento com ESP oscilando.
  UPDATE public.pending_commands pc
  SET
    status = 'failed',
    error_message = COALESCE(pc.error_message, 'command_expired_before_delivery'),
    updated_at = now()
  WHERE (
      pc.esp32_id = _id
      OR lower(pc.esp32_id) = lower(_id)
    )
    AND pc.status = 'pending'
    AND pc.created_at < now() - interval '6 hours';

  UPDATE public.pending_commands pc
  SET
    status = 'pending',
    error_message = NULL,
    last_retry_at = NULL,
    updated_at = now()
  WHERE (
      pc.esp32_id = _id
      OR lower(pc.esp32_id) = lower(_id)
    )
    AND pc.status = 'processing'
    AND COALESCE(pc.last_retry_at, pc.updated_at, pc.created_at) < now() - interval '15 seconds'
    AND pc.created_at >= now() - interval '6 hours'
    AND NOT (
      pc.action = 'off'
      AND EXISTS (
        SELECT 1
        FROM public.pending_commands on_cmd
        WHERE (
            on_cmd.esp32_id = pc.esp32_id
            OR lower(on_cmd.esp32_id) = lower(pc.esp32_id)
          )
          AND on_cmd.action IN ('on', 'activate', 'turn_on')
          AND on_cmd.status = 'completed'
          AND COALESCE(on_cmd.executed_at, on_cmd.created_at) > pc.created_at
      )
    );

  RETURN QUERY
  WITH candidates AS (
    SELECT pc.id
    FROM public.pending_commands pc
    WHERE (
        pc.esp32_id = _id
        OR lower(pc.esp32_id) = lower(_id)
      )
      AND pc.status = 'pending'
      AND pc.created_at >= now() - interval '6 hours'
    ORDER BY pc.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(_limit, 10), 1), 20)
  ),
  claimed AS (
    UPDATE public.pending_commands pc
    SET
      status = 'processing',
      last_retry_at = now(),
      updated_at = now()
    FROM candidates c
    WHERE pc.id = c.id
      AND pc.status = 'pending'
    RETURNING
      pc.id,
      pc.relay_pin,
      pc.action,
      pc.machine_id,
      pc.transaction_id,
      pc.payload
  )
  SELECT
    claimed.id,
    claimed.relay_pin,
    claimed.action,
    claimed.machine_id,
    claimed.transaction_id,
    claimed.payload,
    COALESCE(
      m.cycle_time_minutes,
      CASE
        WHEN (claimed.payload->>'cycle_time_minutes') ~ '^[0-9]+$'
        THEN (claimed.payload->>'cycle_time_minutes')::integer
        ELSE NULL
      END
    )
  FROM claimed
  LEFT JOIN public.machines m ON m.id = claimed.machine_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_pending_esp32_commands(text, integer)
  TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- enqueue_totem_machine_release — reseta processing parado em vez de reutilizar
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_totem_machine_release(_transaction_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tx RECORD;
  _existing RECORD;
  _command_id uuid;
  _payload jsonb;
BEGIN
  IF _transaction_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT t.*, m.esp32_id, m.relay_pin, m.cycle_time_minutes, m.type, m.device_profile, m.metadata AS machine_metadata
  INTO _tx
  FROM public.transactions t
  JOIN public.machines m ON m.id = t.machine_id
  WHERE t.id = _transaction_id
    AND t.status IN ('pending', 'processing');

  IF NOT FOUND OR _tx.esp32_id IS NULL OR length(trim(_tx.esp32_id)) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT pc.id, pc.status, pc.last_retry_at, pc.updated_at, pc.created_at
  INTO _existing
  FROM public.pending_commands pc
  WHERE pc.transaction_id = _transaction_id
    AND pc.action IN ('on', 'activate', 'turn_on', 'credito')
    AND pc.status IN ('pending', 'processing', 'completed')
  ORDER BY pc.created_at DESC
  LIMIT 1;

  IF _existing.id IS NOT NULL THEN
    IF _existing.status = 'completed' THEN
      RETURN _existing.id;
    END IF;

    IF _existing.status = 'processing'
       AND COALESCE(_existing.last_retry_at, _existing.updated_at, _existing.created_at)
           < now() - interval '15 seconds' THEN
      UPDATE public.pending_commands
      SET
        status = 'pending',
        error_message = NULL,
        last_retry_at = NULL,
        updated_at = now()
      WHERE id = _existing.id
        AND status = 'processing';
    END IF;

    UPDATE public.payment_sessions
    SET state = 'RELEASE_PENDING', updated_at = now()
    WHERE transaction_id = _transaction_id
      AND state IN ('AUTHORIZED', 'APPROVED', 'CAPTURED', 'RECONCILIATION_PENDING', 'RECONCILED');

    RETURN _existing.id;
  END IF;

  PERFORM public.cancel_stale_off_commands(_tx.esp32_id, COALESCE(_tx.relay_pin, 1)::integer);

  _payload := jsonb_build_object(
    'cycle_time_minutes', COALESCE(_tx.cycle_time_minutes, _tx.duration_minutes, 40),
    'source', 'reconcile_enqueue'
  );

  IF _tx.type = 'coffee' OR _tx.device_profile = 'coin_dispense' THEN
    IF _tx.laundry_id IS NOT NULL THEN
      PERFORM public.enqueue_coffee_credit_command(_transaction_id, _tx.laundry_id);
      SELECT pc.id INTO _command_id
      FROM public.pending_commands pc
      WHERE pc.transaction_id = _transaction_id
        AND pc.action = 'credito'
      ORDER BY pc.created_at DESC
      LIMIT 1;
    END IF;
  ELSE
    INSERT INTO public.pending_commands (
      esp32_id, relay_pin, action, machine_id, transaction_id, status, payload
    )
    VALUES (
      _tx.esp32_id,
      COALESCE(_tx.relay_pin, 1)::integer,
      'on',
      _tx.machine_id,
      _transaction_id,
      'pending',
      _payload
    )
    RETURNING id INTO _command_id;
  END IF;

  UPDATE public.payment_sessions
  SET state = 'RELEASE_PENDING', updated_at = now()
  WHERE transaction_id = _transaction_id
    AND state IN ('AUTHORIZED', 'APPROVED', 'CAPTURED', 'RECONCILIATION_PENDING', 'RECONCILED');

  RETURN _command_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_totem_machine_release(uuid)
  TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- list_orphan_totem_releases — processing parado não conta como "em voo"
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_orphan_totem_releases(
  _min_age_seconds integer DEFAULT 90,
  _max_age_minutes integer DEFAULT 30
)
RETURNS TABLE (
  transaction_id uuid,
  machine_id uuid,
  esp32_id text,
  relay_pin integer,
  cycle_time_minutes integer,
  payment_method text,
  total_amount numeric,
  created_at timestamptz,
  has_in_flight_command boolean,
  cielo_payment_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.machine_id,
    m.esp32_id,
    COALESCE(m.relay_pin, 1)::integer,
    COALESCE(m.cycle_time_minutes, 40)::integer,
    t.payment_method,
    t.total_amount,
    t.created_at,
    EXISTS (
      SELECT 1
      FROM public.pending_commands pc2
      WHERE pc2.transaction_id = t.id
        AND pc2.action IN ('on', 'activate', 'turn_on', 'credito')
        AND (
          pc2.status = 'pending'
          OR (
            pc2.status = 'processing'
            AND COALESCE(pc2.last_retry_at, pc2.updated_at, pc2.created_at)
                >= now() - interval '20 seconds'
          )
        )
    ) AS has_in_flight_command,
    NULLIF(t.metadata->>'cielo_payment_id', '') AS cielo_payment_id
  FROM public.transactions t
  JOIN public.machines m ON m.id = t.machine_id
  WHERE t.status IN ('pending', 'processing')
    AND coalesce(t.payment_method, '') <> 'manual_release'
    AND t.created_at <= now() - make_interval(secs => GREATEST(_min_age_seconds, 30))
    AND t.created_at >= now() - make_interval(mins => GREATEST(_max_age_minutes, 5))
    AND m.esp32_id IS NOT NULL
    AND length(trim(m.esp32_id)) > 0
    AND NOT EXISTS (
      SELECT 1
      FROM public.pending_commands pc
      WHERE pc.transaction_id = t.id
        AND pc.action IN ('on', 'activate', 'turn_on', 'credito')
        AND pc.status = 'completed'
    )
    AND (
      COALESCE((t.metadata->>'payment_authorized')::boolean, false) = true
      OR COALESCE((t.metadata->>'reconciliation_pending')::boolean, false) = true
      OR COALESCE((t.metadata->>'needs_refund')::boolean, false) = true
      OR t.created_at <= now() - interval '3 minutes'
    )
  ORDER BY t.created_at ASC
  LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_orphan_totem_releases(integer, integer)
  TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- run_payment_reconcile_local — reclaim global + janela de 6h
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_payment_reconcile_local()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _expired integer := 0;
  _reclaimed integer := 0;
  _enqueued integer := 0;
  _skipped integer := 0;
  _row RECORD;
  _cmd uuid;
BEGIN
  SELECT public.expire_stale_payment_sessions(30) INTO _expired;
  SELECT public.reclaim_stale_processing_esp32_commands() INTO _reclaimed;

  FOR _row IN
    SELECT *
    FROM public.list_orphan_totem_releases(45, 360)
  LOOP
    IF _row.has_in_flight_command THEN
      _skipped := _skipped + 1;
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = _row.transaction_id
        AND (
          COALESCE((t.metadata->>'payment_authorized')::boolean, false) = true
          OR COALESCE((t.metadata->>'reconciliation_pending')::boolean, false) = true
          OR COALESCE((t.metadata->>'needs_refund')::boolean, false) = true
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
    'reclaimed_processing', _reclaimed,
    'enqueued_releases', _enqueued,
    'skipped', _skipped,
    'ran_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_payment_reconcile_local()
  TO service_role;
