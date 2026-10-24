-- Corrida Cielo LIO "erro → aprovado" (incidente 22/10/2026):
-- a LIO reportava erro, o totem cancelava a TX e, no mesmo segundo, chegava a aprovação.
-- A TX cancelada fazia claim_pending_esp32_commands descartar o ON
-- (transaction_cancelled_before_delivery): cliente cobrado e máquina parada.

-- ---------------------------------------------------------------------------
-- cancel_totem_transaction_by_id — a checagem de payment_authorized também vai no
-- WHERE do UPDATE, para não cancelar se a autorização for gravada em paralelo.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_totem_transaction_by_id(_transaction_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _updated boolean := false;
  _authorized boolean := false;
BEGIN
  IF _transaction_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.transactions
  SET
    status = 'cancelled',
    updated_at = now()
  WHERE id = _transaction_id
    AND status = 'pending'
    AND COALESCE((metadata->>'payment_authorized')::boolean, false) = false;

  _updated := FOUND;

  IF NOT _updated THEN
    SELECT COALESCE((t.metadata->>'payment_authorized')::boolean, false)
    INTO _authorized
    FROM public.transactions t
    WHERE t.id = _transaction_id;

    IF _authorized THEN
      UPDATE public.transactions
      SET
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'reconciliation_pending', true,
          'reconciliation_pending_at', to_jsonb(now()),
          'reconciliation_reason', 'cancel_blocked_payment_authorized'
        ),
        updated_at = now()
      WHERE id = _transaction_id
        AND status = 'pending';

      UPDATE public.payment_sessions
      SET state = 'RECONCILIATION_PENDING', updated_at = now()
      WHERE transaction_id = _transaction_id
        AND state NOT IN ('RELEASED', 'REVERSED', 'RECONCILED', 'CANCELLED', 'EXPIRED');
    END IF;

    RETURN false;
  END IF;

  UPDATE public.pending_commands
  SET
    status = 'failed',
    error_message = COALESCE(error_message, 'cancelled_with_transaction'),
    updated_at = now()
  WHERE transaction_id = _transaction_id
    AND status IN ('pending', 'processing');

  UPDATE public.payment_sessions
  SET state = 'CANCELLED', updated_at = now()
  WHERE transaction_id = _transaction_id
    AND state IN ('CREATED', 'PAYMENT_PENDING');

  RETURN _updated;
END;
$$;

-- ---------------------------------------------------------------------------
-- mark_totem_payment_authorized — aprovação que chega depois de um cancelamento
-- recente reativa a TX (status pending) para o ON ser entregue ao ESP32.
-- Não reativa se houve estorno ou se a máquina já teve outra venda/liberação depois;
-- nesse caso marca needs_refund para conciliação manual.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_totem_payment_authorized(
  _transaction_id uuid,
  _payment_method text DEFAULT NULL,
  _cielo_payment_id text DEFAULT NULL,
  _cielo_auth_code text DEFAULT NULL,
  _amount_cents bigint DEFAULT NULL,
  _extra jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  merged jsonb;
  _tx RECORD;
  _can_revive boolean := false;
  _updated boolean := false;
BEGIN
  IF _transaction_id IS NULL THEN
    RETURN false;
  END IF;

  merged := COALESCE(_extra, '{}'::jsonb)
    || jsonb_build_object(
      'payment_authorized', true,
      'authorized_at', to_jsonb(now())
    );

  IF _cielo_payment_id IS NOT NULL AND length(trim(_cielo_payment_id)) > 0 THEN
    merged := merged || jsonb_build_object('cielo_payment_id', trim(_cielo_payment_id));
  END IF;
  IF _cielo_auth_code IS NOT NULL AND length(trim(_cielo_auth_code)) > 0 THEN
    merged := merged || jsonb_build_object('cielo_auth_code', trim(_cielo_auth_code));
  END IF;
  IF _amount_cents IS NOT NULL AND _amount_cents > 0 THEN
    merged := merged || jsonb_build_object('cielo_amount_cents', _amount_cents);
  END IF;

  -- Serializa com cancel_totem_transaction_by_id rodando em paralelo.
  SELECT t.id, t.status, t.machine_id, t.created_at, t.updated_at, t.metadata, m.type AS machine_type
  INTO _tx
  FROM public.transactions t
  LEFT JOIN public.machines m ON m.id = t.machine_id
  WHERE t.id = _transaction_id
  FOR UPDATE OF t;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF _tx.status IN ('pending', 'processing') THEN
    UPDATE public.transactions t
    SET
      payment_method = COALESCE(NULLIF(trim(_payment_method), ''), t.payment_method),
      metadata = COALESCE(t.metadata, '{}'::jsonb) || merged,
      updated_at = now()
    WHERE t.id = _transaction_id;
    _updated := true;

  ELSIF _tx.status = 'cancelled' THEN
    _can_revive :=
      _tx.updated_at >= now() - interval '20 minutes'
      AND COALESCE((_tx.metadata->>'reversed')::boolean, false) = false
      AND COALESCE((_tx.metadata->>'refunded')::boolean, false) = false
      AND NOT EXISTS (
        SELECT 1 FROM public.payment_sessions ps
        WHERE ps.transaction_id = _transaction_id
          AND ps.state IN ('REVERSED', 'RELEASED')
      )
      AND (
        _tx.machine_type = 'coffee'
        OR NOT EXISTS (
          SELECT 1 FROM public.transactions other
          WHERE other.machine_id = _tx.machine_id
            AND other.id <> _transaction_id
            AND other.created_at > _tx.created_at
            AND other.status IN ('pending', 'processing', 'completed')
        )
      );

    IF _can_revive THEN
      UPDATE public.transactions t
      SET
        status = 'pending',
        completed_at = NULL,
        payment_method = COALESCE(NULLIF(trim(_payment_method), ''), t.payment_method),
        metadata = COALESCE(t.metadata, '{}'::jsonb) || merged || jsonb_build_object(
          'revived_after_cancel', true,
          'revived_at', to_jsonb(now())
        ),
        updated_at = now()
      WHERE t.id = _transaction_id;
      _updated := true;
    ELSE
      UPDATE public.transactions t
      SET
        payment_method = COALESCE(NULLIF(trim(_payment_method), ''), t.payment_method),
        metadata = COALESCE(t.metadata, '{}'::jsonb) || merged || jsonb_build_object(
          'needs_refund', true,
          'needs_refund_at', to_jsonb(now()),
          'needs_refund_reason', 'authorized_after_cancel'
        ),
        updated_at = now()
      WHERE t.id = _transaction_id;

      UPDATE public.payment_sessions
      SET state = 'RECONCILIATION_PENDING', updated_at = now()
      WHERE transaction_id = _transaction_id
        AND state NOT IN ('RELEASED', 'REVERSED', 'RECONCILED');

      RETURN false;
    END IF;
  ELSE
    RETURN false;
  END IF;

  UPDATE public.payment_sessions ps
  SET
    state = 'AUTHORIZED',
    cielo_payment_id = COALESCE(NULLIF(trim(_cielo_payment_id), ''), ps.cielo_payment_id),
    payment_method = COALESCE(NULLIF(trim(_payment_method), ''), ps.payment_method),
    authorized_at = COALESCE(ps.authorized_at, now()),
    updated_at = now()
  WHERE ps.transaction_id = _transaction_id
    AND ps.state IN ('CREATED', 'PAYMENT_PENDING', 'RECONCILIATION_PENDING', 'CANCELLED', 'EXPIRED');

  RETURN _updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_totem_transaction_by_id(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_totem_payment_authorized(uuid, text, text, text, bigint, jsonb)
  TO anon, authenticated, service_role;
