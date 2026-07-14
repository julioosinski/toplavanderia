-- Evita "pagamento perdido":
-- 1) ao cancelar TX, falha comandos ESP ainda pendentes (não libera máquina após estorno)
-- 2) ao confirmar comando ON/credito no ESP, completa TX pending vinculada (APK pode ter morrido)

CREATE OR REPLACE FUNCTION public.cancel_totem_transaction_by_id(_transaction_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _updated boolean := false;
BEGIN
  IF _transaction_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.transactions
  SET
    status = 'cancelled',
    updated_at = now()
  WHERE id = _transaction_id
    AND status = 'pending';

  _updated := FOUND;

  -- Não deixar ON/credito órfão liberar hardware depois do cancelamento/estorno.
  UPDATE public.pending_commands
  SET
    status = 'failed',
    error_message = COALESCE(error_message, 'cancelled_with_transaction'),
    updated_at = now()
  WHERE transaction_id = _transaction_id
    AND status IN ('pending', 'processing');

  RETURN _updated;
END;
$$;

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
    AND status IN ('pending', 'processing');

  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_totem_transaction_by_id(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_pending_commands_for_transaction(uuid) TO anon, authenticated;

-- Completa TX pending quando o ESP confirma liberação (recuperação se o totem morreu pós-pago).
CREATE OR REPLACE FUNCTION public.complete_transaction_on_esp_confirm(_transaction_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _transaction_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.transactions
  SET
    status = 'completed',
    completed_at = COALESCE(completed_at, now()),
    updated_at = now(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('completed_by', 'esp32_confirm')
  WHERE id = _transaction_id
    AND status = 'pending';

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_transaction_on_esp_confirm(uuid) TO anon, authenticated, service_role;
