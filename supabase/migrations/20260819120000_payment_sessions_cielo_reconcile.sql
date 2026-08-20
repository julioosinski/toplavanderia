-- Fase A: sessões de pagamento persistidas, reserva atômica, reconciliação Cielo.
-- Scaffold payment_terminals (Stone futuro). Pulso ESP32 permanece 1s (sem alteração de firmware).

-- ---------------------------------------------------------------------------
-- payment_terminals — registro de terminais (Cielo hoje; Stone preparado)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_terminals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laundry_id UUID NOT NULL REFERENCES public.laundries(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('cielo', 'stone', 'paygo', 'manual')),
  label TEXT NOT NULL DEFAULT '',
  device_serial TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_terminals_laundry_provider
  ON public.payment_terminals (laundry_id, provider)
  WHERE is_active = true;

ALTER TABLE public.payment_terminals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage payment terminals for their laundry"
  ON public.payment_terminals
  FOR ALL
  TO authenticated
  USING (
    public.is_super_admin((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('admin', 'operator')
        AND ur.laundry_id = payment_terminals.laundry_id
    )
  )
  WITH CHECK (
    public.is_super_admin((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('admin', 'operator')
        AND ur.laundry_id = payment_terminals.laundry_id
    )
  );

-- ---------------------------------------------------------------------------
-- payment_sessions — máquina de estados do pagamento (fonte de verdade do fluxo)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laundry_id UUID NOT NULL REFERENCES public.laundries(id) ON DELETE CASCADE,
  machine_id UUID REFERENCES public.machines(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  terminal_id UUID REFERENCES public.payment_terminals(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('cielo', 'stone', 'paygo', 'manual')),
  state TEXT NOT NULL DEFAULT 'CREATED' CHECK (state IN (
    'CREATED', 'PAYMENT_PENDING', 'AUTHORIZED', 'CAPTURED', 'APPROVED',
    'REJECTED', 'CANCELLED', 'REVERSED', 'EXPIRED',
    'RECONCILIATION_PENDING', 'RECONCILED',
    'RELEASE_PENDING', 'RELEASED', 'ERROR'
  )),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  payment_method TEXT,
  external_reference TEXT,
  cielo_order_id TEXT,
  cielo_payment_id TEXT,
  stone_transaction_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ,
  authorized_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_sessions_transaction
  ON public.payment_sessions (transaction_id);

CREATE INDEX IF NOT EXISTS idx_payment_sessions_machine_active
  ON public.payment_sessions (machine_id, created_at DESC)
  WHERE state IN (
    'CREATED', 'PAYMENT_PENDING', 'AUTHORIZED', 'CAPTURED', 'APPROVED',
    'RECONCILIATION_PENDING', 'RELEASE_PENDING'
  );

CREATE INDEX IF NOT EXISTS idx_payment_sessions_laundry_state
  ON public.payment_sessions (laundry_id, state, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_sessions_external_ref
  ON public.payment_sessions (external_reference)
  WHERE external_reference IS NOT NULL AND length(trim(external_reference)) > 0;

ALTER TABLE public.payment_sessions ENABLE ROW LEVEL SECURITY;

-- Totem usa RPCs SECURITY DEFINER; leitura direta só para admins autenticados.
CREATE POLICY "Admins read payment sessions for their laundry"
  ON public.payment_sessions
  FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('admin', 'operator')
        AND ur.laundry_id = payment_sessions.laundry_id
    )
  );

-- ---------------------------------------------------------------------------
-- Helpers internos
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._payment_session_blocks_machine(_machine_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.payment_sessions ps
    WHERE ps.machine_id = _machine_id
      AND ps.state IN (
        'CREATED', 'PAYMENT_PENDING', 'AUTHORIZED', 'CAPTURED', 'APPROVED',
        'RECONCILIATION_PENDING', 'RELEASE_PENDING'
      )
      AND ps.created_at >= now() - interval '45 minutes'
  );
$$;

-- ---------------------------------------------------------------------------
-- begin_totem_payment_session — reserva atômica + TX pending + sessão CREATED
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.begin_totem_payment_session(
  _machine_id uuid DEFAULT NULL,
  _total_amount numeric DEFAULT NULL,
  _duration_minutes integer DEFAULT NULL,
  _payment_method text DEFAULT 'credit',
  _laundry_id uuid DEFAULT NULL,
  _provider text DEFAULT 'cielo',
  _external_reference text DEFAULT NULL,
  _coffee_product_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _machine RECORD;
  _transaction_id uuid;
  _session_id uuid;
  _resolved_machine_id uuid;
  _resolved_amount numeric;
  _resolved_duration integer;
  _product_name text;
  _provider_norm text;
BEGIN
  IF _laundry_id IS NULL THEN
    RAISE EXCEPTION 'laundry_id obrigatório';
  END IF;

  _provider_norm := lower(coalesce(nullif(trim(_provider), ''), 'cielo'));
  IF _provider_norm NOT IN ('cielo', 'stone', 'paygo', 'manual') THEN
    RAISE EXCEPTION 'provider inválido: %', _provider_norm;
  END IF;

  IF _coffee_product_id IS NOT NULL THEN
    SELECT cp.machine_id, cp.price, cp.name
    INTO _resolved_machine_id, _resolved_amount, _product_name
    FROM public.coffee_products cp
    JOIN public.laundries l ON l.id = cp.laundry_id
    JOIN public.machines m ON m.id = cp.machine_id
    WHERE cp.id = _coffee_product_id
      AND cp.laundry_id = _laundry_id
      AND cp.is_active = true
      AND l.is_active = true
      AND m.type = 'coffee';

    IF _resolved_machine_id IS NULL THEN
      RAISE EXCEPTION 'Produto de café inválido para a lavanderia informada.';
    END IF;

    _resolved_duration := 0;
  ELSE
    IF _machine_id IS NULL OR _total_amount IS NULL THEN
      RAISE EXCEPTION 'machine_id e total_amount obrigatórios';
    END IF;
    _resolved_machine_id := _machine_id;
    _resolved_amount := _total_amount;
    _resolved_duration := COALESCE(_duration_minutes, 40);
  END IF;

  SELECT m.*
  INTO _machine
  FROM public.machines m
  JOIN public.laundries l ON l.id = m.laundry_id
  WHERE m.id = _resolved_machine_id
    AND m.laundry_id = _laundry_id
    AND l.is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Máquina inválida para a lavanderia informada.';
  END IF;

  IF public._payment_session_blocks_machine(_resolved_machine_id) THEN
    RAISE EXCEPTION 'Máquina com pagamento em andamento. Aguarde ou tente outra máquina.';
  END IF;

  -- Poltrona: permite pagar enquanto em uso (firmware soma tempo).
  IF _machine.type <> 'massage' THEN
    IF _machine.status NOT IN ('available') THEN
      RAISE EXCEPTION 'Máquina indisponível (status=%).', _machine.status;
    END IF;
    IF _machine.esp32_id IS NULL OR length(trim(_machine.esp32_id)) = 0 THEN
      RAISE EXCEPTION 'Máquina sem ESP32 configurado.';
    END IF;
  END IF;

  INSERT INTO public.transactions (
    machine_id,
    total_amount,
    duration_minutes,
    status,
    payment_method,
    laundry_id,
    coffee_product_id,
    metadata,
    started_at
  )
  VALUES (
    _resolved_machine_id,
    _resolved_amount,
    _resolved_duration,
    'pending',
    coalesce(nullif(trim(_payment_method), ''), 'credit'),
    _laundry_id,
    _coffee_product_id,
    CASE
      WHEN _product_name IS NOT NULL THEN jsonb_build_object('product_name', _product_name, 'service', 'coffee')
      ELSE '{}'::jsonb
    END,
    now()
  )
  RETURNING id INTO _transaction_id;

  INSERT INTO public.payment_sessions (
    laundry_id,
    machine_id,
    transaction_id,
    provider,
    state,
    amount_cents,
    payment_method,
    external_reference,
    expires_at,
    metadata
  )
  VALUES (
    _laundry_id,
    _resolved_machine_id,
    _transaction_id,
    _provider_norm,
    'CREATED',
    GREATEST(1, ROUND(_resolved_amount * 100)::bigint),
    coalesce(nullif(trim(_payment_method), ''), 'credit'),
    NULLIF(trim(_external_reference), ''),
    now() + interval '30 minutes',
    jsonb_build_object('device_profile', _machine.device_profile)
  )
  RETURNING id INTO _session_id;

  RETURN jsonb_build_object(
    'session_id', _session_id,
    'transaction_id', _transaction_id,
    'machine_id', _resolved_machine_id,
    'amount_cents', GREATEST(1, ROUND(_resolved_amount * 100)::bigint)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.begin_totem_payment_session(uuid, numeric, integer, text, uuid, text, text, uuid)
  TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- update_payment_session — transições de estado + refs Cielo/Stone
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_payment_session(
  _session_id uuid,
  _state text,
  _external_reference text DEFAULT NULL,
  _cielo_order_id text DEFAULT NULL,
  _cielo_payment_id text DEFAULT NULL,
  _stone_transaction_id text DEFAULT NULL,
  _payment_method text DEFAULT NULL,
  _extra jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _merged jsonb;
BEGIN
  IF _session_id IS NULL OR _state IS NULL OR length(trim(_state)) = 0 THEN
    RETURN false;
  END IF;

  _merged := COALESCE(_extra, '{}'::jsonb);

  UPDATE public.payment_sessions ps
  SET
    state = upper(trim(_state)),
    external_reference = COALESCE(NULLIF(trim(_external_reference), ''), ps.external_reference),
    cielo_order_id = COALESCE(NULLIF(trim(_cielo_order_id), ''), ps.cielo_order_id),
    cielo_payment_id = COALESCE(NULLIF(trim(_cielo_payment_id), ''), ps.cielo_payment_id),
    stone_transaction_id = COALESCE(NULLIF(trim(_stone_transaction_id), ''), ps.stone_transaction_id),
    payment_method = COALESCE(NULLIF(trim(_payment_method), ''), ps.payment_method),
    metadata = COALESCE(ps.metadata, '{}'::jsonb) || _merged,
    authorized_at = CASE
      WHEN upper(trim(_state)) IN ('AUTHORIZED', 'CAPTURED', 'APPROVED') AND ps.authorized_at IS NULL THEN now()
      ELSE ps.authorized_at
    END,
    released_at = CASE
      WHEN upper(trim(_state)) = 'RELEASED' AND ps.released_at IS NULL THEN now()
      ELSE ps.released_at
    END,
    updated_at = now()
  WHERE ps.id = _session_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_payment_session(uuid, text, text, text, text, text, text, jsonb)
  TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- enqueue_totem_machine_release — reenfileira ON idempotente (reconcile/cron)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_totem_machine_release(_transaction_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tx RECORD;
  _machine RECORD;
  _existing_id uuid;
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

  SELECT pc.id
  INTO _existing_id
  FROM public.pending_commands pc
  WHERE pc.transaction_id = _transaction_id
    AND pc.action IN ('on', 'activate', 'turn_on', 'credito')
    AND pc.status IN ('pending', 'processing', 'completed')
  ORDER BY pc.created_at DESC
  LIMIT 1;

  IF _existing_id IS NOT NULL THEN
    RETURN _existing_id;
  END IF;

  -- Cancela OFF stale antes do ON (espelha esp32-control).
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
-- list_payment_diagnostics_admin — painel admin (Cielo + futuro Stone)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_payment_diagnostics_admin(
  _laundry_id uuid,
  _hours integer DEFAULT 24,
  _limit integer DEFAULT 100
)
RETURNS TABLE (
  session_id uuid,
  transaction_id uuid,
  machine_id uuid,
  machine_name text,
  provider text,
  session_state text,
  transaction_status text,
  amount_cents bigint,
  payment_method text,
  external_reference text,
  cielo_order_id text,
  cielo_payment_id text,
  payment_authorized boolean,
  needs_refund boolean,
  reconciliation_pending boolean,
  esp_command_status text,
  has_in_flight_command boolean,
  created_at timestamptz,
  authorized_at timestamptz,
  released_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _laundry_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT (
    public.is_super_admin((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('admin', 'operator')
        AND ur.laundry_id = _laundry_id
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para diagnóstico de pagamentos';
  END IF;

  RETURN QUERY
  SELECT
    ps.id,
    ps.transaction_id,
    ps.machine_id,
    m.name,
    ps.provider,
    ps.state,
    t.status,
    ps.amount_cents,
    ps.payment_method,
    ps.external_reference,
    ps.cielo_order_id,
    ps.cielo_payment_id,
    COALESCE((t.metadata->>'payment_authorized')::boolean, false),
    COALESCE((t.metadata->>'needs_refund')::boolean, false),
    COALESCE((t.metadata->>'reconciliation_pending')::boolean, false),
    (
      SELECT pc.status
      FROM public.pending_commands pc
      WHERE pc.transaction_id = ps.transaction_id
        AND pc.action IN ('on', 'activate', 'turn_on', 'credito')
      ORDER BY pc.created_at DESC
      LIMIT 1
    ),
    EXISTS (
      SELECT 1
      FROM public.pending_commands pc2
      WHERE pc2.transaction_id = ps.transaction_id
        AND pc2.action IN ('on', 'activate', 'turn_on', 'credito')
        AND pc2.status IN ('pending', 'processing')
    ),
    ps.created_at,
    ps.authorized_at,
    ps.released_at
  FROM public.payment_sessions ps
  LEFT JOIN public.transactions t ON t.id = ps.transaction_id
  LEFT JOIN public.machines m ON m.id = ps.machine_id
  WHERE ps.laundry_id = _laundry_id
    AND ps.created_at >= now() - make_interval(hours => GREATEST(_hours, 1))
  ORDER BY ps.created_at DESC
  LIMIT LEAST(GREATEST(_limit, 1), 200);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_payment_diagnostics_admin(uuid, integer, integer)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- expire_stale_payment_sessions — cron: CREATED/PAYMENT_PENDING > 30min sem pagar
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_stale_payment_sessions(_max_age_minutes integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n integer := 0;
  _row RECORD;
BEGIN
  FOR _row IN
    SELECT ps.id, ps.transaction_id
    FROM public.payment_sessions ps
    JOIN public.transactions t ON t.id = ps.transaction_id
    WHERE ps.state IN ('CREATED', 'PAYMENT_PENDING')
      AND ps.created_at <= now() - make_interval(mins => GREATEST(_max_age_minutes, 5))
      AND t.status = 'pending'
      AND COALESCE((t.metadata->>'payment_authorized')::boolean, false) = false
  LOOP
    UPDATE public.payment_sessions
    SET state = 'EXPIRED', updated_at = now()
    WHERE id = _row.id;

    PERFORM public.cancel_totem_transaction_by_id(_row.transaction_id);
    _n := _n + 1;
  END LOOP;

  RETURN _n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_stale_payment_sessions(integer)
  TO service_role;

-- ---------------------------------------------------------------------------
-- cancel_totem_transaction_by_id — NÃO cancela se pagamento já autorizado
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

    RETURN false;
  END IF;

  UPDATE public.transactions
  SET
    status = 'cancelled',
    updated_at = now()
  WHERE id = _transaction_id
    AND status = 'pending';

  _updated := FOUND;

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
-- mark_totem_payment_authorized — também avança payment_session
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

  UPDATE public.payment_sessions ps
  SET
    state = 'AUTHORIZED',
    cielo_payment_id = COALESCE(NULLIF(trim(_cielo_payment_id), ''), ps.cielo_payment_id),
    payment_method = COALESCE(NULLIF(trim(_payment_method), ''), ps.payment_method),
    authorized_at = COALESCE(ps.authorized_at, now()),
    updated_at = now()
  WHERE ps.transaction_id = _transaction_id
    AND ps.state IN ('CREATED', 'PAYMENT_PENDING', 'RECONCILIATION_PENDING');

  RETURN FOUND;
END;
$$;

-- ---------------------------------------------------------------------------
-- complete_transaction_on_esp_confirm — também marca sessão RELEASED
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_transaction_on_esp_confirm(_transaction_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _transaction_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.transactions
  SET
    status = 'completed',
    completed_at = COALESCE(completed_at, now()),
    updated_at = now(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('completed_by', 'esp32_confirm')
  WHERE id = _transaction_id
    AND status = 'pending';

  UPDATE public.payment_sessions
  SET
    state = 'RELEASED',
    released_at = COALESCE(released_at, now()),
    updated_at = now()
  WHERE transaction_id = _transaction_id
    AND state IN ('AUTHORIZED', 'APPROVED', 'CAPTURED', 'RELEASE_PENDING', 'RECONCILIATION_PENDING', 'RECONCILED');

  RETURN FOUND;
END;
$$;
