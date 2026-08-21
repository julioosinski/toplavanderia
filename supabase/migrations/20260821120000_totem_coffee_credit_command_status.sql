-- Café: status do comando crédito sem ser poluído por ON/OFF posteriores.

CREATE OR REPLACE FUNCTION public.get_totem_credit_command_status(_transaction_id uuid)
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
  IF _transaction_id IS NULL THEN
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
  WHERE pc.transaction_id = _transaction_id
    AND pc.action IN ('credito', 'liberar')
  ORDER BY pc.created_at DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_totem_credit_command_status(uuid)
  TO anon, authenticated, service_role;
