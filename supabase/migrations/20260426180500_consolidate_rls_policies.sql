DROP POLICY IF EXISTS "View devices based on role" ON public.authorized_devices;

DROP POLICY IF EXISTS "Admins can view their own laundry" ON public.laundries;
DROP POLICY IF EXISTS "Only super admins can manage laundries" ON public.laundries;
DROP POLICY IF EXISTS "Super admins can view all laundries" ON public.laundries;

DROP POLICY IF EXISTS "Manage machines in own laundry" ON public.machines;
DROP POLICY IF EXISTS "View machines based on role" ON public.machines;

DROP POLICY IF EXISTS "Manage settings in own laundry" ON public.system_settings;
DROP POLICY IF EXISTS "Only admins can view settings" ON public.system_settings;

DROP POLICY IF EXISTS "Admins can manage roles in their laundry" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "View laundries based on role"
ON public.laundries
FOR SELECT
TO authenticated
USING (
  public.is_super_admin((select auth.uid()))
  OR id IN (
    SELECT ur.laundry_id
    FROM public.user_roles ur
    WHERE ur.user_id = (select auth.uid())
  )
);

CREATE POLICY "Super admins can insert laundries"
ON public.laundries
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin((select auth.uid())));

CREATE POLICY "Super admins can update laundries"
ON public.laundries
FOR UPDATE
TO authenticated
USING (public.is_super_admin((select auth.uid())))
WITH CHECK (public.is_super_admin((select auth.uid())));

CREATE POLICY "Super admins can delete laundries"
ON public.laundries
FOR DELETE
TO authenticated
USING (public.is_super_admin((select auth.uid())));

CREATE POLICY "View machines based on role"
ON public.machines
FOR SELECT
TO authenticated
USING (
  public.is_super_admin((select auth.uid()))
  OR laundry_id = public.get_user_laundry_id((select auth.uid()))
);

CREATE POLICY "Admins can insert machines in own laundry"
ON public.machines
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin((select auth.uid()))
  OR (
    public.has_role((select auth.uid()), 'admin'::public.app_role)
    AND laundry_id = public.get_user_laundry_id((select auth.uid()))
  )
);

CREATE POLICY "Admins can update machines in own laundry"
ON public.machines
FOR UPDATE
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

CREATE POLICY "Admins can delete machines in own laundry"
ON public.machines
FOR DELETE
TO authenticated
USING (
  public.is_super_admin((select auth.uid()))
  OR (
    public.has_role((select auth.uid()), 'admin'::public.app_role)
    AND laundry_id = public.get_user_laundry_id((select auth.uid()))
  )
);

CREATE POLICY "View settings in own laundry"
ON public.system_settings
FOR SELECT
TO authenticated
USING (
  public.is_super_admin((select auth.uid()))
  OR laundry_id = public.get_user_laundry_id((select auth.uid()))
);

CREATE POLICY "Manage settings in own laundry"
ON public.system_settings
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin((select auth.uid()))
  OR laundry_id = public.get_user_laundry_id((select auth.uid()))
);

CREATE POLICY "Update settings in own laundry"
ON public.system_settings
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin((select auth.uid()))
  OR laundry_id = public.get_user_laundry_id((select auth.uid()))
)
WITH CHECK (
  public.is_super_admin((select auth.uid()))
  OR laundry_id = public.get_user_laundry_id((select auth.uid()))
);

CREATE POLICY "Delete settings in own laundry"
ON public.system_settings
FOR DELETE
TO authenticated
USING (
  public.is_super_admin((select auth.uid()))
  OR laundry_id = public.get_user_laundry_id((select auth.uid()))
);

CREATE POLICY "View roles based on role"
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

CREATE POLICY "Admins can insert roles in scope"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin((select auth.uid()))
  OR (
    public.has_role((select auth.uid()), 'admin'::public.app_role)
    AND laundry_id = public.get_user_laundry_id((select auth.uid()))
    AND role <> 'super_admin'::public.app_role
  )
);

CREATE POLICY "Admins can update roles in scope"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin((select auth.uid()))
  OR (
    public.has_role((select auth.uid()), 'admin'::public.app_role)
    AND laundry_id = public.get_user_laundry_id((select auth.uid()))
    AND role <> 'super_admin'::public.app_role
  )
)
WITH CHECK (
  public.is_super_admin((select auth.uid()))
  OR (
    public.has_role((select auth.uid()), 'admin'::public.app_role)
    AND laundry_id = public.get_user_laundry_id((select auth.uid()))
    AND role <> 'super_admin'::public.app_role
  )
);

CREATE POLICY "Admins can delete roles in scope"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  public.is_super_admin((select auth.uid()))
  OR (
    public.has_role((select auth.uid()), 'admin'::public.app_role)
    AND laundry_id = public.get_user_laundry_id((select auth.uid()))
    AND role <> 'super_admin'::public.app_role
  )
);
