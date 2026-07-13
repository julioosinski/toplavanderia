-- Permite enfileirar crédito de café mesmo se a TX já foi marcada completed
-- (bug histórico do totem: complete antes de enqueue). Evita comandos duplicados.

CREATE OR REPLACE FUNCTION public.enqueue_coffee_credit_command(
  _transaction_id uuid,
  _laundry_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tx RECORD;
  _machine RECORD;
  _valor_centavos integer;
  _product_name text;
  _existing_cmd uuid;
BEGIN
  SELECT
    t.id,
    t.machine_id,
    t.total_amount,
    t.coffee_product_id,
    t.status,
    cp.name AS product_name
  INTO _tx
  FROM public.transactions t
  LEFT JOIN public.coffee_products cp ON cp.id = t.coffee_product_id
  WHERE t.id = _transaction_id
    AND t.laundry_id = _laundry_id
    AND t.status IN ('pending', 'completed')
    AND t.coffee_product_id IS NOT NULL;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Idempotência: se já existe comando credito para esta TX, reutiliza.
  SELECT id INTO _existing_cmd
  FROM public.pending_commands
  WHERE transaction_id = _transaction_id
    AND action = 'credito'
    AND status IN ('pending', 'completed')
  ORDER BY created_at DESC
  LIMIT 1;

  IF _existing_cmd IS NOT NULL THEN
    RETURN true;
  END IF;

  SELECT m.id, m.esp32_id, m.type
  INTO _machine
  FROM public.machines m
  WHERE m.id = _tx.machine_id AND m.type = 'coffee';

  IF NOT FOUND OR _machine.esp32_id IS NULL OR trim(_machine.esp32_id) = '' THEN
    RAISE EXCEPTION 'Máquina de café sem ESP32 configurado.';
  END IF;

  _valor_centavos := ROUND(_tx.total_amount * 100)::integer;
  _product_name := COALESCE(_tx.product_name, 'Café');

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
    _tx.machine_id,
    _transaction_id,
    'pending',
    jsonb_build_object(
      'valor_centavos', _valor_centavos,
      'product_id', _tx.coffee_product_id,
      'product_name', _product_name
    )
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_coffee_credit_command(uuid, uuid) TO anon, authenticated;
