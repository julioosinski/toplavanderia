
-- 1. Fix pending_commands: restrict INSERT/UPDATE to admin/super_admin scoped by laundry
DROP POLICY IF EXISTS "pending_commands_insert_authenticated" ON public.pending_commands;
DROP POLICY IF EXISTS "pending_commands_update_authenticated" ON public.pending_commands;

CREATE POLICY "Admins can insert pending commands for own laundry"
ON public.pending_commands FOR INSERT
TO authenticated
WITH CHECK (
  is_super_admin(auth.uid()) OR (
    has_role(auth.uid(), 'admin'::app_role) AND
    machine_id IN (SELECT id FROM machines WHERE laundry_id = get_user_laundry_id(auth.uid()))
  )
);

CREATE POLICY "Admins can update pending commands for own laundry"
ON public.pending_commands FOR UPDATE
TO authenticated
USING (
  is_super_admin(auth.uid()) OR (
    has_role(auth.uid(), 'admin'::app_role) AND
    machine_id IN (SELECT id FROM machines WHERE laundry_id = get_user_laundry_id(auth.uid()))
  )
);

-- 2. Remove anon UPDATE on machines (edge function handles this now)
DROP POLICY IF EXISTS "Totem can set machine to running" ON public.machines;

-- 3. Restrict system_settings SELECT to admin/super_admin only
DROP POLICY IF EXISTS "View settings based on role" ON public.system_settings;

CREATE POLICY "Only admins can view settings"
ON public.system_settings FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid()) OR (
    has_role(auth.uid(), 'admin'::app_role) AND
    laundry_id = get_user_laundry_id(auth.uid())
  )
);

-- 4. Remove anon read on esp32_status and create secure RPC for totem
DROP POLICY IF EXISTS "Allow anon read esp32_status" ON public.esp32_status;

CREATE OR REPLACE FUNCTION public.get_esp32_heartbeats(_laundry_id uuid)
RETURNS TABLE(esp32_id text, is_online boolean, last_heartbeat timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT esp32_id, is_online, last_heartbeat
  FROM public.esp32_status
  WHERE laundry_id = _laundry_id;
$$;

-- 5. Fix storage policies for laundry-logos bucket
DROP POLICY IF EXISTS "Usuários autenticados podem deletar logos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar logos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem fazer upload de logos" ON storage.objects;

CREATE POLICY "Admins can upload laundry logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'laundry-logos' AND (
    is_super_admin(auth.uid()) OR
    has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Admins can update laundry logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'laundry-logos' AND (
    is_super_admin(auth.uid()) OR
    has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Admins can delete laundry logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'laundry-logos' AND (
    is_super_admin(auth.uid()) OR
    has_role(auth.uid(), 'admin'::app_role)
  )
);
