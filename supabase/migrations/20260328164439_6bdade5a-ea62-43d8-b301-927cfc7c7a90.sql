CREATE POLICY "Allow anon read esp32_status"
  ON public.esp32_status
  FOR SELECT
  TO anon
  USING (true);