CREATE POLICY "Allow public read system_settings"
ON public.system_settings
FOR SELECT
TO public
USING (true);