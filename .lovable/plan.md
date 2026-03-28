

# Auditoria Completa do Sistema Top Lavanderia

## Problemas Encontrados

### 1. CRITICO: Totem (anon) nao consegue ler esp32_status
A politica RLS `esp32_select_authenticated` na tabela `esp32_status` so permite SELECT para `authenticated`. O totem roda como `anon`, entao **nao consegue ler o status dos ESP32s**. Isso significa que o totem trata todas as maquinas como offline (heartbeat nunca chega), e a sincronizacao de status fica quebrada.

**Correcao:** Adicionar politica SELECT para `anon` em `esp32_status` (leitura publica, igual a `machines`).

### 2. CRITICO: esp32-credit-release falha — query sem filtro laundry_id
O log mostra: `Error: ESP32 configurations not found in system settings`. A Edge Function faz `.select('esp32_configurations').single()` sem filtrar por `laundry_id`, o que falha se houver mais de uma lavanderia. Alem disso, o conceito de "credit release" via `esp32_configurations` e legado — o sistema real usa `esp32-control` + `pending_commands`.

**Correcao:** Reescrever `esp32-credit-release` para receber `laundry_id` e filtrar, OU depreciar em favor de `esp32-control` que ja funciona.

### 3. IMPORTANTE: Imports inconsistentes de useToast
5 ficheiros importam de `@/components/ui/use-toast` (antigo shadcn) em vez de `@/hooks/use-toast` (Sonner):
- `useESP32CreditRelease.ts`
- `CreditReleaseWidget.tsx`
- `useTEFIntegration.ts`
- `useTEFHealthMonitor.ts`
- `TEFPositivoL4Config.tsx`

Isso pode causar toasts duplicados ou nao aparecerem. Todos devem usar `@/hooks/use-toast`.

### 4. Status no tablet vs painel — causa raiz
O Realtime esta ativo (confirmado: `machines` e `esp32_status` na publicacao). O polling esta a 7s no nativo. O problema principal e o **item 1**: sem leitura de `esp32_status`, o totem ve tudo como offline. Alem disso, quando o admin faz `forceMachineReleased`, o UPDATE em `machines` dispara Realtime, mas o totem precisa tambem ler `esp32_status` para computar o estado correto.

### 5. Liberacao manual remota — funciona parcialmente
`forceMachineReleased` no admin (Machines.tsx e MachineDetailsDialog.tsx):
- Atualiza `machines.status` para `available` — OK
- Espelha `relay_status` no `esp32_status` para OFF — OK
- Enfileira comando OFF no ESP32 via `esp32-control` — OK

Problema: `forceMachineReleased` usa client-side Supabase (`supabase` do frontend). O UPDATE em `machines` para `available` exige role `admin` ou `super_admin` (politica RLS). **Funciona para admin autenticado**, mas nao para uma eventual API remota. O fluxo esta correto para o painel admin.

### 6. CreditReleaseWidget nao permite escolher maquina
O widget sempre envia `esp32Id: 'main'` hardcoded. Deveria permitir selecionar a maquina especifica para liberacao remota.

### 7. user_credits INSERT falha sem user_id
A Edge Function `esp32-credit-release` insere em `user_credits` com `user_id: null`, mas a coluna `user_id` e NOT NULL. Isso causa falha silenciosa no registro.

---

## Plano de Implementacao

| # | Acao | Tipo |
|---|------|------|
| 1 | Adicionar politica RLS SELECT em `esp32_status` para `anon` | SQL Migration |
| 2 | Corrigir 5 imports de `useToast` para `@/hooks/use-toast` | Codigo React |
| 3 | Corrigir `esp32-credit-release` para filtrar por `laundry_id` e tratar `user_id` nullable | Edge Function |
| 4 | Melhorar `CreditReleaseWidget` para permitir selecao de maquina | Codigo React |

### Detalhes Tecnicos

**Migracao SQL (item 1):**
```sql
CREATE POLICY "Allow anon read esp32_status"
  ON public.esp32_status
  FOR SELECT
  TO anon
  USING (true);
```

**Imports (item 2):** Substituir `from '@/components/ui/use-toast'` por `from '@/hooks/use-toast'` nos 5 ficheiros listados.

**Edge Function (item 3):** Adicionar `laundry_id` ao body, filtrar `system_settings` por ele, e tornar `user_id` no INSERT de `user_credits` compativel com o schema (ou remover o INSERT se nao fizer sentido sem utilizador).

**Widget (item 4):** Receber lista de maquinas e permitir selecionar qual liberar, passando `machineId` e `esp32Id` corretos.

---

## Sugestoes de Melhoria

1. **Funcionalidade de liberacao remota de ciclo dedicada**: Criar um botao "Iniciar Ciclo Remoto" no painel admin que faz o mesmo que o totem (status → running + esp32-control ON + transaction), util para testes ou atendimento ao cliente.

2. **Dashboard de saude ESP32**: Indicador visual no painel admin mostrando tempo desde ultimo heartbeat de cada ESP32, com alerta amarelo (>1min) e vermelho (>2min).

3. **Notificacoes push**: Quando uma maquina termina o ciclo ou entra em manutencao, notificar o admin via browser notification ou webhook.

