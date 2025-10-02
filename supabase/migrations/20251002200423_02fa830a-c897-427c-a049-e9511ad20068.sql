-- =====================================================
-- PARTE 2.1: Estrutura Base Multi-Tenant
-- =====================================================

-- 1. Criar tabela de lavanderias
CREATE TABLE IF NOT EXISTS public.laundries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cnpj TEXT UNIQUE NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN DEFAULT true,
  owner_id UUID REFERENCES auth.users(id),
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Adicionar laundry_id em user_roles
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS laundry_id UUID REFERENCES public.laundries(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_user_roles_laundry ON public.user_roles(laundry_id);
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS check_laundry_id_required;

-- 3. Adicionar laundry_id em todas as tabelas
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS laundry_id UUID REFERENCES public.laundries(id) ON DELETE CASCADE;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS laundry_id UUID REFERENCES public.laundries(id) ON DELETE CASCADE;
ALTER TABLE public.esp32_status ADD COLUMN IF NOT EXISTS laundry_id UUID REFERENCES public.laundries(id) ON DELETE CASCADE;
ALTER TABLE public.authorized_devices ADD COLUMN IF NOT EXISTS laundry_id UUID REFERENCES public.laundries(id) ON DELETE CASCADE;
ALTER TABLE public.user_credits ADD COLUMN IF NOT EXISTS laundry_id UUID REFERENCES public.laundries(id) ON DELETE CASCADE;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS laundry_id UUID REFERENCES public.laundries(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_machines_laundry ON public.machines(laundry_id);
CREATE INDEX IF NOT EXISTS idx_transactions_laundry ON public.transactions(laundry_id);
CREATE INDEX IF NOT EXISTS idx_esp32_laundry ON public.esp32_status(laundry_id);
CREATE INDEX IF NOT EXISTS idx_authorized_devices_laundry ON public.authorized_devices(laundry_id);
CREATE INDEX IF NOT EXISTS idx_user_credits_laundry ON public.user_credits(laundry_id);
CREATE INDEX IF NOT EXISTS idx_system_settings_laundry ON public.system_settings(laundry_id);

-- 4. Migração de Dados
DO $$
DECLARE
  default_laundry_id UUID;
  first_user_id UUID;
BEGIN
  SELECT id INTO first_user_id FROM auth.users LIMIT 1;
  
  INSERT INTO public.laundries (name, cnpj, is_active, owner_id)
  VALUES ('Lavanderia Principal', '00.000.000/0001-00', true, first_user_id)
  ON CONFLICT (cnpj) DO NOTHING
  RETURNING id INTO default_laundry_id;
  
  IF default_laundry_id IS NULL THEN
    SELECT id INTO default_laundry_id FROM public.laundries WHERE cnpj = '00.000.000/0001-00';
  END IF;
  
  UPDATE public.machines SET laundry_id = default_laundry_id WHERE laundry_id IS NULL;
  UPDATE public.transactions SET laundry_id = default_laundry_id WHERE laundry_id IS NULL;
  UPDATE public.esp32_status SET laundry_id = default_laundry_id WHERE laundry_id IS NULL;
  UPDATE public.authorized_devices SET laundry_id = default_laundry_id WHERE laundry_id IS NULL;
  UPDATE public.user_credits SET laundry_id = default_laundry_id WHERE laundry_id IS NULL;
  UPDATE public.system_settings SET laundry_id = default_laundry_id WHERE laundry_id IS NULL;
  UPDATE public.user_roles SET laundry_id = default_laundry_id WHERE laundry_id IS NULL AND role != 'super_admin';
  
  IF first_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role, laundry_id)
    SELECT first_user_id, 'super_admin'::app_role, NULL
    WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = first_user_id AND role = 'super_admin');
  END IF;
END $$;

-- 5. Constraint
ALTER TABLE public.user_roles ADD CONSTRAINT check_laundry_id_required
CHECK ((role = 'super_admin' AND laundry_id IS NULL) OR (role != 'super_admin' AND laundry_id IS NOT NULL));

-- 6. Remover função antiga com CASCADE
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role) CASCADE;

-- 7. Criar novas funções
CREATE FUNCTION public.has_role(_user_id UUID, _role public.app_role, _laundry_id UUID DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
      AND (_laundry_id IS NULL OR laundry_id = _laundry_id OR role = 'super_admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_laundry_id(_user_id UUID)
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT laundry_id FROM public.user_roles WHERE user_id = _user_id AND laundry_id IS NOT NULL LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin')
$$;

-- 8. RLS laundries
ALTER TABLE public.laundries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view all laundries" ON public.laundries FOR SELECT
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Admins can view their own laundry" ON public.laundries FOR SELECT
  USING (id IN (SELECT laundry_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Only super admins can manage laundries" ON public.laundries FOR ALL
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

-- 9. Trigger
DROP TRIGGER IF EXISTS update_laundries_updated_at ON public.laundries;
CREATE TRIGGER update_laundries_updated_at
  BEFORE UPDATE ON public.laundries FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();