-- Débito como método explícito + conclusão de transação por ID (fluxo totem Cielo)

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_payment_method_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_payment_method_check
  CHECK (payment_method IS NULL OR payment_method IN (
    'credit', 'debit', 'pix', 'card', 'cash', 'manual_release', 'totem', 'cielo'
  ));

CREATE OR REPLACE FUNCTION public.complete_totem_transaction_by_id(
  _transaction_id uuid,
  _payment_method text DEFAULT NULL
)
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
    payment_method = COALESCE(NULLIF(_payment_method, ''), payment_method),
    completed_at = now(),
    updated_at = now()
  WHERE id = _transaction_id
    AND status = 'pending';

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_totem_transaction_by_id(uuid, text) TO anon, authenticated;

-- Cancelar pendências duplicadas órfãs (criadas pelo esp32-monitor antes da correção)
UPDATE public.transactions AS pending
SET status = 'cancelled', updated_at = now()
WHERE pending.status = 'pending'
  AND pending.created_at < now() - interval '30 minutes'
  AND EXISTS (
    SELECT 1 FROM public.transactions AS done
    WHERE done.machine_id = pending.machine_id
      AND done.laundry_id = pending.laundry_id
      AND done.status = 'completed'
      AND done.created_at::date = pending.created_at::date
      AND done.created_at > pending.created_at
  );
