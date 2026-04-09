-- Permitir que o Totem (role anon) insira transações
CREATE POLICY "Totem anon can create transactions"
  ON public.transactions
  FOR INSERT
  TO anon
  WITH CHECK (laundry_id IS NOT NULL AND payment_method IS NOT NULL);