
## Objetivo
Operador só enxerga **Máquinas**. Super admin e admin (gerente) podem, por operador, autorizar liberação manual e definir limite em R$ **por dia** e **por mês**. Ao atingir o limite, o botão de liberar fica bloqueado com aviso.

## Fluxo

1. Operador loga → cai em `/admin/machines`. Sidebar mostra só esse item. Rotas de dashboard, transações, relatórios, config, etc. redirecionam para `/admin/machines`.
2. Botão "Liberar" aparece na máquina só se `operator_release_permissions.can_release = true`. Caso contrário, botão oculto com tooltip "Sem autorização — solicite ao gerente".
3. Ao clicar Liberar, o backend valida limites; se exceder, retorna erro e a UI mostra "Limite diário/mensal atingido (R$ X / R$ Y usados)".
4. Admin/super admin gerenciam a autorização na tela **Usuários** → linha do operador ganha ação "Autorização de liberação" (dialog com toggle + dois inputs em R$).

## Mudanças de banco

Nova tabela `public.operator_release_permissions`:
- `user_id uuid` (FK auth.users, unique)
- `laundry_id uuid` (FK laundries)
- `can_release boolean default false`
- `daily_limit_cents integer` (nullable = sem limite específico; se `can_release` mas ambos null → tratado como 0)
- `monthly_limit_cents integer`
- `granted_by uuid`, `created_at`, `updated_at`

GRANTs: `authenticated` SELECT/INSERT/UPDATE/DELETE; `service_role` ALL. Sem anon.

RLS:
- Operador pode SELECT apenas a própria linha.
- Admin da lavanderia (`has_role(auth.uid(),'admin',laundry_id)`) e super_admin: SELECT/INSERT/UPDATE/DELETE nas linhas da sua lavanderia.

Funções (SECURITY DEFINER):

`public.get_operator_release_usage(_user_id uuid, _laundry_id uuid)` → retorna `jsonb { day_cents, month_cents, day_limit_cents, month_limit_cents, can_release }` somando `transactions` do usuário na lavanderia com `payment_method='manual_release'` no dia/mês corrente (America/Sao_Paulo).

Alterar `public.admin_remote_release(...)`:
- Após o bloco de permissão atual, se o caller **não** é super_admin nem admin (portanto é operator), consultar `operator_release_permissions` da lavanderia do usuário:
  - Se `can_release=false` ou linha inexistente → `RAISE EXCEPTION 'Operador sem autorização para liberar'`.
  - Calcular `_amount` (café ou máquina) em centavos.
  - Somar usos do dia e mês (transactions manual_release do próprio user + laundry) e checar contra `daily_limit_cents` / `monthly_limit_cents`.
  - Se `usado + novo > limite` → `RAISE EXCEPTION 'Limite % atingido'`.
- Manter a checagem existente para admin/super_admin sem limites.

Também permitir operator no filtro de papéis atual (hoje `admin`/`operator` já passam; só adicionar a checagem extra descrita).

## Mudanças de frontend

**`src/layouts/AdminLayout.tsx`**
- `menuItems`: adicionar flag `operatorAllowed` só em Máquinas.
- Filtro: se `userRole === 'operator'` (e não admin/super), manter apenas itens com `operatorAllowed`.
- Se `!isAdmin && !isSuperAdmin` e rota atual não é `/admin/machines`, redirecionar (`<Navigate to="/admin/machines" replace/>`).
- Ocultar breadcrumbs/laundry-selector opcionais permanecem.

**`src/pages/admin/Machines.tsx`**
- Buscar via novo hook `useOperatorReleasePermission()` que retorna `{ canRelease, dayCents, dayLimitCents, monthCents, monthLimitCents, isOperator }` via a RPC `get_operator_release_usage`.
- Para admin/super_admin: `canRelease=true`, sem limites.
- No card da máquina: se `isOperator && !canRelease` → botão liberar oculto.
- Se `isOperator && canRelease` → mostrar mini badge "R$ usado hoje X/Y • mês X/Y". Se valor a liberar + usado > limite → botão desabilitado com tooltip.
- Após liberar com sucesso, refetch da RPC.

**`src/pages/admin/Users.tsx`**
- Nova ação por linha (visível para admin/super_admin) "Autorização de liberação": abre `OperatorAuthorizationDialog` com switch `can_release` e dois inputs R$ (dia/mês). Upsert em `operator_release_permissions`. Só habilitado quando `role === 'operator'`.

**Erros do RPC**: capturar mensagens `Operador sem autorização` e `Limite … atingido` e exibir via toast destructive.

**Rotas**: em `src/App.tsx`, manter as rotas atuais; o guard no layout já cobre operador. `LaundryGuard` continua exigindo lavanderia selecionada.

## Fora do escopo
- Fluxo de "solicitar aprovação com PIN do gerente em tempo real" (não solicitado).
- Alteração no widget de crédito manual da tela `/admin/payments` (rota já bloqueada para operador pelo guard).
- Alterações nos fluxos do Totem e edge functions de pagamento.
