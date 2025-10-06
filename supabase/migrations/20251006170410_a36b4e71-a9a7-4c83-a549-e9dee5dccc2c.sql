-- ============================================================================
-- FASE 1: CORREÇÃO DAS POLÍTICAS RLS
-- ============================================================================

-- ============================================================================
-- 1. CORRIGIR POLÍTICAS DE user_roles
-- ============================================================================

-- Remover políticas antigas
DROP POLICY IF EXISTS "Super admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles in their laundry" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

-- Super admins podem gerenciar todas as roles
CREATE POLICY "Super admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Admins podem gerenciar roles apenas na sua lavanderia (exceto super_admin)
CREATE POLICY "Admins can manage roles in their laundry"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND laundry_id = get_user_laundry_id(auth.uid())
  AND role != 'super_admin'::app_role
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND laundry_id = get_user_laundry_id(auth.uid())
  AND role != 'super_admin'::app_role
);

-- Usuários podem ver suas próprias roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR is_super_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND laundry_id = get_user_laundry_id(auth.uid())
  )
);

-- ============================================================================
-- 2. CORRIGIR POLÍTICAS DE profiles
-- ============================================================================

-- Remover política antiga que permite admin ver todos os perfis
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Criar nova política: usuários veem seu próprio perfil, admins veem perfis da sua lavanderia, super_admin vê todos
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR is_super_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND user_id IN (
      SELECT ur.user_id 
      FROM public.user_roles ur
      WHERE ur.laundry_id = get_user_laundry_id(auth.uid())
    )
  )
);

-- ============================================================================
-- 3. CORRIGIR POLÍTICAS DE admin_config (apenas super_admin)
-- ============================================================================

-- Remover políticas antigas
DROP POLICY IF EXISTS "Only admins can view admin config" ON public.admin_config;
DROP POLICY IF EXISTS "Only admins can update admin config" ON public.admin_config;

-- Apenas super admins podem ver configurações de admin
CREATE POLICY "Only super admins can view admin config"
ON public.admin_config
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

-- Apenas super admins podem atualizar configurações de admin
CREATE POLICY "Only super admins can update admin config"
ON public.admin_config
FOR UPDATE
TO authenticated
USING (is_super_admin(auth.uid()));

-- ============================================================================
-- 4. CORRIGIR POLÍTICAS DE security_events
-- ============================================================================

-- Remover políticas antigas
DROP POLICY IF EXISTS "Only admins can view security events" ON public.security_events;
DROP POLICY IF EXISTS "Only admins can update security events" ON public.security_events;

-- Super admins veem todos os eventos, admins veem apenas da sua lavanderia
CREATE POLICY "View security events based on role"
ON public.security_events
FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND device_uuid IN (
      SELECT device_uuid 
      FROM public.authorized_devices
      WHERE laundry_id = get_user_laundry_id(auth.uid())
    )
  )
);

-- Apenas admins e super admins podem atualizar eventos de segurança
CREATE POLICY "Update security events based on role"
ON public.security_events
FOR UPDATE
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- ============================================================================
-- 5. CORRIGIR POLÍTICAS DE audit_logs
-- ============================================================================

-- Remover política antiga
DROP POLICY IF EXISTS "Only admins can view audit logs" ON public.audit_logs;

-- Super admins veem todos os logs, admins veem apenas logs relacionados à sua lavanderia
CREATE POLICY "View audit logs based on role"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND (
      user_id IN (
        SELECT ur.user_id 
        FROM public.user_roles ur
        WHERE ur.laundry_id = get_user_laundry_id(auth.uid())
      )
      OR table_name IN ('machines', 'transactions', 'system_settings', 'esp32_status', 'authorized_devices')
    )
  )
);