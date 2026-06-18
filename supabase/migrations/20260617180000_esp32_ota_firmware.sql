-- OTA de firmware ESP32: fila de jobs + bucket privado (URL assinada na poll).

CREATE TABLE IF NOT EXISTS public.esp32_ota_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laundry_id UUID NOT NULL REFERENCES public.laundries(id) ON DELETE CASCADE,
  esp32_id TEXT NOT NULL,
  firmware_version TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size BIGINT,
  checksum_sha256 TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'downloading', 'completed', 'failed', 'cancelled')),
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_esp32_ota_jobs_esp32_status
  ON public.esp32_ota_jobs (esp32_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_esp32_ota_jobs_laundry
  ON public.esp32_ota_jobs (laundry_id, created_at DESC);

ALTER TABLE public.esp32_ota_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view esp32 ota jobs in laundry"
ON public.esp32_ota_jobs FOR SELECT TO authenticated
USING (
  public.is_super_admin((SELECT auth.uid()))
  OR (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    AND laundry_id = public.get_user_laundry_id((SELECT auth.uid()))
  )
);

CREATE POLICY "Admins insert esp32 ota jobs in laundry"
ON public.esp32_ota_jobs FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin((SELECT auth.uid()))
  OR (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    AND laundry_id = public.get_user_laundry_id((SELECT auth.uid()))
  )
);

CREATE POLICY "Admins update esp32 ota jobs in laundry"
ON public.esp32_ota_jobs FOR UPDATE TO authenticated
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

CREATE TRIGGER update_esp32_ota_jobs_updated_at
  BEFORE UPDATE ON public.esp32_ota_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket privado: download só via signed URL (edge function service_role).
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('esp32-firmware', 'esp32-firmware', false, 5242880)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Admins upload esp32 firmware" ON storage.objects;
DROP POLICY IF EXISTS "Admins read esp32 firmware" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete esp32 firmware" ON storage.objects;

CREATE POLICY "Admins upload esp32 firmware"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'esp32-firmware'
  AND (
    public.is_super_admin((SELECT auth.uid()))
    OR (
      public.has_role((SELECT auth.uid()), 'admin'::app_role)
      AND (storage.foldername(name))[1] = public.get_user_laundry_id((SELECT auth.uid()))::text
    )
  )
);

CREATE POLICY "Admins read esp32 firmware"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'esp32-firmware'
  AND (
    public.is_super_admin((SELECT auth.uid()))
    OR (
      public.has_role((SELECT auth.uid()), 'admin'::app_role)
      AND (storage.foldername(name))[1] = public.get_user_laundry_id((SELECT auth.uid()))::text
    )
  )
);

CREATE POLICY "Admins delete esp32 firmware"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'esp32-firmware'
  AND (
    public.is_super_admin((SELECT auth.uid()))
    OR (
      public.has_role((SELECT auth.uid()), 'admin'::app_role)
      AND (storage.foldername(name))[1] = public.get_user_laundry_id((SELECT auth.uid()))::text
    )
  )
);

COMMENT ON TABLE public.esp32_ota_jobs IS 'Fila OTA: ESP32 faz poll e baixa .bin via URL assinada';
