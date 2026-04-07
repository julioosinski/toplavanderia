ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_payment_method_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_payment_method_check 
  CHECK (payment_method IS NULL OR payment_method IN ('credit','pix','card','cash','manual_release','totem','cielo'));