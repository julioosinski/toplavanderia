-- Libera máquinas cujo ciclo programado terminou (pagamento no totem ou liberação manual).
-- O ESP32 de lavadora/secadora só emite o pulso: ninguém avisa o fim do ciclo, então o
-- servidor precisa voltar a máquina para 'available' quando cycle_time_minutes expirar.
-- Antes dependia do timer em memória do APK (perdido ao reiniciar o app) e da edge function
-- auto-release-machines (401 no cron + filtro 'running', status que não existe).

-- ---------------------------------------------------------------------------
-- release_expired_machine_cycles — 'in_use' → 'available' após o tempo do ciclo
-- ---------------------------------------------------------------------------
-- Início do ciclo = machines.updated_at (gravado ao confirmar o ON / liberação manual).
-- Poltrona (massage / timed_session) fica de fora: o firmware informa a sessão.
CREATE OR REPLACE FUNCTION public.release_expired_machine_cycles(_machine_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _released record;
  _count integer := 0;
BEGIN
  FOR _released IN
    UPDATE public.machines m
    SET status = 'available', updated_at = now()
    WHERE m.status = 'in_use'
      AND (_machine_id IS NULL OR m.id = _machine_id)
      AND m.type <> 'massage'
      AND COALESCE(m.device_profile, 'credit_pulse') <> 'timed_session'
      AND m.updated_at + make_interval(mins => GREATEST(COALESCE(m.cycle_time_minutes, 40), 1)) <= now()
    RETURNING m.id, m.esp32_id, m.laundry_id, m.relay_pin
  LOOP
    _count := _count + 1;

    -- Espelha o relé desligado para o totem não manter "OCUPADA" por relay_status antigo.
    IF _released.esp32_id IS NOT NULL AND _released.laundry_id IS NOT NULL THEN
      UPDATE public.esp32_status s
      SET relay_status = s.relay_status
        || jsonb_build_object('relay_' || COALESCE(_released.relay_pin, 1), 'off')
      WHERE s.esp32_id = _released.esp32_id
        AND s.laundry_id = _released.laundry_id
        AND jsonb_typeof(s.relay_status) = 'object';
    END IF;
  END LOOP;

  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.release_expired_machine_cycles(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_expired_machine_cycles(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- begin_totem_payment_session — libera na hora se o ciclo da máquina já terminou
-- ---------------------------------------------------------------------------
-- O totem já mostra a máquina como livre quando o tempo passou; sem isto o servidor
-- recusava com "Máquina indisponível (status=in_use)" até o próximo cron.
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

  PERFORM public.release_expired_machine_cycles(_resolved_machine_id);

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
-- pg_cron: SQL direto a cada 30 s (sem HTTP/segredo). O job antigo 'auto-release-machines'
-- pertence a supabase_read_only_user e só pode ser removido pelo painel do Supabase.
-- ---------------------------------------------------------------------------
SELECT cron.schedule(
  'release-expired-machine-cycles',
  '30 seconds',
  $$SELECT public.release_expired_machine_cycles();$$
);
