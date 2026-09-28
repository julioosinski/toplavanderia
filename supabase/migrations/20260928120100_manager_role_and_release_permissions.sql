-- Perfil gerente + regras de cadastro + permissão de liberação manual.
--
-- Hierarquia por lavanderia:
--   super_admin (administrador do sistema) → tudo
--   admin (dono da lavanderia)             → cadastra gerente/operador/usuário/totem; decide liberação manual de gerentes e operadores
--   manager (gerente)                      → acessa o painel como o dono; cadastra só operador; decide liberação só de operadores
--   operator                               → libera máquinas apenas se autorizado
--
-- Liberação manual: super_admin e dono sempre podem. Gerente e operador dependem de
-- operator_release_permissions.can_release (+ limites diário/mensal).

-- ---------------------------------------------------------------------------
-- 1) Helpers de papel
-- ---------------------------------------------------------------------------

-- Semântica original de has_role (sem herança). Usar para regras exclusivas do dono.
CREATE OR REPLACE FUNCTION public.has_exact_role(_user_id uuid, _role public.app_role, _laundry_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND (_laundry_id IS NULL OR laundry_id = _laundry_id OR role = 'super_admin')
  )
$$;

-- Gerente herda o acesso de 'admin' em todas as policies existentes (painel "como o dono").
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role, _laundry_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (role = _role OR (_role = 'admin' AND role = 'manager'))
      AND (_laundry_id IS NULL OR laundry_id = _laundry_id OR role = 'super_admin')
  )
$$;

-- Quem pode atribuir/alterar/remover o papel _target_role de _target_user na lavanderia.
CREATE OR REPLACE FUNCTION public.can_manage_user_role(
  _actor uuid,
  _target_user uuid,
  _target_role public.app_role,
  _laundry_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _actor IS NULL OR _target_user IS NULL THEN false
    WHEN public.is_super_admin(_actor) THEN true
    WHEN _laundry_id IS NULL OR _target_user = _actor THEN false
    WHEN public.is_super_admin(_target_user) OR public.has_exact_role(_target_user, 'admin') THEN false
    WHEN NOT public.user_belongs_to_laundry(_target_user, _laundry_id) THEN false
    WHEN public.has_exact_role(_actor, 'admin', _laundry_id) THEN
      _target_role IN ('manager', 'operator', 'user', 'totem_device')
    WHEN public.has_exact_role(_actor, 'manager', _laundry_id) THEN
      _target_role = 'operator'
      AND NOT public.has_exact_role(_target_user, 'manager')
    ELSE false
  END
$$;

-- Quem pode ligar/desligar a liberação manual (e limites) de _target_user.
CREATE OR REPLACE FUNCTION public.can_manage_release_permission(
  _actor uuid,
  _target_user uuid,
  _laundry_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _actor IS NULL OR _target_user IS NULL OR _laundry_id IS NULL THEN false
    WHEN public.is_super_admin(_actor) THEN true
    WHEN _target_user = _actor THEN false
    WHEN public.has_exact_role(_actor, 'admin', _laundry_id) THEN
      public.has_exact_role(_target_user, 'manager', _laundry_id)
      OR public.has_exact_role(_target_user, 'operator', _laundry_id)
    WHEN public.has_exact_role(_actor, 'manager', _laundry_id) THEN
      public.has_exact_role(_target_user, 'operator', _laundry_id)
      AND NOT public.has_exact_role(_target_user, 'manager')
      AND NOT public.has_exact_role(_target_user, 'admin')
    ELSE false
  END
$$;

-- Liberação manual efetiva (sem considerar limites de valor).
CREATE OR REPLACE FUNCTION public.can_manual_release(_user_id uuid, _laundry_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _user_id IS NULL OR _laundry_id IS NULL THEN false
    WHEN public.is_super_admin(_user_id) THEN true
    WHEN public.has_exact_role(_user_id, 'admin', _laundry_id) THEN true
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = _user_id
        AND ur.laundry_id = _laundry_id
        AND ur.role IN ('manager', 'operator')
    ) THEN COALESCE((
      SELECT orp.can_release
      FROM public.operator_release_permissions orp
      WHERE orp.user_id = _user_id AND orp.laundry_id = _laundry_id
    ), false)
    ELSE false
  END
$$;

REVOKE EXECUTE ON FUNCTION public.has_exact_role(uuid, public.app_role, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_user_role(uuid, uuid, public.app_role, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_manage_release_permission(uuid, uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_manual_release(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_manage_user_role(uuid, uuid, public.app_role, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_release_permission(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manual_release(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) user_roles: cadastro só por super_admin, dono e gerente (com escopo)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can insert roles in scope" ON public.user_roles;
CREATE POLICY "Admins can insert roles in scope"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_manage_user_role((SELECT auth.uid()), user_id, role, laundry_id)
);

DROP POLICY IF EXISTS "Admins can update roles in scope" ON public.user_roles;
CREATE POLICY "Admins can update roles in scope"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  public.can_manage_user_role((SELECT auth.uid()), user_id, role, laundry_id)
)
WITH CHECK (
  public.can_manage_user_role((SELECT auth.uid()), user_id, role, laundry_id)
);

DROP POLICY IF EXISTS "Admins can delete roles in scope" ON public.user_roles;
CREATE POLICY "Admins can delete roles in scope"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  public.can_manage_user_role((SELECT auth.uid()), user_id, role, laundry_id)
);

-- ---------------------------------------------------------------------------
-- 3) operator_release_permissions: dono → gerentes e operadores; gerente → operadores
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Operator can view own permission" ON public.operator_release_permissions;
CREATE POLICY "Operator can view own permission"
ON public.operator_release_permissions
FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR public.is_super_admin((SELECT auth.uid()))
  OR public.has_role((SELECT auth.uid()), 'admin', laundry_id)
);

DROP POLICY IF EXISTS "Admin/super admin manage permissions" ON public.operator_release_permissions;
CREATE POLICY "Scoped managers insert release permissions"
ON public.operator_release_permissions
FOR INSERT TO authenticated
WITH CHECK (
  public.can_manage_release_permission((SELECT auth.uid()), user_id, laundry_id)
);

CREATE POLICY "Scoped managers update release permissions"
ON public.operator_release_permissions
FOR UPDATE TO authenticated
USING (
  public.can_manage_release_permission((SELECT auth.uid()), user_id, laundry_id)
)
WITH CHECK (
  public.can_manage_release_permission((SELECT auth.uid()), user_id, laundry_id)
);

CREATE POLICY "Scoped managers delete release permissions"
ON public.operator_release_permissions
FOR DELETE TO authenticated
USING (
  public.can_manage_release_permission((SELECT auth.uid()), user_id, laundry_id)
);

-- ---------------------------------------------------------------------------
-- 4) Bloquear atalhos que contornariam a permissão de liberação
-- ---------------------------------------------------------------------------

-- Fila do ESP32: só RPCs SECURITY DEFINER / service_role, super_admin e dono.
DROP POLICY IF EXISTS "Admins can insert pending commands for own laundry" ON public.pending_commands;
CREATE POLICY "Admins can insert pending commands for own laundry"
ON public.pending_commands
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin((SELECT auth.uid()))
  OR (
    public.has_exact_role((SELECT auth.uid()), 'admin'::public.app_role)
    AND machine_id IN (
      SELECT m.id FROM public.machines m
      WHERE m.laundry_id = public.get_user_laundry_id((SELECT auth.uid()))
    )
  )
);

DROP POLICY IF EXISTS "Admins can update pending commands for own laundry" ON public.pending_commands;
CREATE POLICY "Admins can update pending commands for own laundry"
ON public.pending_commands
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin((SELECT auth.uid()))
  OR (
    public.has_exact_role((SELECT auth.uid()), 'admin'::public.app_role)
    AND machine_id IN (
      SELECT m.id FROM public.machines m
      WHERE m.laundry_id = public.get_user_laundry_id((SELECT auth.uid()))
    )
  )
);

-- Transação 'manual_release' só nasce via admin_remote_release (SECURITY DEFINER).
DROP POLICY IF EXISTS "Authenticated users can create transactions" ON public.transactions;
CREATE POLICY "Authenticated users can create transactions"
ON public.transactions FOR INSERT
WITH CHECK (
  public.is_super_admin((SELECT auth.uid()))
  OR (
    payment_method IS DISTINCT FROM 'manual_release'
    AND laundry_id = public.get_user_laundry_id((SELECT auth.uid()))
    AND (
      user_id = (SELECT auth.uid())
      OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
      OR public.has_role((SELECT auth.uid()), 'operator'::public.app_role)
    )
  )
);

-- ---------------------------------------------------------------------------
-- 5) Policies com checagem direta de papel: incluir gerente
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins manage coffee products for their laundry" ON public.coffee_products;
CREATE POLICY "Admins manage coffee products for their laundry"
  ON public.coffee_products
  FOR ALL
  TO authenticated
  USING (
    public.is_super_admin((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('admin', 'manager', 'operator')
        AND ur.laundry_id = coffee_products.laundry_id
    )
  )
  WITH CHECK (
    public.is_super_admin((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('admin', 'manager', 'operator')
        AND ur.laundry_id = coffee_products.laundry_id
    )
  );

DROP POLICY IF EXISTS "Admins manage payment terminals for their laundry" ON public.payment_terminals;
CREATE POLICY "Admins manage payment terminals for their laundry"
  ON public.payment_terminals
  FOR ALL
  TO authenticated
  USING (
    public.is_super_admin((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('admin', 'manager', 'operator')
        AND ur.laundry_id = payment_terminals.laundry_id
    )
  )
  WITH CHECK (
    public.is_super_admin((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('admin', 'manager', 'operator')
        AND ur.laundry_id = payment_terminals.laundry_id
    )
  );

DROP POLICY IF EXISTS "Admins read payment sessions for their laundry" ON public.payment_sessions;
CREATE POLICY "Admins read payment sessions for their laundry"
  ON public.payment_sessions
  FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('admin', 'manager', 'operator')
        AND ur.laundry_id = payment_sessions.laundry_id
    )
  );

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
        AND ur.role IN ('admin', 'manager', 'operator')
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

-- ---------------------------------------------------------------------------
-- 6) admin_remote_release: gerente aceito como chamador, sujeito à permissão e limites
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_remote_release(
  _machine_id uuid,
  _product_id uuid DEFAULT NULL::uuid,
  _valor_centavos integer DEFAULT NULL::integer
)
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
  _needs_permission boolean := false;
  _perm RECORD;
  _day_cents integer := 0;
  _month_cents integer := 0;
  _tz text := 'America/Sao_Paulo';
  _relay integer;
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

  IF _machine.status = 'maintenance' THEN
    RAISE EXCEPTION 'Máquina em manutenção';
  END IF;

  IF NOT (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'manager', 'operator')
        AND ur.laundry_id = _machine.laundry_id
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para liberar esta máquina';
  END IF;

  IF _machine.esp32_id IS NULL OR trim(_machine.esp32_id) = '' THEN
    RAISE EXCEPTION 'Máquina sem ESP32 configurado';
  END IF;

  -- Só super_admin e dono liberam sem autorização explícita.
  IF NOT public.is_super_admin(auth.uid())
     AND NOT public.has_exact_role(auth.uid(), 'admin', _machine.laundry_id) THEN
    _needs_permission := true;
  END IF;

  IF _needs_permission THEN
    SELECT can_release, daily_limit_cents, monthly_limit_cents
    INTO _perm
    FROM public.operator_release_permissions
    WHERE user_id = auth.uid() AND laundry_id = _machine.laundry_id;

    IF NOT FOUND OR NOT _perm.can_release THEN
      RAISE EXCEPTION 'Liberação manual não autorizada para este usuário. Solicite ao dono da lavanderia.';
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
  ELSE
    _amount := COALESCE(_machine.price_per_cycle, 0);
    _cents := ROUND(_amount * 100)::integer;
  END IF;

  IF _needs_permission THEN
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

  IF _machine.type = 'coffee' OR _machine.device_profile = 'coin_dispense' THEN
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

  _relay := COALESCE(_machine.relay_pin, 1);

  _audio_volumes := jsonb_strip_nulls(jsonb_build_object(
    'volume_audio_001', CASE WHEN (_machine.metadata->>'volume_audio_001') ~ '^[0-9]+$' THEN (_machine.metadata->>'volume_audio_001')::integer ELSE NULL END,
    'volume_audio_002', CASE WHEN (_machine.metadata->>'volume_audio_002') ~ '^[0-9]+$' THEN (_machine.metadata->>'volume_audio_002')::integer ELSE NULL END,
    'volume_audio_003', CASE WHEN (_machine.metadata->>'volume_audio_003') ~ '^[0-9]+$' THEN (_machine.metadata->>'volume_audio_003')::integer ELSE NULL END,
    'volume_audio_004', CASE WHEN (_machine.metadata->>'volume_audio_004') ~ '^[0-9]+$' THEN (_machine.metadata->>'volume_audio_004')::integer ELSE NULL END,
    'volume_audio_005', CASE WHEN (_machine.metadata->>'volume_audio_005') ~ '^[0-9]+$' THEN (_machine.metadata->>'volume_audio_005')::integer ELSE NULL END,
    'volume_audio_006', CASE WHEN (_machine.metadata->>'volume_audio_006') ~ '^[0-9]+$' THEN (_machine.metadata->>'volume_audio_006')::integer ELSE NULL END,
    'volume_audio_007', CASE WHEN (_machine.metadata->>'volume_audio_007') ~ '^[0-9]+$' THEN (_machine.metadata->>'volume_audio_007')::integer ELSE NULL END
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

  UPDATE public.pending_commands
  SET
    status = 'failed',
    error_message = COALESCE(error_message, 'cancelled_before_new_on'),
    updated_at = now()
  WHERE esp32_id = _machine.esp32_id
    AND status = 'pending'
    AND action = 'off'
    AND (
      machine_id = _machine.id
      OR relay_pin = _relay
    );

  INSERT INTO public.pending_commands (
    esp32_id, relay_pin, action, machine_id, transaction_id, status, payload
  )
  VALUES (
    _machine.esp32_id, _relay, 'on',
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

  UPDATE public.machines
  SET status = 'in_use', updated_at = now()
  WHERE id = _machine.id
    AND status IS DISTINCT FROM 'maintenance';

  RETURN _cmd_id;
END;
$function$;
