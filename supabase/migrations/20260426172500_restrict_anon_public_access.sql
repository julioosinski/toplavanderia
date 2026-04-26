CREATE OR REPLACE FUNCTION public.get_laundry_by_id(_laundry_id uuid)
RETURNS TABLE(id uuid, name text, cnpj text, logo_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id, l.name, l.cnpj, l.logo_url
  FROM public.laundries l
  WHERE l.id = _laundry_id
    AND l.is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_public_machines(_laundry_id uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  name text,
  type text,
  price_per_cycle numeric,
  cycle_time_minutes integer,
  status text,
  laundry_id uuid,
  esp32_id text,
  relay_pin integer,
  location text,
  capacity_kg numeric,
  temperature integer,
  last_maintenance date,
  updated_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id,
    m.name,
    m.type,
    m.price_per_cycle,
    m.cycle_time_minutes,
    m.status,
    m.laundry_id,
    m.esp32_id,
    m.relay_pin,
    m.location,
    m.capacity_kg,
    m.temperature,
    m.last_maintenance,
    m.updated_at
  FROM public.machines m
  JOIN public.laundries l ON l.id = m.laundry_id
  WHERE l.is_active = true
    AND (_laundry_id IS NULL OR m.laundry_id = _laundry_id)
  ORDER BY m.name;
$$;

CREATE OR REPLACE FUNCTION public.create_totem_transaction(
  _machine_id uuid,
  _total_amount numeric,
  _duration_minutes integer,
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
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.machines m
    JOIN public.laundries l ON l.id = m.laundry_id
    WHERE m.id = _machine_id
      AND m.laundry_id = _laundry_id
      AND l.is_active = true
  ) THEN
    RAISE EXCEPTION 'Máquina inválida para a lavanderia informada.';
  END IF;

  INSERT INTO public.transactions (
    machine_id,
    total_amount,
    duration_minutes,
    status,
    payment_method,
    laundry_id,
    started_at
  )
  VALUES (
    _machine_id,
    _total_amount,
    _duration_minutes,
    'pending',
    _payment_method,
    _laundry_id,
    now()
  )
  RETURNING id INTO _transaction_id;

  RETURN _transaction_id;
END;
$$;

REVOKE ALL ON TABLE public.admin_config FROM anon;
REVOKE ALL ON TABLE public.audit_logs FROM anon;
REVOKE ALL ON TABLE public.authorized_devices FROM anon;
REVOKE ALL ON TABLE public.esp32_status FROM anon;
REVOKE ALL ON TABLE public.laundries FROM anon;
REVOKE ALL ON TABLE public.machine_status_view FROM anon;
REVOKE ALL ON TABLE public.machines FROM anon;
REVOKE ALL ON TABLE public.pending_commands FROM anon;
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.public_machines FROM anon;
REVOKE ALL ON TABLE public.security_events FROM anon;
REVOKE ALL ON TABLE public.system_settings FROM anon;
REVOKE ALL ON TABLE public.transactions FROM anon;
REVOKE ALL ON TABLE public.user_credits FROM anon;
REVOKE ALL ON TABLE public.user_roles FROM anon;

ALTER VIEW public.public_machines SET (security_invoker = on);

GRANT EXECUTE ON FUNCTION public.get_laundry_by_id(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_machines(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_totem_transaction(uuid, numeric, integer, text, uuid) TO anon;
