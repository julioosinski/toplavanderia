CREATE OR REPLACE FUNCTION public.complete_totem_transaction(
  _machine_id uuid,
  _laundry_id uuid,
  _payment_method text DEFAULT 'card'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _transaction_id uuid;
BEGIN
  SELECT t.id
  INTO _transaction_id
  FROM public.transactions t
  WHERE t.machine_id = _machine_id
    AND t.laundry_id = _laundry_id
    AND t.status = 'pending'
  ORDER BY t.created_at DESC
  LIMIT 1;

  IF _transaction_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.transactions
  SET
    status = 'completed',
    payment_method = COALESCE(NULLIF(_payment_method, ''), payment_method),
    completed_at = now(),
    updated_at = now()
  WHERE id = _transaction_id;

  RETURN _transaction_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_totem_transaction(uuid, uuid, text) TO anon, authenticated;
