-- =====================================================
-- PARTE 2.2: Recriar Políticas RLS Multi-Tenant (CORRIGIDO)
-- =====================================================

-- 1. Políticas de machines
DROP POLICY IF EXISTS "View machines based on role" ON public.machines;
DROP POLICY IF EXISTS "Manage machines in own laundry" ON public.machines;

CREATE POLICY "View machines based on role" ON public.machines FOR SELECT
  USING (is_super_admin(auth.uid()) OR laundry_id = get_user_laundry_id(auth.uid()));

CREATE POLICY "Manage machines in own laundry" ON public.machines FOR ALL
  USING (is_super_admin(auth.uid()) OR (has_role(auth.uid(), 'admin'::app_role) AND laundry_id = get_user_laundry_id(auth.uid())))
  WITH CHECK (is_super_admin(auth.uid()) OR (has_role(auth.uid(), 'admin'::app_role) AND laundry_id = get_user_laundry_id(auth.uid())));

-- 2. Políticas de transactions
DROP POLICY IF EXISTS "View transactions based on role" ON public.transactions;
DROP POLICY IF EXISTS "Manage transactions in own laundry" ON public.transactions;
DROP POLICY IF EXISTS "APK can create transactions" ON public.transactions;
DROP POLICY IF EXISTS "APK can update transactions" ON public.transactions;

CREATE POLICY "View transactions based on role" ON public.transactions FOR SELECT
  USING (auth.uid() = user_id OR is_super_admin(auth.uid()) OR laundry_id = get_user_laundry_id(auth.uid()));

CREATE POLICY "Manage transactions in own laundry" ON public.transactions FOR UPDATE
  USING (is_super_admin(auth.uid()) OR laundry_id = get_user_laundry_id(auth.uid()));

CREATE POLICY "APK can create transactions" ON public.transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "APK can update transactions" ON public.transactions FOR UPDATE USING (true);

-- 3. Políticas de user_credits
DROP POLICY IF EXISTS "View credits based on role" ON public.user_credits;
DROP POLICY IF EXISTS "Manage credits in own laundry" ON public.user_credits;
DROP POLICY IF EXISTS "APK can insert user credits" ON public.user_credits;
DROP POLICY IF EXISTS "APK can read user credits" ON public.user_credits;

CREATE POLICY "View credits based on role" ON public.user_credits FOR SELECT
  USING (auth.uid() = user_id OR is_super_admin(auth.uid()) OR laundry_id = get_user_laundry_id(auth.uid()));

CREATE POLICY "Manage credits in own laundry" ON public.user_credits FOR INSERT
  WITH CHECK (is_super_admin(auth.uid()) OR laundry_id = get_user_laundry_id(auth.uid()));

CREATE POLICY "APK can insert user credits" ON public.user_credits FOR INSERT WITH CHECK (true);
CREATE POLICY "APK can read user credits" ON public.user_credits FOR SELECT USING (true);

-- 4. Políticas de esp32_status
DROP POLICY IF EXISTS "View esp32 based on role" ON public.esp32_status;
DROP POLICY IF EXISTS "Manage esp32 in own laundry" ON public.esp32_status;
DROP POLICY IF EXISTS "APK can manage esp32 status" ON public.esp32_status;

CREATE POLICY "View esp32 based on role" ON public.esp32_status FOR SELECT
  USING (is_super_admin(auth.uid()) OR laundry_id = get_user_laundry_id(auth.uid()) OR true);

CREATE POLICY "Manage esp32 in own laundry" ON public.esp32_status FOR ALL
  USING (is_super_admin(auth.uid()) OR laundry_id = get_user_laundry_id(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()) OR laundry_id = get_user_laundry_id(auth.uid()));

CREATE POLICY "APK can manage esp32 status" ON public.esp32_status FOR ALL USING (true) WITH CHECK (true);

-- 5. Políticas de authorized_devices
DROP POLICY IF EXISTS "View devices based on role" ON public.authorized_devices;
DROP POLICY IF EXISTS "Manage devices in own laundry" ON public.authorized_devices;

CREATE POLICY "View devices based on role" ON public.authorized_devices FOR SELECT
  USING (is_super_admin(auth.uid()) OR laundry_id = get_user_laundry_id(auth.uid()));

CREATE POLICY "Manage devices in own laundry" ON public.authorized_devices FOR ALL
  USING (is_super_admin(auth.uid()) OR laundry_id = get_user_laundry_id(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()) OR laundry_id = get_user_laundry_id(auth.uid()));

-- 6. Políticas de system_settings
DROP POLICY IF EXISTS "View settings based on role" ON public.system_settings;
DROP POLICY IF EXISTS "Manage settings in own laundry" ON public.system_settings;

CREATE POLICY "View settings based on role" ON public.system_settings FOR SELECT
  USING (is_super_admin(auth.uid()) OR laundry_id = get_user_laundry_id(auth.uid()));

CREATE POLICY "Manage settings in own laundry" ON public.system_settings FOR ALL
  USING (is_super_admin(auth.uid()) OR laundry_id = get_user_laundry_id(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()) OR laundry_id = get_user_laundry_id(auth.uid()));

-- 7. Políticas de profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 8. Políticas de user_roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 9. Políticas de admin_config
DROP POLICY IF EXISTS "Only admins can view admin config" ON public.admin_config;
DROP POLICY IF EXISTS "Only admins can update admin config" ON public.admin_config;

CREATE POLICY "Only admins can view admin config" ON public.admin_config FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update admin config" ON public.admin_config FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 10. Políticas de audit_logs
DROP POLICY IF EXISTS "Only admins can view audit logs" ON public.audit_logs;

CREATE POLICY "Only admins can view audit logs" ON public.audit_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 11. Políticas de security_events
DROP POLICY IF EXISTS "Only admins can view security events" ON public.security_events;
DROP POLICY IF EXISTS "Only admins can update security events" ON public.security_events;

CREATE POLICY "Only admins can view security events" ON public.security_events FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update security events" ON public.security_events FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));