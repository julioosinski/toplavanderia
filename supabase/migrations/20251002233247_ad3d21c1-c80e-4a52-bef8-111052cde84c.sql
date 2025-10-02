-- Remover política existente que está causando problemas
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

-- Criar políticas separadas para super_admin e admin
-- Super admins podem gerenciar todas as roles
CREATE POLICY "Super admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Admins podem gerenciar roles na sua própria lavanderia
CREATE POLICY "Admins can manage roles in their laundry"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND laundry_id = get_user_laundry_id(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  AND laundry_id = get_user_laundry_id(auth.uid())
);

-- Melhorar a política de SELECT para incluir super_admin
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

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