-- Totem (anon) precisa ver status do comando sem SELECT direto em pending_commands (RLS).
-- Também recupera comandos "processing" órfãos e cancela OFF já claimed antes de um novo ON.

CREATE OR REPLACE FUNCTION public.get_totem_command_status(
  _transaction_id uuid DEFAULT NULL,
  _command_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  status text,
  action text,
  error_message text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _command_id IS NULL AND _transaction_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    pc.id,
    pc.status,
    pc.action,
    pc.error_message,
    pc.created_at,
    pc.updated_at
  FROM public.pending_commands pc
  WHERE (
      (_command_id IS NOT NULL AND pc.id = _command_id)
      OR (
        _command_id IS NULL
        AND _transaction_id IS NOT NULL
        AND pc.transaction_id = _transaction_id
        AND pc.action IN ('on', 'activate', 'turn_on', 'credito')
      )
    )
  ORDER BY pc.created_at DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_totem_command_status(uuid, uuid)
TO anon, authenticated, service_role;

-- Reclaim: processing sem confirmação volta a pending para nova entrega.
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

  -- pending antigo demais deixa de ser seguro.
  UPDATE public.pending_commands pc
  SET
    status = 'failed',
    error_message = COALESCE(pc.error_message, 'command_expired_before_delivery'),
    updated_at = now()
  WHERE pc.esp32_id = _esp32_id
    AND pc.status = 'pending'
    AND pc.created_at < now() - interval '5 minutes';

  -- processing órfão (ESP reiniciou / Wi-Fi caiu antes do confirm): reentregar.
  UPDATE public.pending_commands pc
  SET
    status = 'pending',
    error_message = NULL,
    last_retry_at = NULL,
    updated_at = now()
  WHERE pc.esp32_id = _esp32_id
    AND pc.status = 'processing'
    AND COALESCE(pc.last_retry_at, pc.updated_at, pc.created_at) < now() - interval '45 seconds'
    AND pc.created_at >= now() - interval '5 minutes';

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

-- Cancela OFF pendente ou já claimed (processing) no mesmo ESP/relé.
CREATE OR REPLACE FUNCTION public.cancel_stale_off_commands(
  _esp32_id text,
  _relay_pin integer DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n integer := 0;
BEGIN
  IF _esp32_id IS NULL OR btrim(_esp32_id) = '' THEN
    RETURN 0;
  END IF;

  UPDATE public.pending_commands pc
  SET
    status = 'failed',
    error_message = COALESCE(pc.error_message, 'cancelled_before_new_on'),
    updated_at = now()
  WHERE pc.esp32_id = _esp32_id
    AND pc.action IN ('off', 'deactivate', 'turn_off')
    AND pc.status IN ('pending', 'processing')
    AND (_relay_pin IS NULL OR pc.relay_pin = _relay_pin);

  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_stale_off_commands(text, integer)
TO anon, authenticated, service_role;

-- Em estorno, só invalida pending. processing pode já ter pulsado o relé —
-- deixar o confirm completar e a reconciliação decidir.
CREATE OR REPLACE FUNCTION public.fail_pending_commands_for_transaction(_transaction_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n integer := 0;
BEGIN
  IF _transaction_id IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.pending_commands
  SET
    status = 'failed',
    error_message = COALESCE(error_message, 'cancelled_before_refund'),
    updated_at = now()
  WHERE transaction_id = _transaction_id
    AND status = 'pending';

  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fail_pending_commands_for_transaction(uuid)
TO anon, authenticated, service_role;

-- Liberação manual: cancela OFF pending e processing antes do ON.
DO $$
BEGIN
  -- Aplica o helper na função atual sem reescrevê-la por completo.
  -- Se a função existir, o bloco UPDATE abaixo será o caminho usado via trigger.
  NULL;
END $$;

CREATE OR REPLACE FUNCTION public.pending_commands_cancel_off_before_on()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.action IN ('on', 'activate', 'turn_on', 'credito')
     AND NEW.status = 'pending'
     AND NEW.esp32_id IS NOT NULL THEN
    PERFORM public.cancel_stale_off_commands(NEW.esp32_id, NEW.relay_pin);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_off_before_on ON public.pending_commands;
CREATE TRIGGER trg_cancel_off_before_on
  BEFORE INSERT ON public.pending_commands
  FOR EACH ROW
  EXECUTE FUNCTION public.pending_commands_cancel_off_before_on();
