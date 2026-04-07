CREATE OR REPLACE FUNCTION public.get_totem_settings(_laundry_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'paygo_enabled', paygo_enabled,
    'paygo_host', paygo_host,
    'paygo_port', paygo_port,
    'paygo_timeout', paygo_timeout,
    'paygo_retry_attempts', paygo_retry_attempts,
    'paygo_retry_delay', paygo_retry_delay,
    'paygo_provedor', paygo_provedor,
    'default_cycle_time', default_cycle_time,
    'default_price', default_price,
    'auto_mode', auto_mode,
    'enable_esp32_monitoring', enable_esp32_monitoring,
    'heartbeat_interval_seconds', heartbeat_interval_seconds,
    'cielo_client_id', cielo_client_id,
    'cielo_access_token', cielo_access_token,
    'cielo_merchant_code', cielo_merchant_code,
    'cielo_environment', cielo_environment
  )
  FROM public.system_settings
  WHERE laundry_id = _laundry_id
  LIMIT 1
$$;