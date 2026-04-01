

## Plano: Acelerar atualização de status das máquinas

### Diagnóstico

O `useMachines` no browser web faz polling a cada **15 segundos** (`POLL_MACHINES_MS = 15000`). Mesmo com Realtime habilitado nas tabelas `machines` e `esp32_status`, o Realtime pode falhar silenciosamente (firewall, proxy), deixando o polling como único mecanismo. 15s é lento demais para refletir mudanças de status em tempo real.

Além disso, o Dashboard tem seu próprio polling de 30s (`loadDashboardData`) que recalcula stats a partir do array `machines` — mas como `machines` pode estar 15s defasado, os stats ficam inconsistentes.

### Solução

**1. Reduzir polling web para 5s** (`src/hooks/useMachines.ts`)
- Alterar `POLL_MACHINES_MS` de `15000` para `5000`
- Manter `POLL_MACHINES_NATIVE_MS` em `2500` (tablet já está rápido)

**2. Dashboard: reagir ao array `machines` em vez de polling independente** (`src/pages/admin/Dashboard.tsx`)
- Recalcular stats com `useMemo` derivado de `machines` (já vem do `useMachines`)
- Remover a query duplicada de `machines` no `loadDashboardData` — usar apenas para `transactions`
- Reduzir o intervalo do dashboard de 30s para 15s (apenas para receita/transações)
- Remover `setLoading(true)` nos refreshes subsequentes para evitar flash de skeleton

**3. Stats reativas** (`src/pages/admin/Dashboard.tsx`)
- Os contadores de "disponíveis", "offline", "manutenção" passam a atualizar instantaneamente quando `useMachines` atualiza, sem esperar o ciclo de 30s do dashboard

### Arquivos editados

| Arquivo | Mudança |
|---|---|
| `src/hooks/useMachines.ts` | `POLL_MACHINES_MS`: 15000 → 5000 |
| `src/pages/admin/Dashboard.tsx` | Stats derivadas de `machines` via `useMemo`; query de dashboard só busca transactions; intervalo 30s → 15s; sem skeleton em refresh |

### Impacto

- Status das máquinas atualiza em no máximo 5s (web) ou 2.5s (tablet)
- Cards de stats no dashboard reagem instantaneamente às mudanças de `useMachines`
- Menos queries duplicadas ao Supabase (remove SELECT em machines do dashboard)

