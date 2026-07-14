-- Operadores liberam máquinas, mas não devem listar vendas da lavanderia.
-- Mantém leitura apenas das próprias linhas (ex.: liberdades manuais do usuário).

DROP POLICY IF EXISTS "View transactions based on role" ON public.transactions;
CREATE POLICY "View transactions based on role"
ON public.transactions FOR SELECT
USING (
  (SELECT auth.uid()) = user_id
  OR public.is_super_admin((SELECT auth.uid()))
  OR (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    AND laundry_id = public.get_user_laundry_id((SELECT auth.uid()))
  )
);
