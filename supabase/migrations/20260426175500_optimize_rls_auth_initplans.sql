DROP POLICY IF EXISTS "Only super admins can update admin config" ON public.admin_config;
DROP POLICY IF EXISTS "Only super admins can view admin config" ON public.admin_config;
DROP POLICY IF EXISTS "View audit logs based on role" ON public.audit_logs;
DROP POLICY IF EXISTS "Manage devices in own laundry" ON public.authorized_devices;
DROP POLICY IF EXISTS "View devices based on role" ON public.authorized_devices;
DROP POLICY IF EXISTS "Admins can insert esp32_status" ON public.esp32_status;
DROP POLICY IF EXISTS "Admins can update esp32_status" ON public.esp32_status;
DROP POLICY IF EXISTS "esp32_select_scoped" ON public.esp32_status;
DROP POLICY IF EXISTS "Admins can view their own laundry" ON public.laundries;
DROP POLICY IF EXISTS "Only super admins can manage laundries" ON public.laundries;
DROP POLICY IF EXISTS "Super admins can view all laundries" ON public.laundries;
DROP POLICY IF EXISTS "Manage machines in own laundry" ON public.machines;
DROP POLICY IF EXISTS "View machines based on role" ON public.machines;
DROP POLICY IF EXISTS "Admins can insert pending commands for own laundry" ON public.pending_commands;
DROP POLICY IF EXISTS "Admins can update pending commands for own laundry" ON public.pending_commands;
DROP POLICY IF EXISTS "Admins can view pending commands" ON public.pending_commands;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Update security events scoped" ON public.security_events;
DROP POLICY IF EXISTS "View security events based on role" ON public.security_events;
DROP POLICY IF EXISTS "Manage settings in own laundry" ON public.system_settings;
DROP POLICY IF EXISTS "Only admins can view settings" ON public.system_settings;
DROP POLICY IF EXISTS "Authenticated users can create transactions" ON public.transactions;
DROP POLICY IF EXISTS "Manage transactions in own laundry" ON public.transactions;
DROP POLICY IF EXISTS "Totem anon can create transactions" ON public.transactions;
DROP POLICY IF EXISTS "View transactions based on role" ON public.transactions;
DROP POLICY IF EXISTS "Manage credits in own laundry" ON public.user_credits;
DROP POLICY IF EXISTS "View credits based on role" ON public.user_credits;
DROP POLICY IF EXISTS "Admins can manage roles in their laundry" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Only super admins can update admin config"
ON public.admin_config
FOR UPDATE
TO authenticated
USING (public.is_super_admin((select auth.uid())));

CREATE POLICY "Only super admins can view admin config"
ON public.admin_config
FOR SELECT
TO authenticated
USING (public.is_super_admin((select auth.uid())));

CREATE POLICY "View audit logs based on role"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  public.is_super_admin((select auth.uid()))
  OR (
    public.has_role((select auth.uid()), 'admin'::public.app_role)
    AND (
      user_id IN (
        SELECT ur.user_id
        FROM public.user_roles ur
        WHERE ur.laundry_id = public.get_user_laundry_id((select auth.uid()))
      )
      OR table_name = ANY (ARRAY['machines', 'transactions', 'system_settings', 'esp32_status', 'authorized_devices'])
    )
  )
);

CREATE POLICY "Manage devices in own laundry"
ON public.authorized_devices
FOR ALL
TO authenticated
USING (
  public.is_super_admin((select auth.uid()))
  OR laundry_id = public.get_user_laundry_id((select auth.uid()))
)
WITH CHECK (
  public.is_super_admin((select auth.uid()))
  OR laundry_id = public.get_user_laundry_id((select auth.uid()))
);

CREATE POLICY "View devices based on role"
ON public.authorized_devices
FOR SELECT
TO authenticated
USING (
  public.is_super_admin((select auth.uid()))
  OR laundry_id = public.get_user_laundry_id((select auth.uid()))
);

CREATE POLICY "Admins can insert esp32_status"
ON public.esp32_status
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin((select auth.uid()))
  OR laundry_id = public.get_user_laundry_id((select auth.uid()))
);

CREATE POLICY "Admins can update esp32_status"
ON public.esp32_status
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin((select auth.uid()))
  OR laundry_id = public.get_user_laundry_id((select auth.uid()))
);

CREATE POLICY "esp32_select_scoped"
ON public.esp32_status
FOR SELECT
TO authenticated
USING (
  public.is_super_admin((select auth.uid()))
  OR laundry_id = public.get_user_laundry_id((select auth.uid()))
);

CREATE POLICY "Admins can view their own laundry"
ON public.laundries
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT ur.laundry_id
    FROM public.user_roles ur
    WHERE ur.user_id = (select auth.uid())
  )
);

CREATE POLICY "Only super admins can manage laundries"
ON public.laundries
FOR ALL
TO authenticated
USING (public.is_super_admin((select auth.uid())))
WITH CHECK (public.is_super_admin((select auth.uid())));

CREATE POLICY "Super admins can view all laundries"
ON public.laundries
FOR SELECT
TO authenticated
USING (public.is_super_admin((select auth.uid())));

CREATE POLICY "Manage machines in own laundry"
ON public.machines
FOR ALL
TO authenticated
USING (
  public.is_super_admin((select auth.uid()))
  OR (
    public.has_role((select auth.uid()), 'admin'::public.app_role)
    AND laundry_id = public.get_user_laundry_id((select auth.uid()))
  )
)
WITH CHECK (
  public.is_super_admin((select auth.uid()))
  OR (
    public.has_role((select auth.uid()), 'admin'::public.app_role)
    AND laundry_id = public.get_user_laundry_id((select auth.uid()))
  )
);

CREATE POLICY "View machines based on role"
ON public.machines
FOR SELECT
TO authenticated
USING (
  public.is_super_admin((select auth.uid()))
  OR laundry_id = public.get_user_laundry_id((select auth.uid()))
);

CREATE POLICY "Admins can insert pending commands for own laundry"
ON public.pending_commands
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin((select auth.uid()))
  OR (
    public.has_role((select auth.uid()), 'admin'::public.app_role)
    AND machine_id IN (
      SELECT m.id
      FROM public.machines m
      WHERE m.laundry_id = public.get_user_laundry_id((select auth.uid()))
    )
  )
);

CREATE POLICY "Admins can update pending commands for own laundry"
ON public.pending_commands
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin((select auth.uid()))
  OR (
    public.has_role((select auth.uid()), 'admin'::public.app_role)
    AND machine_id IN (
      SELECT m.id
      FROM public.machines m
      WHERE m.laundry_id = public.get_user_laundry_id((select auth.uid()))
    )
  )
);

CREATE POLICY "Admins can view pending commands"
ON public.pending_commands
FOR SELECT
TO authenticated
USING (
  public.is_super_admin((select auth.uid()))
  OR public.has_role((select auth.uid()), 'admin'::public.app_role)
);

CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (select auth.uid()) = user_id
  OR public.is_super_admin((select auth.uid()))
  OR (
    public.has_role((select auth.uid()), 'admin'::public.app_role)
    AND user_id IN (
      SELECT ur.user_id
      FROM public.user_roles ur
      WHERE ur.laundry_id = public.get_user_laundry_id((select auth.uid()))
    )
  )
);

CREATE POLICY "Update security events scoped"
ON public.security_events
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin((select auth.uid()))
  OR (
    public.has_role(
      (select auth.uid()),
      'admin'::public.app_role,
      public.get_user_laundry_id((select auth.uid()))
    )
    AND device_uuid IN (
      SELECT ad.device_uuid
      FROM public.authorized_devices ad
      WHERE ad.laundry_id = public.get_user_laundry_id((select auth.uid()))
    )
  )
);

CREATE POLICY "View security events based on role"
ON public.security_events
FOR SELECT
TO authenticated
USING (
  public.is_super_admin((select auth.uid()))
  OR (
    public.has_role((select auth.uid()), 'admin'::public.app_role)
    AND device_uuid IN (
      SELECT ad.device_uuid
      FROM public.authorized_devices ad
      WHERE ad.laundry_id = public.get_user_laundry_id((select auth.uid()))
    )
  )
);

CREATE POLICY "Manage settings in own laundry"
ON public.system_settings
FOR ALL
TO authenticated
USING (
  public.is_super_admin((select auth.uid()))
  OR laundry_id = public.get_user_laundry_id((select auth.uid()))
)
WITH CHECK (
  public.is_super_admin((select auth.uid()))
  OR laundry_id = public.get_user_laundry_id((select auth.uid()))
);

CREATE POLICY "Only admins can view settings"
ON public.system_settings
FOR SELECT
TO authenticated
USING (
  public.is_super_admin((select auth.uid()))
  OR (
    public.has_role((select auth.uid()), 'admin'::public.app_role)
    AND laundry_id = public.get_user_laundry_id((select auth.uid()))
  )
);

CREATE POLICY "Authenticated users can create transactions"
ON public.transactions
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin((select auth.uid()))
  OR laundry_id = public.get_user_laundry_id((select auth.uid()))
);

CREATE POLICY "Manage transactions in own laundry"
ON public.transactions
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin((select auth.uid()))
  OR laundry_id = public.get_user_laundry_id((select auth.uid()))
);

CREATE POLICY "View transactions based on role"
ON public.transactions
FOR SELECT
TO authenticated
USING (
  (select auth.uid()) = user_id
  OR public.is_super_admin((select auth.uid()))
  OR laundry_id = public.get_user_laundry_id((select auth.uid()))
);

CREATE POLICY "Manage credits in own laundry"
ON public.user_credits
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin((select auth.uid()))
  OR laundry_id = public.get_user_laundry_id((select auth.uid()))
);

CREATE POLICY "View credits based on role"
ON public.user_credits
FOR SELECT
TO authenticated
USING (
  (select auth.uid()) = user_id
  OR public.is_super_admin((select auth.uid()))
  OR laundry_id = public.get_user_laundry_id((select auth.uid()))
);

CREATE POLICY "Admins can manage roles in their laundry"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  AND laundry_id = public.get_user_laundry_id((select auth.uid()))
  AND role <> 'super_admin'::public.app_role
)
WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  AND laundry_id = public.get_user_laundry_id((select auth.uid()))
  AND role <> 'super_admin'::public.app_role
);

CREATE POLICY "Super admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.is_super_admin((select auth.uid())))
WITH CHECK (public.is_super_admin((select auth.uid())));

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  (select auth.uid()) = user_id
  OR public.is_super_admin((select auth.uid()))
  OR (
    public.has_role((select auth.uid()), 'admin'::public.app_role)
    AND laundry_id = public.get_user_laundry_id((select auth.uid()))
  )
);
