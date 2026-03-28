

# Sincronizar Lovable com Repositorio Local + Backend Supabase

## Situacao Atual

Apos analise detalhada, **o codigo React no Lovable ja contem quase todas as alteracoes do commit**:
- ADMIN_PANEL_ROLES, NoAccess, LaundryGuard, LaundryContext com `isViewingAllLaundries`/`switchToAllLaundries` — presentes
- useMachines com prioridade BD sobre rele, ciclo+2min, poll 7s nativo, `runningSinceAt` — presente
- useMachineAutoStatus com intervalo 45s e `mergeRelayIntoEsp32Status` — presente
- Toasts delegando para Sonner, sem Toaster shadcn — presente
- Link "Area da equipe" no Totem — presente
- `machineEsp32Sync.ts`, `paygoPixResponse.ts` — presentes
- ESP32Diagnostics filtrado por `currentLaundry` — presente
- LaundrySelector sem `window.location.reload()` — confirmado

**O que falta sao ajustes no Supabase (backend):**

---

## 1. Ativar Realtime para machines e esp32_status

A migracao `20260328140000_enable_realtime_machines_esp32.sql` existe no repositorio mas **nao foi aplicada** — as tabelas nao estao na publicacao `supabase_realtime`.

**Acao:** Executar migracao SQL para adicionar ambas as tabelas a publicacao Realtime. Isso permite que o totem (anon) receba eventos em tempo real quando o admin altera preco, ciclo ou status.

---

## 2. Corrigir RLS: Totem precisa de UPDATE em machines

O totem chama `updateMachineStatus(id, 'running')` apos pagamento, mas a politica atual exige `is_super_admin` ou `has_role('admin')`. Como o totem roda sem autenticacao (anon), o UPDATE falha silenciosamente.

**Acao:** Criar politica RLS que permita ao role `anon` fazer UPDATE **apenas do campo status** em machines. Para limitar o escopo:
- Permitir UPDATE publico em machines, restrito a alteracoes de status para `'running'` (via check constraint ou politica com `WITH CHECK`)
- Alternativa mais segura: criar uma Edge Function `update-machine-status` com `service_role` que o totem invoca, validando que so aceita transicoes `available → running`

**Recomendacao:** Edge Function (opcao segura), evitando dar UPDATE direto ao anon.

---

## 3. Liberacao automatica server-side (opcional mas recomendado)

Atualmente a liberacao de maquinas apos fim de ciclo depende de `useMachineAutoStatus` rodando no browser do admin. Se nenhum admin estiver logado, maquinas ficam "running" indefinidamente no banco.

**Acao:** Criar Edge Function `auto-release-machines` invocada por pg_cron (ou pelo proprio ESP32 via `esp32-monitor`) que:
1. Busca maquinas com `status = 'running'` ha mais de `cycle_time_minutes + 2` minutos
2. Atualiza para `available`
3. Espelha `relay_status` no `esp32_status`

Isso garante liberacao confiavel sem depender de nenhum browser aberto.

---

## 4. Edge Functions existentes

`esp32-control` ja aceita o body `{ esp32_id, relay_pin, action, machine_id }` — alinhado com o totem. Nenhuma alteracao necessaria.

---

## Resumo de Implementacao

| # | Acao | Tipo |
|---|------|------|
| 1 | Aplicar migracao Realtime (machines + esp32_status) | SQL Migration |
| 2 | Criar Edge Function `update-machine-status` para totem | Edge Function + codigo |
| 3 | Criar Edge Function `auto-release-machines` | Edge Function (opcional) |
| 4 | Atualizar `useMachines.updateMachineStatus` para usar a Edge Function | Codigo React |

