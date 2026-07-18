-- Entrega cada comando a um único poll do ESP32.
-- Evita pulsos duplicados quando há polls concorrentes ou confirmação lenta.

CREATE OR REPLACE FUNCTION public.claim_pending_esp32_commands(
  _esp32_id text,
  _limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  relay_pin integer,
  action text,
  machine_id uuid,
  transaction_id uuid,
  payload jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _esp32_id IS NULL OR btrim(_esp32_id) = '' THEN
    RETURN;
  END IF;

  -- Uma liberação não entregue em cinco minutos deixa de ser segura.
  UPDATE public.pending_commands pc
  SET
    status = 'failed',
    error_message = COALESCE(pc.error_message, 'command_expired_before_delivery'),
    updated_at = now()
  WHERE pc.esp32_id = _esp32_id
    AND pc.status = 'pending'
    AND pc.created_at < now() - interval '5 minutes';

  RETURN QUERY
  WITH candidates AS (
    SELECT pc.id
    FROM public.pending_commands pc
    WHERE pc.esp32_id = _esp32_id
      AND pc.status = 'pending'
      AND pc.created_at >= now() - interval '5 minutes'
    ORDER BY pc.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(_limit, 10), 1), 20)
  ),
  claimed AS (
    UPDATE public.pending_commands pc
    SET
      status = 'processing',
      last_retry_at = now(),
      updated_at = now()
    FROM candidates c
    WHERE pc.id = c.id
      AND pc.status = 'pending'
    RETURNING
      pc.id,
      pc.relay_pin,
      pc.action,
      pc.machine_id,
      pc.transaction_id,
      pc.payload
  )
  SELECT
    claimed.id,
    claimed.relay_pin,
    claimed.action,
    claimed.machine_id,
    claimed.transaction_id,
    claimed.payload
  FROM claimed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_pending_esp32_commands(text, integer)
TO anon, authenticated, service_role;
