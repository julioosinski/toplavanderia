
-- ============================================================
-- 1. FIX: machines — remove overly permissive public read policy
--    Replace with anon-scoped policy on public_machines view
--    and keep role-scoped policy for authenticated users
-- ============================================================
DROP POLICY IF EXISTS "Allow public read access" ON public.machines;

-- Add anon SELECT policy for Totem: only via public_machines view
-- The Totem needs to read machines for a specific laundry. 
-- We add a limited anon SELECT so the Totem can read non-sensitive fields.
CREATE POLICY "Anon can read basic machine info"
ON public.machines
FOR SELECT
TO anon
USING (true);

-- But we need to restrict WHICH columns anon can see.
-- Since RLS can't restrict columns, we'll use the public_machines view.
-- Actually, let's drop the anon policy and instead grant anon SELECT on public_machines view only.
DROP POLICY IF EXISTS "Anon can read basic machine info" ON public.machines;

-- Grant SELECT on the public_machines view to anon (view already excludes sensitive columns)
GRANT SELECT ON public.public_machines TO anon;

-- ============================================================
-- 2. FIX: esp32_status — scope SELECT to laundry ownership
-- ============================================================
DROP POLICY IF EXISTS "esp32_select_authenticated" ON public.esp32_status;

CREATE POLICY "esp32_select_scoped"
ON public.esp32_status
FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid()) 
  OR laundry_id = get_user_laundry_id(auth.uid())
);

-- ============================================================
-- 3. FIX: security_events — scope UPDATE to laundry
-- ============================================================
DROP POLICY IF EXISTS "Update security events based on role" ON public.security_events;

CREATE POLICY "Update security events scoped"
ON public.security_events
FOR UPDATE
TO authenticated
USING (
  is_super_admin(auth.uid()) 
  OR (
    has_role(auth.uid(), 'admin'::app_role, get_user_laundry_id(auth.uid()))
    AND device_uuid IN (
      SELECT device_uuid FROM authorized_devices 
      WHERE laundry_id = get_user_laundry_id(auth.uid())
    )
  )
);

-- ============================================================
-- 4. FIX: authorized_devices — restrict to authenticated role
-- ============================================================
DROP POLICY IF EXISTS "Manage devices in own laundry" ON public.authorized_devices;
DROP POLICY IF EXISTS "View devices based on role" ON public.authorized_devices;

CREATE POLICY "Manage devices in own laundry"
ON public.authorized_devices
FOR ALL
TO authenticated
USING (
  is_super_admin(auth.uid()) 
  OR laundry_id = get_user_laundry_id(auth.uid())
)
WITH CHECK (
  is_super_admin(auth.uid()) 
  OR laundry_id = get_user_laundry_id(auth.uid())
);

CREATE POLICY "View devices based on role"
ON public.authorized_devices
FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid()) 
  OR laundry_id = get_user_laundry_id(auth.uid())
);
