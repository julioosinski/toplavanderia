-- Permitir que o totem (anon) faça UPDATE em machines, mas APENAS para status = 'running'
-- Isso é um fallback caso o totem faça update direto ao invés da Edge Function
CREATE POLICY "Totem can set machine to running"
  ON public.machines
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (status = 'running');
