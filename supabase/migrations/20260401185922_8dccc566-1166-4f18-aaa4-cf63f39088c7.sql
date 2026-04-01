
DROP FUNCTION IF EXISTS public.get_esp32_heartbeats(uuid);

CREATE FUNCTION public.get_esp32_heartbeats(_laundry_id uuid)
RETURNS TABLE(esp32_id text, is_online boolean, last_heartbeat timestamptz, relay_status jsonb, ip_address text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT esp32_id, is_online, last_heartbeat, relay_status, ip_address
  FROM public.esp32_status
  WHERE laundry_id = _laundry_id;
$$;
