-- Inclui volumes de áudio da poltrona no payload de comandos "on"
-- para permitir ajuste em runtime sem regravar firmware.

CREATE OR REPLACE FUNCTION public.admin_remote_release(
  _machine_id uuid,
  _product_id uuid DEFAULT NULL,
  _valor_centavos integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _machine RECORD;
  _product RECORD;
  _cmd_id uuid;
  _amount numeric;
  _cents integer;
  _tx_id uuid;
  _audio_volumes jsonb;
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

    INSERT INTO public.transactions (
      machine_id,
      laundry_id,
      total_amount,
      duration_minutes,
      payment_method,
      user_id,
      coffee_product_id,
      status,
      metadata,
      started_at,
      completed_at
    )
    VALUES (
      _machine.id,
      _machine.laundry_id,
      _amount,
      0,
      'manual_release',
      auth.uid(),
      _product_id,
      'completed',
      jsonb_build_object('service', 'coffee', 'remote_release', true),
      now(),
      now()
    )
    RETURNING id INTO _tx_id;

    INSERT INTO public.pending_commands (
      esp32_id,
      relay_pin,
      action,
      machine_id,
      transaction_id,
      status,
      payload
    )
    VALUES (
      _machine.esp32_id,
      0,
      'credito',
      _machine.id,
      _tx_id,
      'pending',
      jsonb_build_object(
        'valor_centavos', _cents,
        'product_id', _product_id,
        'remote_release', true
      )
    )
    RETURNING id INTO _cmd_id;

    RETURN _cmd_id;
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

  -- Lavadoras, secadoras e poltronas: relé ON
  INSERT INTO public.transactions (
    machine_id,
    laundry_id,
    total_amount,
    duration_minutes,
    payment_method,
    user_id,
    status,
    metadata,
    started_at,
    completed_at
  )
  VALUES (
    _machine.id,
    _machine.laundry_id,
    COALESCE(_machine.price_per_cycle, 0),
    COALESCE(_machine.cycle_time_minutes, 0),
    'manual_release',
    auth.uid(),
    'completed',
    jsonb_build_object('service', _machine.type, 'remote_release', true),
    now(),
    now()
  )
  RETURNING id INTO _tx_id;

  INSERT INTO public.pending_commands (
    esp32_id,
    relay_pin,
    action,
    machine_id,
    transaction_id,
    status,
    payload
  )
  VALUES (
    _machine.esp32_id,
    COALESCE(_machine.relay_pin, 1),
    'on',
    _machine.id,
    _tx_id,
    'pending',
    jsonb_strip_nulls(
      jsonb_build_object(
        'cycle_time_minutes', COALESCE(_machine.cycle_time_minutes, 40),
        'remote_release', true,
        'audio_volumes', CASE
          WHEN _audio_volumes = '{}'::jsonb THEN NULL
          ELSE _audio_volumes
        END
      )
    )
  )
  RETURNING id INTO _cmd_id;

  UPDATE public.machines
  SET status = 'running', updated_at = now()
  WHERE id = _machine.id;

  RETURN _cmd_id;
END;
$$;
