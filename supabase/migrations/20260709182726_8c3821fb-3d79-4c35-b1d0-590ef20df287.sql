CREATE OR REPLACE FUNCTION public.admin_remote_release(_machine_id uuid, _product_id uuid DEFAULT NULL::uuid, _valor_centavos integer DEFAULT NULL::integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _machine RECORD;
  _product RECORD;
  _cmd_id uuid;
  _amount numeric;
  _cents integer;
  _tx_id uuid;
  _audio_volumes jsonb;
  _is_operator_only boolean := false;
  _perm RECORD;
  _day_cents integer := 0;
  _month_cents integer := 0;
  _tz text := 'America/Sao_Paulo';
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT m.*
  INTO _machine
  FROM public.machines m
  WHERE m.id = _machine_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Máquina não encontrada';
  END IF;

  IF NOT (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'operator')
        AND ur.laundry_id = _machine.laundry_id
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para liberar esta máquina';
  END IF;

  IF _machine.esp32_id IS NULL OR trim(_machine.esp32_id) = '' THEN
    RAISE EXCEPTION 'Máquina sem ESP32 configurado';
  END IF;

  -- Detectar se caller é somente operator (não super_admin nem admin)
  IF NOT public.is_super_admin(auth.uid())
     AND NOT public.has_role(auth.uid(), 'admin', _machine.laundry_id) THEN
    _is_operator_only := true;
  END IF;

  IF _is_operator_only THEN
    SELECT can_release, daily_limit_cents, monthly_limit_cents
    INTO _perm
    FROM public.operator_release_permissions
    WHERE user_id = auth.uid() AND laundry_id = _machine.laundry_id;

    IF NOT FOUND OR NOT _perm.can_release THEN
      RAISE EXCEPTION 'Operador sem autorização para liberar. Solicite ao gerente.';
    END IF;
  END IF;

  IF _machine.type = 'coffee' OR _machine.device_profile = 'coin_dispense' THEN
    IF _product_id IS NOT NULL THEN
      SELECT cp.*
      INTO _product
      FROM public.coffee_products cp
      WHERE cp.id = _product_id
        AND cp.machine_id = _machine.id
        AND cp.is_active = true;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Produto de café inválido';
      END IF;

      _amount := _product.price;
      _cents := ROUND(_product.price * 100)::integer;
    ELSE
      IF _valor_centavos IS NULL OR _valor_centavos <= 0 THEN
        RAISE EXCEPTION 'Informe product_id ou valor_centavos para café';
      END IF;
      _cents := _valor_centavos;
      _amount := (_valor_centavos::numeric / 100);
    END IF;

    IF _is_operator_only THEN
      SELECT COALESCE(SUM(ROUND(total_amount * 100)::INTEGER), 0) INTO _day_cents
      FROM public.transactions
      WHERE user_id = auth.uid() AND laundry_id = _machine.laundry_id
        AND payment_method = 'manual_release' AND status = 'completed'
        AND (created_at AT TIME ZONE _tz)::date = (now() AT TIME ZONE _tz)::date;
      SELECT COALESCE(SUM(ROUND(total_amount * 100)::INTEGER), 0) INTO _month_cents
      FROM public.transactions
      WHERE user_id = auth.uid() AND laundry_id = _machine.laundry_id
        AND payment_method = 'manual_release' AND status = 'completed'
        AND date_trunc('month', (created_at AT TIME ZONE _tz))
            = date_trunc('month', (now() AT TIME ZONE _tz));

      IF _perm.daily_limit_cents IS NOT NULL AND (_day_cents + _cents) > _perm.daily_limit_cents THEN
        RAISE EXCEPTION 'Limite diário atingido (R$ %/% usado hoje)',
          to_char(_day_cents::numeric/100, 'FM999999990.00'),
          to_char(_perm.daily_limit_cents::numeric/100, 'FM999999990.00');
      END IF;
      IF _perm.monthly_limit_cents IS NOT NULL AND (_month_cents + _cents) > _perm.monthly_limit_cents THEN
        RAISE EXCEPTION 'Limite mensal atingido (R$ %/% usado no mês)',
          to_char(_month_cents::numeric/100, 'FM999999990.00'),
          to_char(_perm.monthly_limit_cents::numeric/100, 'FM999999990.00');
      END IF;
    END IF;

    INSERT INTO public.transactions (
      machine_id, laundry_id, total_amount, duration_minutes, payment_method,
      user_id, coffee_product_id, status, metadata, started_at, completed_at
    )
    VALUES (
      _machine.id, _machine.laundry_id, _amount, 0, 'manual_release',
      auth.uid(), _product_id, 'completed',
      jsonb_build_object('service', 'coffee', 'remote_release', true),
      now(), now()
    )
    RETURNING id INTO _tx_id;

    INSERT INTO public.pending_commands (
      esp32_id, relay_pin, action, machine_id, transaction_id, status, payload
    )
    VALUES (
      _machine.esp32_id, 0, 'credito', _machine.id, _tx_id, 'pending',
      jsonb_build_object('valor_centavos', _cents, 'product_id', _product_id, 'remote_release', true)
    )
    RETURNING id INTO _cmd_id;

    RETURN _cmd_id;
  END IF;

  -- Lavadoras/secadoras/poltronas
  _amount := COALESCE(_machine.price_per_cycle, 0);
  _cents := ROUND(_amount * 100)::integer;

  IF _is_operator_only THEN
    SELECT COALESCE(SUM(ROUND(total_amount * 100)::INTEGER), 0) INTO _day_cents
    FROM public.transactions
    WHERE user_id = auth.uid() AND laundry_id = _machine.laundry_id
      AND payment_method = 'manual_release' AND status = 'completed'
      AND (created_at AT TIME ZONE _tz)::date = (now() AT TIME ZONE _tz)::date;
    SELECT COALESCE(SUM(ROUND(total_amount * 100)::INTEGER), 0) INTO _month_cents
    FROM public.transactions
    WHERE user_id = auth.uid() AND laundry_id = _machine.laundry_id
      AND payment_method = 'manual_release' AND status = 'completed'
      AND date_trunc('month', (created_at AT TIME ZONE _tz))
          = date_trunc('month', (now() AT TIME ZONE _tz));

    IF _perm.daily_limit_cents IS NOT NULL AND (_day_cents + _cents) > _perm.daily_limit_cents THEN
      RAISE EXCEPTION 'Limite diário atingido (R$ %/% usado hoje)',
        to_char(_day_cents::numeric/100, 'FM999999990.00'),
        to_char(_perm.daily_limit_cents::numeric/100, 'FM999999990.00');
    END IF;
    IF _perm.monthly_limit_cents IS NOT NULL AND (_month_cents + _cents) > _perm.monthly_limit_cents THEN
      RAISE EXCEPTION 'Limite mensal atingido (R$ %/% usado no mês)',
        to_char(_month_cents::numeric/100, 'FM999999990.00'),
        to_char(_perm.monthly_limit_cents::numeric/100, 'FM999999990.00');
    END IF;
  END IF;

  _audio_volumes := jsonb_strip_nulls(jsonb_build_object(
    'volume_audio_001', NULLIF(_machine.metadata->>'volume_audio_001', '')::integer,
    'volume_audio_002', NULLIF(_machine.metadata->>'volume_audio_002', '')::integer,
    'volume_audio_003', NULLIF(_machine.metadata->>'volume_audio_003', '')::integer,
    'volume_audio_004', NULLIF(_machine.metadata->>'volume_audio_004', '')::integer,
    'volume_audio_005', NULLIF(_machine.metadata->>'volume_audio_005', '')::integer,
    'volume_audio_006', NULLIF(_machine.metadata->>'volume_audio_006', '')::integer,
    'volume_audio_007', NULLIF(_machine.metadata->>'volume_audio_007', '')::integer
  ));

  INSERT INTO public.transactions (
    machine_id, laundry_id, total_amount, duration_minutes, payment_method,
    user_id, status, metadata, started_at, completed_at
  )
  VALUES (
    _machine.id, _machine.laundry_id, _amount,
    COALESCE(_machine.cycle_time_minutes, 0), 'manual_release',
    auth.uid(), 'completed',
    jsonb_build_object('service', _machine.type, 'remote_release', true),
    now(), now()
  )
  RETURNING id INTO _tx_id;

  INSERT INTO public.pending_commands (
    esp32_id, relay_pin, action, machine_id, transaction_id, status, payload
  )
  VALUES (
    _machine.esp32_id, COALESCE(_machine.relay_pin, 1), 'on',
    _machine.id, _tx_id, 'pending',
    jsonb_strip_nulls(
      jsonb_build_object(
        'cycle_time_minutes', COALESCE(_machine.cycle_time_minutes, 40),
        'remote_release', true,
        'audio_volumes', CASE WHEN _audio_volumes = '{}'::jsonb THEN NULL ELSE _audio_volumes END
      )
    )
  )
  RETURNING id INTO _cmd_id;

  UPDATE public.machines SET status = 'in_use', updated_at = now() WHERE id = _machine.id;

  RETURN _cmd_id;
END;
$function$;