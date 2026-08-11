-- Pagamentos totem: marcar autorização Cielo no metadata + reconciliar liberação órfã.
-- Evita TX pending "paga" sem comando ESP e permite reenfileirar ON sem nova cobrança.

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

  UPDATE public.transactions t
  SET
    payment_method = COALESCE(NULLIF(trim(_payment_method), ''), t.payment_method),
    metadata = COALESCE(t.metadata, '{}'::jsonb) || merged,
    updated_at = now()
  WHERE t.id = _transaction_id
    AND t.status IN ('pending', 'processing');

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_totem_payment_authorized(uuid, text, text, text, bigint, jsonb)
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mark_totem_payment_needs_refund(
  _transaction_id uuid,
  _reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _transaction_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.transactions t
  SET
    metadata = COALESCE(t.metadata, '{}'::jsonb) || jsonb_build_object(
      'needs_refund', true,
      'needs_refund_at', to_jsonb(now()),
      'needs_refund_reason', COALESCE(_reason, 'esp32_not_confirmed')
    ),
    updated_at = now()
  WHERE t.id = _transaction_id
    AND t.status IN ('pending', 'processing');

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_totem_payment_needs_refund(uuid, text)
  TO anon, authenticated, service_role;

-- Reconcile: TX pending autorizada (ou >90s) sem comando ON completed → devolve linhas para refila.
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
        AND pc2.status IN ('pending', 'processing')
    ) AS has_in_flight_command,
    NULLIF(t.metadata->>'cielo_payment_id', '') AS cielo_payment_id
  FROM public.transactions t
  JOIN public.machines m ON m.id = t.machine_id
  WHERE t.status = 'pending'
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
      OR t.created_at <= now() - interval '3 minutes'
    )
  ORDER BY t.created_at ASC
  LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_orphan_totem_releases(integer, integer)
  TO anon, authenticated, service_role;
