
-- 1) system_settings: restrict SELECT to admins (contains payment/WiFi creds)
DROP POLICY IF EXISTS "View settings in own laundry" ON public.system_settings;
CREATE POLICY "Admins view settings in own laundry"
ON public.system_settings
FOR SELECT
TO authenticated
USING (
  public.is_super_admin((SELECT auth.uid()))
  OR (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    AND laundry_id = public.get_user_laundry_id((SELECT auth.uid()))
  )
);

-- Also restrict INSERT/UPDATE/DELETE to admins (was already laundry-scoped, now admin-only)
DROP POLICY IF EXISTS "Manage settings in own laundry" ON public.system_settings;
DROP POLICY IF EXISTS "Update settings in own laundry" ON public.system_settings;
DROP POLICY IF EXISTS "Delete settings in own laundry" ON public.system_settings;

CREATE POLICY "Admins insert settings in own laundry"
ON public.system_settings
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin((SELECT auth.uid()))
  OR (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    AND laundry_id = public.get_user_laundry_id((SELECT auth.uid()))
  )
);

CREATE POLICY "Admins update settings in own laundry"
ON public.system_settings
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin((SELECT auth.uid()))
  OR (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    AND laundry_id = public.get_user_laundry_id((SELECT auth.uid()))
  )
)
WITH CHECK (
  public.is_super_admin((SELECT auth.uid()))
  OR (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    AND laundry_id = public.get_user_laundry_id((SELECT auth.uid()))
  )
);

CREATE POLICY "Admins delete settings in own laundry"
ON public.system_settings
FOR DELETE
TO authenticated
USING (
  public.is_super_admin((SELECT auth.uid()))
  OR (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    AND laundry_id = public.get_user_laundry_id((SELECT auth.uid()))
  )
);

-- 2) pending_commands: scope SELECT by laundry via machine_id
DROP POLICY IF EXISTS "Admins can view pending commands" ON public.pending_commands;
CREATE POLICY "Admins can view pending commands for own laundry"
ON public.pending_commands
FOR SELECT
TO authenticated
USING (
  public.is_super_admin((SELECT auth.uid()))
  OR (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    AND machine_id IN (
      SELECT m.id FROM public.machines m
      WHERE m.laundry_id = public.get_user_laundry_id((SELECT auth.uid()))
    )
  )
);

-- 3) user_credits: restrict INSERT (and UPDATE/DELETE) to admins
DROP POLICY IF EXISTS "Manage credits in own laundry" ON public.user_credits;
CREATE POLICY "Admins manage credits in own laundry"
ON public.user_credits
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin((SELECT auth.uid()))
  OR (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    AND laundry_id = public.get_user_laundry_id((SELECT auth.uid()))
  )
);

CREATE POLICY "Admins update credits in own laundry"
ON public.user_credits
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin((SELECT auth.uid()))
  OR (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    AND laundry_id = public.get_user_laundry_id((SELECT auth.uid()))
  )
)
WITH CHECK (
  public.is_super_admin((SELECT auth.uid()))
  OR (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    AND laundry_id = public.get_user_laundry_id((SELECT auth.uid()))
  )
);

CREATE POLICY "Admins delete credits in own laundry"
ON public.user_credits
FOR DELETE
TO authenticated
USING (
  public.is_super_admin((SELECT auth.uid()))
  OR (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    AND laundry_id = public.get_user_laundry_id((SELECT auth.uid()))
  )
);

-- 4) user_roles: prevent admin from granting roles to users outside their laundry.
-- Helper: returns true if the target user already has any role tied to the given laundry.
CREATE OR REPLACE FUNCTION public.user_belongs_to_laundry(_user_id uuid, _laundry_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND laundry_id = _laundry_id
  );
$$;
REVOKE EXECUTE ON FUNCTION public.user_belongs_to_laundry(uuid, uuid) FROM anon;

DROP POLICY IF EXISTS "Admins can insert roles in scope" ON public.user_roles;
CREATE POLICY "Admins can insert roles in scope"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin((SELECT auth.uid()))
  OR (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    AND laundry_id = public.get_user_laundry_id((SELECT auth.uid()))
    AND role <> 'super_admin'::app_role
    AND role <> 'admin'::app_role  -- prevent admin self-promotion of others to admin
    AND public.user_belongs_to_laundry(user_id, laundry_id)
  )
);

DROP POLICY IF EXISTS "Admins can update roles in scope" ON public.user_roles;
CREATE POLICY "Admins can update roles in scope"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin((SELECT auth.uid()))
  OR (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    AND laundry_id = public.get_user_laundry_id((SELECT auth.uid()))
    AND role <> 'super_admin'::app_role
    AND role <> 'admin'::app_role
    AND public.user_belongs_to_laundry(user_id, laundry_id)
  )
)
WITH CHECK (
  public.is_super_admin((SELECT auth.uid()))
  OR (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    AND laundry_id = public.get_user_laundry_id((SELECT auth.uid()))
    AND role <> 'super_admin'::app_role
    AND role <> 'admin'::app_role
    AND public.user_belongs_to_laundry(user_id, laundry_id)
  )
);

-- 5) esp32_status: restrict INSERT/UPDATE to admins
DROP POLICY IF EXISTS "Admins can insert esp32_status" ON public.esp32_status;
CREATE POLICY "Admins can insert esp32_status"
ON public.esp32_status
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin((SELECT auth.uid()))
  OR (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    AND laundry_id = public.get_user_laundry_id((SELECT auth.uid()))
  )
);

DROP POLICY IF EXISTS "Admins can update esp32_status" ON public.esp32_status;
CREATE POLICY "Admins can update esp32_status"
ON public.esp32_status
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin((SELECT auth.uid()))
  OR (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    AND laundry_id = public.get_user_laundry_id((SELECT auth.uid()))
  )
);

-- 6) transactions: restrict UPDATE to admins (totem flows use SECURITY DEFINER RPC or service_role)
DROP POLICY IF EXISTS "Manage transactions in own laundry" ON public.transactions;
CREATE POLICY "Admins manage transactions in own laundry"
ON public.transactions
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin((SELECT auth.uid()))
  OR (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    AND laundry_id = public.get_user_laundry_id((SELECT auth.uid()))
  )
)
WITH CHECK (
  public.is_super_admin((SELECT auth.uid()))
  OR (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    AND laundry_id = public.get_user_laundry_id((SELECT auth.uid()))
  )
);
