-- Cancela transação pending do totem quando pagamento falha ou é abortado

CREATE OR REPLACE FUNCTION public.cancel_totem_transaction_by_id(_transaction_id uuid)
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
    status = 'cancelled',
    updated_at = now()
  WHERE id = _transaction_id
    AND status = 'pending';

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_totem_transaction_by_id(uuid) TO anon, authenticated;
