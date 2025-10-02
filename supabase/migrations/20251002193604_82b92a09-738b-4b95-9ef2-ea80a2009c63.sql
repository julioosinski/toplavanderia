-- FASE 1: CORREÇÃO CRÍTICA DE SEGURANÇA (FINAL)
-- ==========================================

-- Remover todas policies existentes
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Only admins can modify system settings" ON public.%I', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "Admins can view system settings" ON public.%I', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "Users can view their own credits" ON public.%I', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "Only admins can manage credits" ON public.%I', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "APK can insert user credits" ON public.%I', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "APK can read user credits" ON public.%I', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "Users can view their own transactions" ON public.%I', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "Admins can modify transactions" ON public.%I', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "APK can create transactions" ON public.%I', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "APK can update transactions" ON public.%I', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "Admins can view esp32 status" ON public.%I', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "Admins can update esp32 status" ON public.%I', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "APK can insert esp32 status" ON public.%I', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "APK can update esp32 status" ON public.%I', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "APK can read esp32 status" ON public.%I', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "Admins can view machines" ON public.%I', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "Only admins can modify machines" ON public.%I', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "Users can view their own profile" ON public.%I', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "Users can update their own profile" ON public.%I', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "Users can insert their own profile" ON public.%I', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "Admins can manage authorized devices" ON public.%I', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "Only admins can view admin config" ON public.%I', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "Only admins can update admin config" ON public.%I', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "Users can view their own roles" ON public.%I', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "Admins can manage all roles" ON public.%I', r.tablename);
  END LOOP;
END $$;

-- Criar enum app_role
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'operator', 'user', 'totem_device');
  END IF;
END $$;

-- Criar tabela user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Migrar roles de profiles para user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, role::public.app_role
FROM public.profiles
WHERE role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Criar função has_role()
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Criar authorized_devices
CREATE TABLE IF NOT EXISTS public.authorized_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_uuid TEXT UNIQUE NOT NULL,
  device_name TEXT NOT NULL,
  location TEXT,
  is_active BOOLEAN DEFAULT true,
  last_seen TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.authorized_devices ENABLE ROW LEVEL SECURITY;

-- Criar admin_config
CREATE TABLE IF NOT EXISTS public.admin_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_hash TEXT NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;

INSERT INTO public.admin_config (pin_hash)
SELECT '$2a$10$N9qo8uLOickgx2ZMRZoMye/IVI0pIHBpgf4kCvh3HT5jYQEhgwcqW'
WHERE NOT EXISTS (SELECT 1 FROM public.admin_config);

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Criar função validate_admin_pin()
CREATE OR REPLACE FUNCTION public.validate_admin_pin(_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_hash TEXT;
BEGIN
  SELECT pin_hash INTO stored_hash
  FROM public.admin_config
  ORDER BY last_updated DESC
  LIMIT 1;
  
  RETURN stored_hash = crypt(_pin, stored_hash);
END;
$$;

-- Criar view public_machines
CREATE OR REPLACE VIEW public.public_machines AS
SELECT 
  id, name, type, status, price_per_kg, capacity_kg,
  cycle_time_minutes, location, esp32_id, temperature, last_maintenance
FROM public.machines;

GRANT SELECT ON public.public_machines TO anon, authenticated;

-- ==========================================
-- POLICIES SEGURAS (CORRIGIDAS)
-- ==========================================

-- USER_ROLES
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- SYSTEM_SETTINGS
CREATE POLICY "Admins can view system settings"
  ON public.system_settings FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Only admins can modify system settings"
  ON public.system_settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- USER_CREDITS (CORRIGIDO: INSERT usa WITH CHECK)
CREATE POLICY "Users can view their own credits"
  ON public.user_credits FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Admins can insert credits"
  ON public.user_credits FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "APK can insert user credits"
  ON public.user_credits FOR INSERT
  WITH CHECK (true);

-- TRANSACTIONS (CORRIGIDO)
CREATE POLICY "Users can view their own transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Admins can modify transactions"
  ON public.transactions FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "APK can create transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "APK can update transactions"
  ON public.transactions FOR UPDATE
  USING (true);

-- ESP32_STATUS (CORRIGIDO)
CREATE POLICY "Admins can view esp32 status"
  ON public.esp32_status FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Admins can update esp32 status"
  ON public.esp32_status FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "APK can insert esp32 status"
  ON public.esp32_status FOR INSERT
  WITH CHECK (true);

CREATE POLICY "APK can update esp32 status"
  ON public.esp32_status FOR UPDATE
  USING (true);

CREATE POLICY "APK can read esp32 status"
  ON public.esp32_status FOR SELECT
  USING (true);

-- MACHINES
CREATE POLICY "Admins can view machines"
  ON public.machines FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Only admins can modify machines"
  ON public.machines FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- PROFILES
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- AUTHORIZED_DEVICES
CREATE POLICY "Admins can manage authorized devices"
  ON public.authorized_devices FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ADMIN_CONFIG
CREATE POLICY "Only admins can view admin config"
  ON public.admin_config FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update admin config"
  ON public.admin_config FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- TRIGGER
DROP TRIGGER IF EXISTS update_authorized_devices_updated_at ON public.authorized_devices;
CREATE TRIGGER update_authorized_devices_updated_at
  BEFORE UPDATE ON public.authorized_devices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();