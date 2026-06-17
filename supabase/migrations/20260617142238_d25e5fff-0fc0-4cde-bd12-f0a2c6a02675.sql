
-- 1) user_credits SELECT: split into own row OR admin/operator/super_admin in laundry
DROP POLICY IF EXISTS "View credits based on role" ON public.user_credits;
CREATE POLICY "View credits based on role"
ON public.user_credits FOR SELECT
USING (
  (SELECT auth.uid()) = user_id
  OR public.is_super_admin((SELECT auth.uid()))
  OR (
    (public.has_role((SELECT auth.uid()), 'admin'::app_role)
     OR public.has_role((SELECT auth.uid()), 'operator'::app_role))
    AND laundry_id = public.get_user_laundry_id((SELECT auth.uid()))
  )
);

-- 2) transactions SELECT: restrict laundry-wide read to admin/operator
DROP POLICY IF EXISTS "View transactions based on role" ON public.transactions;
CREATE POLICY "View transactions based on role"
ON public.transactions FOR SELECT
USING (
  (SELECT auth.uid()) = user_id
  OR public.is_super_admin((SELECT auth.uid()))
  OR (
    (public.has_role((SELECT auth.uid()), 'admin'::app_role)
     OR public.has_role((SELECT auth.uid()), 'operator'::app_role))
    AND laundry_id = public.get_user_laundry_id((SELECT auth.uid()))
  )
);

-- 3) transactions INSERT: require user_id = auth.uid() OR admin/operator in laundry
DROP POLICY IF EXISTS "Authenticated users can create transactions" ON public.transactions;
CREATE POLICY "Authenticated users can create transactions"
ON public.transactions FOR INSERT
WITH CHECK (
  public.is_super_admin((SELECT auth.uid()))
  OR (
    user_id = (SELECT auth.uid())
    AND laundry_id = public.get_user_laundry_id((SELECT auth.uid()))
  )
  OR (
    (public.has_role((SELECT auth.uid()), 'admin'::app_role)
     OR public.has_role((SELECT auth.uid()), 'operator'::app_role))
    AND laundry_id = public.get_user_laundry_id((SELECT auth.uid()))
  )
);

-- 4) audit_logs SELECT: drop sensitive table_name cross-laundry branch
DROP POLICY IF EXISTS "View audit logs based on role" ON public.audit_logs;
CREATE POLICY "View audit logs based on role"
ON public.audit_logs FOR SELECT
USING (
  public.is_super_admin((SELECT auth.uid()))
  OR (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    AND user_id IN (
      SELECT ur.user_id FROM public.user_roles ur
      WHERE ur.laundry_id = public.get_user_laundry_id((SELECT auth.uid()))
    )
  )
);

-- 5) get_totem_settings: remove Cielo credentials from public RPC
CREATE OR REPLACE FUNCTION public.get_totem_settings(_laundry_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'paygo_enabled', paygo_enabled,
    'paygo_host', paygo_host,
    'paygo_port', paygo_port,
    'paygo_timeout', paygo_timeout,
    'paygo_retry_attempts', paygo_retry_attempts,
    'paygo_retry_delay', paygo_retry_delay,
    'paygo_provedor', paygo_provedor,
    'default_cycle_time', default_cycle_time,
    'default_price', default_price,
    'auto_mode', auto_mode,
    'enable_esp32_monitoring', enable_esp32_monitoring,
    'heartbeat_interval_seconds', heartbeat_interval_seconds,
    'cielo_environment', cielo_environment
  )
  FROM public.system_settings
  WHERE laundry_id = _laundry_id
  LIMIT 1
$function$;
