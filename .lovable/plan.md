

## Diagnóstico dos 4 Problemas Encontrados

Após investigar o banco de dados, as Edge Functions e o código do frontend, identifiquei as causas-raiz de todos os 4 problemas reportados:

### Problema 1 & 2: Status não muda no app + Liberação manual não chega ao ESP32

**Causa**: Duas constraints no banco bloqueiam as operações:

- `pending_commands_action_check` aceita apenas `'on'` e `'off'`, mas a função `esp32-credit-release` insere `action: 'turn_on'` — o comando é **rejeitado silenciosamente** e nunca chega ao ESP32.
- `transactions_payment_method_check` aceita apenas `'credit'`, `'pix'`, `'card'`, `'cash'`, mas `esp32-credit-release` insere `'manual_release'` — a transação falha.

Os logs confirmam exatamente estes erros:
```
pending_commands_action_check violated → 'turn_on' not in ('on','off')
transactions_payment_method_check violated → 'manual_release' not in ('credit','pix','card','cash')
```

**Correção**:
1. **Migração SQL**: Adicionar `'manual_release'` e `'totem'` ao check constraint de `transactions.payment_method`. Adicionar `'turn_on'` e `'turn_off'` ao check constraint de `pending_commands.action` (ou alterar a Edge Function para usar `'on'`).
2. **Edge Function `esp32-credit-release`**: Mudar `action: 'turn_on'` para `action: 'on'` (alinha com o que o firmware e o `esp32-control` já usam).

### Problema 3: Diagnóstico ESP32 mostra 2 online (só 1 está ligado)

**Causa**: O ESP32 `"lavadora teste"` tem `is_online: true` no banco, mas seu último heartbeat foi há mais de 18 horas. O heartbeat só marca `is_online = true` — **nunca há nenhum processo que marque `is_online = false`** quando o dispositivo para de enviar heartbeats.

A página de Diagnóstico ESP32 usa `e.is_online` diretamente, sem verificar a idade do heartbeat.

**Correção**:
1. **Edge Function `esp32-monitor`** (heartbeat handler): Adicionar lógica para marcar como offline os ESP32s cujo `last_heartbeat` é mais antigo que 3 minutos (executar ao receber qualquer heartbeat).
2. **Página de Diagnóstico ESP32**: Usar a mesma lógica de freshness do `useESP32Status` (2 min) para determinar se está realmente online, não confiar no campo `is_online` do banco.

### Problema 4: Dashboard mostra 12/12 disponíveis (só 1 online)

**Causa**: O Dashboard (`loadDashboardData`) conta `activeMachines` como `machine.status === 'available'` diretamente do banco. Todas as 12 máquinas estão com `status: 'available'` no banco. O Dashboard **não** cruza com o status do ESP32 — diferente do `useMachines` que faz essa verificação.

**Correção**: O card "Disponíveis" no Dashboard deve considerar o status do ESP32. Usar a mesma lógica do `useMachines` (já carregado via `MachineStatusGrid`) para contar as máquinas por status computado em vez do status bruto do banco.

---

## Plano de Implementação

### Passo 1: Migração SQL — Corrigir check constraints
- Alterar `transactions_payment_method_check` para incluir `'manual_release'` e `'totem'`
- Manter `pending_commands_action_check` como está (apenas `'on'`/`'off'`) — corrigir o código que envia

### Passo 2: Corrigir `esp32-credit-release`
- Mudar `action: 'turn_on'` para `action: 'on'`

### Passo 3: Corrigir `esp32-monitor` — marcar offline automaticamente
- No handler de heartbeat, antes de retornar, executar UPDATE para marcar `is_online = false` em todos os ESP32s da mesma lavanderia cujo `last_heartbeat` é mais antigo que 3 minutos

### Passo 4: Corrigir Diagnóstico ESP32 — verificar freshness
- Em `ESP32Diagnostics.tsx` e `ESP32MonitorTab.tsx`, considerar o ESP32 offline se `last_heartbeat` for mais antigo que 2–3 minutos, independente do campo `is_online`

### Passo 5: Corrigir Dashboard — stats baseados no status computado
- Em `Dashboard.tsx`, usar os dados já computados pelo `useMachines` (que cruza com ESP32) para popular os stats cards, em vez de fazer query separada ao banco

