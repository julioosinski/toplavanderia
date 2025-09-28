-- Ajustar políticas RLS para permitir acesso do APK aos dados necessários

-- Atualizar políticas da tabela machines para permitir acesso público aos dados básicos
DROP POLICY IF EXISTS "Authenticated users can view machines" ON public.machines;
CREATE POLICY "Public read access to machines for APK" ON public.machines
  FOR SELECT 
  USING (true);

-- Permitir acesso público ao status dos ESP32 para monitoramento
DROP POLICY IF EXISTS "Only admins can view esp32 status" ON public.esp32_status;
CREATE POLICY "Public read access to esp32 status" ON public.esp32_status
  FOR SELECT 
  USING (true);

-- Permitir que o APK atualize status dos ESP32
DROP POLICY IF EXISTS "Only admins can modify esp32 status" ON public.esp32_status;
CREATE POLICY "APK can read esp32 status" ON public.esp32_status
  FOR SELECT 
  USING (true);

CREATE POLICY "APK can update esp32 status" ON public.esp32_status
  FOR UPDATE 
  USING (true);

CREATE POLICY "APK can insert esp32 status" ON public.esp32_status
  FOR INSERT 
  WITH CHECK (true);

-- Permitir acesso público às configurações do sistema necessárias para operação
DROP POLICY IF EXISTS "Only admins can view system settings" ON public.system_settings;
CREATE POLICY "Public read access to system settings" ON public.system_settings
  FOR SELECT 
  USING (true);

-- Permitir que transações sejam criadas sem usuário específico (para pagamentos no totem)
DROP POLICY IF EXISTS "Users can create transactions" ON public.transactions;
CREATE POLICY "APK can create transactions" ON public.transactions
  FOR INSERT 
  WITH CHECK (true);

-- Permitir leitura pública de transações (necessário para confirmações de pagamento)
CREATE POLICY "Public read access to transactions" ON public.transactions
  FOR SELECT 
  USING (true);

-- Permitir atualização de transações (para status de pagamento)
CREATE POLICY "APK can update transactions" ON public.transactions
  FOR UPDATE 
  USING (true);

-- Permitir que créditos sejam visualizados publicamente (para verificação de saldo)
DROP POLICY IF EXISTS "Users can view their own credits" ON public.user_credits;
CREATE POLICY "Public read access to user credits" ON public.user_credits
  FOR SELECT 
  USING (true);

-- Permitir inserção de créditos (para recargas no totem)
CREATE POLICY "APK can insert user credits" ON public.user_credits
  FOR INSERT 
  WITH CHECK (true);