DROP POLICY IF EXISTS "Logos são públicos" ON storage.objects;

CREATE POLICY "Admins can view laundry logos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'laundry-logos'
  AND (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);
