-- PIX no totem Cielo: a sessão PAYMENT_PENDING não deve prender a máquina por 30–45 min.
-- Após 8 min sem autorização, expira a sessão (desbloqueia a máquina) e cancela a TX pending.
-- Cartão/débito continuam no prazo padrão (_max_age_minutes, mínimo 5).

CREATE OR REPLACE FUNCTION public.expire_stale_payment_sessions(_max_age_minutes integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n integer := 0;
  _row RECORD;
  _pix_age interval := interval '8 minutes';
  _other_age interval := make_interval(mins => GREATEST(_max_age_minutes, 5));
BEGIN
  FOR _row IN
    SELECT ps.id, ps.transaction_id
    FROM public.payment_sessions ps
    JOIN public.transactions t ON t.id = ps.transaction_id
    WHERE ps.state IN ('CREATED', 'PAYMENT_PENDING')
      AND t.status = 'pending'
      AND COALESCE((t.metadata->>'payment_authorized')::boolean, false) = false
      AND ps.created_at <= now() - CASE
        WHEN lower(coalesce(ps.payment_method, t.payment_method, '')) = 'pix'
          THEN _pix_age
        ELSE _other_age
      END
  LOOP
    UPDATE public.payment_sessions
    SET state = 'EXPIRED', updated_at = now()
    WHERE id = _row.id;

    PERFORM public.cancel_totem_transaction_by_id(_row.transaction_id);
    _n := _n + 1;
  END LOOP;

  RETURN _n;
END;
$$;

COMMENT ON FUNCTION public.expire_stale_payment_sessions(integer) IS
  'Expira sessões CREATED/PAYMENT_PENDING sem pagamento autorizado. PIX: 8 min; demais métodos: _max_age_minutes (mín. 5).';
