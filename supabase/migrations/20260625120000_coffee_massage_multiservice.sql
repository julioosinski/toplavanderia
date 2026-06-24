-- Totem multi-serviço: café (moedeiro simulado) + poltrona de massagem + tipos extras em machines

-- ---------------------------------------------------------------------------
-- machines: novos tipos e perfis de dispositivo
-- ---------------------------------------------------------------------------
ALTER TABLE public.machines DROP CONSTRAINT IF EXISTS machines_type_check;
ALTER TABLE public.machines ADD CONSTRAINT machines_type_check
  CHECK (type IN ('washing', 'drying', 'massage', 'coffee'));

ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS device_profile TEXT NOT NULL DEFAULT 'credit_pulse'
    CHECK (device_profile IN ('credit_pulse', 'timed_session', 'coin_dispense'));

ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.machines.device_profile IS
  'credit_pulse=lavadora/secadora (relé 1s); timed_session=poltrona; coin_dispense=café (pulsos moedeiro)';

UPDATE public.machines SET device_profile = 'credit_pulse'
WHERE device_profile IS NULL OR device_profile = '';

UPDATE public.machines SET device_profile = 'timed_session' WHERE type = 'massage';
UPDATE public.machines SET device_profile = 'coin_dispense' WHERE type = 'coffee';

-- ---------------------------------------------------------------------------
-- transactions: referência opcional ao produto de café
-- ---------------------------------------------------------------------------
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS coffee_product_id UUID;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- coffee_products
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coffee_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laundry_id UUID NOT NULL REFERENCES public.laundries(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coffee_products_laundry_active
  ON public.coffee_products (laundry_id, is_active, sort_order);

ALTER TABLE public.coffee_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage coffee products for their laundry"
  ON public.coffee_products
  FOR ALL
  TO authenticated
  USING (
    public.is_super_admin((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('admin', 'operator')
        AND ur.laundry_id = coffee_products.laundry_id
    )
  )
  WITH CHECK (
    public.is_super_admin((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('admin', 'operator')
        AND ur.laundry_id = coffee_products.laundry_id
    )
  );

CREATE POLICY "Super admins read all coffee products"
  ON public.coffee_products
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin((SELECT auth.uid())));

REVOKE ALL ON TABLE public.coffee_products FROM anon;

CREATE TRIGGER update_coffee_products_updated_at
  BEFORE UPDATE ON public.coffee_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_coffee_product_id_fkey;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_coffee_product_id_fkey
  FOREIGN KEY (coffee_product_id) REFERENCES public.coffee_products(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- pending_commands: ação credito + payload JSON
-- ---------------------------------------------------------------------------
ALTER TABLE public.pending_commands DROP CONSTRAINT IF EXISTS pending_commands_action_check;
ALTER TABLE public.pending_commands ADD CONSTRAINT pending_commands_action_check
  CHECK (action IN ('on', 'off', 'credito'));

ALTER TABLE public.pending_commands
  ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.pending_commands
  ALTER COLUMN relay_pin DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- RPC: cardápio público de café (totem anon)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_coffee_products(_laundry_id uuid)
RETURNS TABLE(
  id uuid,
  name text,
  price numeric,
  price_cents integer,
  machine_id uuid,
  sort_order integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cp.id,
    cp.name,
    cp.price,
    ROUND(cp.price * 100)::integer AS price_cents,
    cp.machine_id,
    cp.sort_order
  FROM public.coffee_products cp
  JOIN public.laundries l ON l.id = cp.laundry_id
  JOIN public.machines m ON m.id = cp.machine_id
  WHERE cp.laundry_id = _laundry_id
    AND cp.is_active = true
    AND l.is_active = true
    AND m.type = 'coffee'
  ORDER BY cp.sort_order ASC, cp.name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_coffee_products(uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: criar transação pending para produto de café
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_totem_coffee_transaction(
  _product_id uuid,
  _payment_method text,
  _laundry_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _transaction_id uuid;
  _machine_id uuid;
  _price numeric;
  _product_name text;
BEGIN
  SELECT cp.machine_id, cp.price, cp.name
  INTO _machine_id, _price, _product_name
  FROM public.coffee_products cp
  JOIN public.laundries l ON l.id = cp.laundry_id
  JOIN public.machines m ON m.id = cp.machine_id
  WHERE cp.id = _product_id
    AND cp.laundry_id = _laundry_id
    AND cp.is_active = true
    AND l.is_active = true
    AND m.type = 'coffee';

  IF _machine_id IS NULL THEN
    RAISE EXCEPTION 'Produto de café inválido para a lavanderia informada.';
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
    _machine_id,
    _price,
    0,
    'pending',
    _payment_method,
    _laundry_id,
    _product_id,
    jsonb_build_object('product_name', _product_name, 'service', 'coffee'),
    now()
  )
  RETURNING id INTO _transaction_id;

  RETURN _transaction_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_totem_coffee_transaction(uuid, text, uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: enfileirar crédito de café após pagamento (totem anon)
-- ---------------------------------------------------------------------------
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
BEGIN
  SELECT
    t.id,
    t.machine_id,
    t.total_amount,
    t.coffee_product_id,
    cp.name AS product_name
  INTO _tx
  FROM public.transactions t
  LEFT JOIN public.coffee_products cp ON cp.id = t.coffee_product_id
  WHERE t.id = _transaction_id
    AND t.laundry_id = _laundry_id
    AND t.status = 'pending';

  IF NOT FOUND THEN
    RETURN false;
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

-- ---------------------------------------------------------------------------
-- RPC: liberação remota admin (massagem / café / lavanderia)
-- ---------------------------------------------------------------------------
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
    jsonb_build_object(
      'cycle_time_minutes', COALESCE(_machine.cycle_time_minutes, 40),
      'remote_release', true
    )
  )
  RETURNING id INTO _cmd_id;

  UPDATE public.machines
  SET status = 'running', updated_at = now()
  WHERE id = _machine.id;

  RETURN _cmd_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_remote_release(uuid, uuid, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- Seed Sinuelo: máquina de café + cardápio
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  _laundry_id uuid := '8ace0bcb-83a9-4555-a712-63ef5f52e709';
  _coffee_machine_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.laundries WHERE id = _laundry_id) THEN
    RAISE NOTICE 'Lavanderia Sinuelo não encontrada; seed café ignorado';
    RETURN;
  END IF;

  SELECT id INTO _coffee_machine_id
  FROM public.machines
  WHERE laundry_id = _laundry_id AND type = 'coffee'
  LIMIT 1;

  IF _coffee_machine_id IS NULL THEN
    INSERT INTO public.machines (
      laundry_id,
      name,
      type,
      device_profile,
      status,
      price_per_cycle,
      cycle_time_minutes,
      capacity_kg,
      location,
      metadata
    )
    VALUES (
      _laundry_id,
      'Máquina de Café',
      'coffee',
      'coin_dispense',
      'available',
      0,
      0,
      0,
      'Recepção',
      '{"seed": "sinuelo_coffee"}'::jsonb
    )
    RETURNING id INTO _coffee_machine_id;
  END IF;

  INSERT INTO public.coffee_products (laundry_id, machine_id, name, price, sort_order)
  SELECT _laundry_id, _coffee_machine_id, v.name, v.price, v.ord
  FROM (VALUES
    ('Café curto', 6.00::numeric, 1),
    ('Café longo', 6.00::numeric, 2),
    ('Café com leite', 7.00::numeric, 3),
    ('Chocolate', 8.00::numeric, 4),
    ('Mocaccino', 8.50::numeric, 5),
    ('Cappuccino', 8.50::numeric, 6)
  ) AS v(name, price, ord)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.coffee_products cp
    WHERE cp.laundry_id = _laundry_id AND cp.name = v.name
  );
END $$;
