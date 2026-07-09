DROP POLICY IF EXISTS "View machines based on role" ON public.machines;
DROP POLICY IF EXISTS "Admins can insert machines in own laundry" ON public.machines;
DROP POLICY IF EXISTS "Admins can update machines in own laundry" ON public.machines;
DROP POLICY IF EXISTS "Admins can delete machines in own laundry" ON public.machines;

CREATE POLICY "View machines based on assigned laundry role"
ON public.machines
FOR SELECT
TO authenticated
USING (
  public.is_super_admin((SELECT auth.uid()))
  OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role, laundry_id)
  OR public.has_role((SELECT auth.uid()), 'operator'::public.app_role, laundry_id)
);

CREATE POLICY "Admins can insert machines in assigned laundry"
ON public.machines
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin((SELECT auth.uid()))
  OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role, laundry_id)
);

CREATE POLICY "Admins can update machines in assigned laundry"
ON public.machines
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin((SELECT auth.uid()))
  OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role, laundry_id)
)
WITH CHECK (
  public.is_super_admin((SELECT auth.uid()))
  OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role, laundry_id)
);

CREATE POLICY "Admins can delete machines in assigned laundry"
ON public.machines
FOR DELETE
TO authenticated
USING (
  public.is_super_admin((SELECT auth.uid()))
  OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role, laundry_id)
);

DROP POLICY IF EXISTS "esp32_select_scoped" ON public.esp32_status;
DROP POLICY IF EXISTS "Admins can insert esp32_status" ON public.esp32_status;
DROP POLICY IF EXISTS "Admins can update esp32_status" ON public.esp32_status;

CREATE POLICY "View esp32 status based on assigned laundry role"
ON public.esp32_status
FOR SELECT
TO authenticated
USING (
  public.is_super_admin((SELECT auth.uid()))
  OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role, laundry_id)
  OR public.has_role((SELECT auth.uid()), 'operator'::public.app_role, laundry_id)
);

CREATE POLICY "Admins can insert esp32 status in assigned laundry"
ON public.esp32_status
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin((SELECT auth.uid()))
  OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role, laundry_id)
);

CREATE POLICY "Admins can update esp32 status in assigned laundry"
ON public.esp32_status
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin((SELECT auth.uid()))
  OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role, laundry_id)
)
WITH CHECK (
  public.is_super_admin((SELECT auth.uid()))
  OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role, laundry_id)
);