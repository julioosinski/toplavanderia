# Revisão do sistema — Dashboard, armazenamento e performance

## 1. Por que o dashboard não atualiza o status das máquinas

Investiguei `src/pages/admin/Dashboard.tsx` + `src/hooks/useMachines.ts` + Realtime do Supabase. Achei **3 causas** que se somam:

### Causa A — Realtime não publica `machines` para o tablet/admin de outras lavanderias
A publicação `supabase_realtime` está ativa para `machines` e `esp32_status` (confirmado), mas a UI **só assina canais com `filter=laundry_id=eq.<id>`**. Quando o admin está em "Todas as lavanderias" (`isViewingAll = true`), `laundryIdForMachines` vira `undefined` → `useMachines` é chamado sem filtro, mas a tela mostra `ConsolidatedMachineStatus` cujos dados vêm de `loadConsolidatedMachines` (estado `machinesByLaundry`), que **só é atualizado pelo `setInterval(15000)`** — sem Realtime. Resultado: em modo "global" o status leva até 15 s para mudar, e quando muda a contagem dos KPIs (`machineStats`) não bate porque vem de `machines` (outro hook).

### Causa B — ESP32s "fantasmas" antigos confundem o cálculo
A tabela `esp32_status` tem 15 linhas, mas só 2 estão realmente online (heartbeat < 1 s). **9 ESP32s estão com último heartbeat > 13 dias** (até 248 dias). Eles não causam erro, mas:
- Inflam queries, payload do Realtime e cálculos.
- Se algum estiver atrelado a uma máquina ativa (ex.: `lavadora_01`, `secadora_02`) a máquina aparece "offline" para sempre.

### Causa C — `KEY` do refetch só inclui `laundry_id`
Quando o usuário troca de lavanderia rapidamente, `useMachines` reconstrói o canal mas o `setInterval` antigo ainda pode disparar `runBg()` com `laundryId` velho via closure. Já mitigado parcialmente, mas vamos garantir cleanup.

### Correções (todas frontend + 1 limpeza de dados)
1. **Dashboard.tsx** — quando `isViewingAll`, assinar Realtime global em `machines` e `esp32_status` (sem filtro) e re-disparar `loadConsolidatedMachines()` no evento, em vez de depender apenas do `setInterval(15s)`.
2. **Dashboard.tsx** — reduzir intervalo de refresh consolidado de 15 s → 8 s e usar `Promise.all` por lavanderia (hoje é serial `for...of`).
3. **useMachines.ts** — no canal `esp32-status-changes`, fazer atualização **incremental** (apenas recomputa status em memória sem refetch completo das máquinas) para reduzir tráfego.
4. **Limpeza de dados** — script SQL que apaga linhas em `esp32_status` com `last_heartbeat < now() - interval '7 days'` (12 linhas removidas).

## 2. Sugestões de melhoria geral

| Área | Hoje | Sugestão |
|---|---|---|
| Polling | `useMachines` poll 2,5 s (nativo) + 5 s (web) **mesmo quando aba está em background** | Pausar polling se `document.hidden === true` (visibilitychange já listener — só não chamar setInterval). Economia ~40 % de queries. |
| Dashboard consolidado | `for...of` sequencial sobre lavanderias | `Promise.all` paralelo |
| `audit_logs` | 1075 linhas / 976 kB e crescendo. Função `cleanup_old_logs()` existe mas **não tem cron** | Criar cron `pg_cron` diário rodando `cleanup_old_logs()` |
| `pending_commands` | 102 linhas acumuladas (comandos já executados) | Cron 1×/h: `DELETE FROM pending_commands WHERE status IN ('executed','failed') AND created_at < now() - interval '24 hours'` |
| `transactions` pendentes antigas | Várias `pending` de meses atrás (do problema PIX) | Cron diário: marcar `cancelled` se `status='pending' AND created_at < now() - interval '1 day'` |
| Tipos | `useMachines` faz fallback de RPC mesmo para admin autenticado quando esp32 vier vazio (caso raro) | Pequeno refactor — manter direct query |
| Logo storage | Bucket `laundry-logos` público sem limite de tamanho | Adicionar validação client-side (max 200 KB, WebP) |

## 3. Economia de armazenamento Supabase

**Estado atual (banco):** 976 kB `audit_logs` + 152 kB `pending_commands` + 136 kB `transactions` + outros = **~1,9 MB**. Está dentro do tier free, mas vai crescer.

**Ações de impacto:**
1. **Cron `cleanup_old_logs`** (já criado, falta agendar) — mantém `audit_logs` < 90 dias e `security_events` resolvidos < 180 dias.
2. **Cron limpeza `pending_commands`** — comandos executados/falhos > 24 h. Hoje 102 linhas, vai pra ~5.
3. **Cron limpeza `esp32_status` órfãos** — heartbeat > 30 dias e não vinculado a máquina ativa.
4. **Não logar tudo em `audit_logs`** — o trigger `log_audit_trail` (se aplicado a muitas tabelas) é principal vetor de crescimento. Sugiro aplicar só a `user_roles`, `system_settings`, `laundries` — não a `transactions`/`machines` (que já têm histórico próprio).
5. **Compressão de payload Realtime** — assinar só os eventos `UPDATE` relevantes (não `*`) em `esp32_status` reduz mensagens (cobradas no tier pago).

## 4. Agilizar o app
- Pausar polling em background (item acima) — UX e bateria do tablet.
- `useMachines`: aplicar `applyLocalMachineStatus` ao receber Realtime ao invés de refetch completo.
- Pré-carregar `useMachines` no `Home` para que o Dashboard abra com dados já em cache (`React Query` traria essa cache nativamente, mas hoje é state local).
- Dashboard: lazy-load `ConsolidatedMachineStatus` (só carrega quando `isViewingAll`).

## Arquivos afetados
- `src/pages/admin/Dashboard.tsx` — Realtime global + paralelismo + lazy
- `src/hooks/useMachines.ts` — pausar em background, refetch incremental
- Nova migração SQL — agendamento `pg_cron` (cleanup_old_logs, pending_commands, transactions pendentes, esp32_status órfãos)
- (opcional) `src/components/admin/ConsolidatedMachineStatus.tsx` — receber prop `loading` separada

## Perguntas
1. Posso aplicar **todos** os cron jobs sugeridos (`audit_logs`, `pending_commands`, `transactions pending`, `esp32_status` órfãos), ou prefere revisar um a um?
2. Posso **apagar agora os 12 ESP32s `esp32_status` com heartbeat > 7 dias** (não há máquina ativa apontando para eles além de `lavadora_01`/`secadora_02` que aparentemente estão fora de uso há meses)?
3. Manter `audit_logs` ativo só para `user_roles` + `system_settings` + `laundries` (remover trigger das demais)?
