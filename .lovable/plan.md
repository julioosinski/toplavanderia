

## Plano: Unificar fonte de status — ESP32 como autoridade

### Diagnóstico

O problema central é que **existem 3 cálculos de status diferentes** no sistema, cada um com lógica própria, resultando em divergências entre Dashboard, aba Máquinas e Totem:

1. **`useMachines.ts` (Dashboard + Totem)** — linha 124: quando o banco diz `available`, **ignora o relé do ESP32** e mostra "Disponível" mesmo que `relay_1 = on`. Isso contradiz a preferência do usuário de que o ESP32 mande.

2. **`Machines.tsx` (aba Máquinas)** — linha 158: calcula `realStatus` a partir do relé E do banco (`dbRunning || relayOn → running`). Esse é o único lugar que respeita o ESP32 corretamente.

3. **Totem (tablet)** — usa `useMachines`, mas no modo anon depende do RPC `get_esp32_heartbeats` que pode retornar dados vazios se o laundryId estiver errado, ou cair no fallback sem relay_status.

**Evidência no banco agora**: Secadora 02 tem `relay_1=on`, `is_online=true`, heartbeat recente, mas `machines.status=available`. O Dashboard e Totem a mostram como "Disponível" (errado). A aba Máquinas a mostra como "Em Serviço" (correto).

Além disso, a **liberação manual** (`esp32-credit-release`) cria o `pending_command` e faz `UPDATE machines SET status='running'`, mas o próximo poll do `useMachines` pode sobrescrever esse estado se o ESP32 ainda não confirmou o relé como `on`.

### Solução

**Princípio**: O ESP32 é a fonte de verdade. Se o relé está `on` e o heartbeat é recente, a máquina está "em uso" — independente do que o banco de `machines.status` diga. Se o ESP32 está offline, mostrar "offline" (exceto se houver ciclo `running` com tempo restante — nesse caso, "em uso" com aviso "sem link").

#### 1. Unificar `transformMachine` em `useMachines.ts`

Reescrever a lógica de cálculo de status (linhas 79-175) para seguir a mesma abordagem da aba Máquinas:

```
Se maintenance no banco → maintenance (sempre)
Se ESP32 offline → offline (exceto running com tempo restante → running+hardwareLost)
Se ESP32 online:
  - Se relé ON → running
  - Se relé OFF E banco=running E tempo restante > 0 → running (transição pendente)
  - Senão → available
```

Remover a linha 124 que força `available` quando o banco diz `available` (isso ignora o ESP32).

#### 2. Ajustar `Machines.tsx` para usar a mesma lógica

Extrair a função de cálculo de status para `machineEsp32Sync.ts` como `computeMachineStatus()` e reutilizá-la tanto em `useMachines.ts` quanto em `Machines.tsx`, eliminando duplicação.

#### 3. Garantir que o Totem receba relay_status via RPC

O RPC `get_esp32_heartbeats` já retorna `relay_status` (migração `20260401185922`). Verificar que o fallback no `useMachines.ts` (linha 238-244) está usando esses dados corretamente. Adicionar log de debug para confirmar.

#### 4. Dashboard `ConsolidatedMachineStatus` — usar `useMachines` em vez de query direta

O `loadConsolidatedMachines` no Dashboard (linha 70-81) faz `SELECT * FROM machines` direto, sem consultar ESP32 status. Essas máquinas vão mostrar o status do banco sem considerar o ESP32. Precisa enriquecer com ESP32 data ou reutilizar a lógica unificada.

#### 5. Liberação manual — esperar confirmação do relé

Após `esp32-credit-release`, o `MachineDetailsDialog` faz `onAfterAction()` que re-fetcha as máquinas. Se o ESP32 ainda não confirmou o relé, o status volta para `available`. Solução: usar `postPaymentRunningRef` (já existe no Totem) também no admin, ou aceitar que o status será `running` no banco por 800ms e depois o poll confirma via relé.

### Arquivos editados

| Arquivo | Mudança |
|---|---|
| `src/lib/machineEsp32Sync.ts` | Nova função `computeMachineStatus(machine, esp32)` com lógica unificada |
| `src/hooks/useMachines.ts` | `transformMachine` usa `computeMachineStatus`; remove lógica duplicada inline |
| `src/pages/admin/Machines.tsx` | Enriquecimento de máquinas usa `computeMachineStatus` em vez de lógica inline |
| `src/pages/admin/Dashboard.tsx` | `loadConsolidatedMachines` enriquece com ESP32 data via mesma lógica |
| `src/components/admin/ConsolidatedMachineStatus.tsx` | Recebe máquinas já com status computado |

### Impacto

- Todas as telas (Dashboard, Máquinas, Totem) mostram o mesmo status
- ESP32 com relé `on` = máquina em uso, independente do campo `machines.status`
- Liberação manual reflete corretamente após o ESP32 confirmar
- Elimina 3 implementações diferentes da mesma lógica

