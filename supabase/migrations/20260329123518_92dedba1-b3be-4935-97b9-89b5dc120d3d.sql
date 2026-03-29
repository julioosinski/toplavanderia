
-- =============================================
-- SECURITY FIX 1: Enable RLS on esp32_status
-- =============================================
ALTER TABLE public.esp32_status ENABLE ROW LEVEL SECURITY;

-- =============================================
-- SECURITY FIX 2: Remove dangerous public policies on system_settings
-- The totem will use an edge function instead
-- =============================================
DROP POLICY IF EXISTS "Allow public read system_settings" ON public.system_settings;

-- Allow anon to read only non-sensitive fields via a security definer function
CREATE OR REPLACE FUNCTION public.get_totem_settings(_laundry_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'paygo_enabled', paygo_enabled,
    'paygo_host', paygo_host,
    'paygo_port', paygo_port,
    'paygo_timeout', paygo_timeout,
    'paygo_retry_attempts', paygo_retry_attempts,
    'paygo_retry_delay', paygo_retry_delay,
    'default_cycle_time', default_cycle_time,
    'default_price', default_price,
    'auto_mode', auto_mode,
    'enable_esp32_monitoring', enable_esp32_monitoring,
    'heartbeat_interval_seconds', heartbeat_interval_seconds
  )
  FROM public.system_settings
  WHERE laundry_id = _laundry_id
  LIMIT 1
$$;

-- =============================================
-- SECURITY FIX 3: Remove unrestricted transaction policies
-- Edge functions use service_role and bypass RLS
-- =============================================
DROP POLICY IF EXISTS "APK can create transactions" ON public.transactions;
DROP POLICY IF EXISTS "APK can update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow public insert transactions" ON public.transactions;

-- Authenticated users can insert transactions for their laundry
CREATE POLICY "Authenticated users can create transactions"
ON public.transactions
FOR INSERT
TO authenticated
WITH CHECK (
  is_super_admin(auth.uid())
  OR laundry_id = get_user_laundry_id(auth.uid())
);

-- =============================================
-- SECURITY FIX 4: Tighten esp32_status policies
-- Keep anon SELECT (totem needs heartbeat check)
-- Restrict UPDATE/INSERT to service_role or authenticated
-- =============================================
DROP POLICY IF EXISTS "esp32_update_public" ON public.esp32_status;
DROP POLICY IF EXISTS "esp32_upsert_public" ON public.esp32_status;

-- ESP32 heartbeats come via edge functions (service_role), so authenticated is enough for admin
CREATE POLICY "Authenticated can update esp32_status"
ON public.esp32_status
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert esp32_status"
ON public.esp32_status
FOR INSERT
TO authenticated
WITH CHECK (true);
