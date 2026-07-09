
## Problema

No dashboard, quando o operador clica em "Iniciar ciclo manual" numa máquina (lavadora/secadora/poltrona), o app chama a edge function `esp32-credit-release`. Essa função só valida se o usuário tem role `admin`/`operator` na lavanderia — **não** consulta `operator_release_permissions.can_release` nem os limites `daily_limit_cents`/`monthly_limit_cents`. Por isso qualquer operador com role está liberando máquinas mesmo sem autorização e sem respeitar o teto de valor.

As demais telas (Máquinas, CoffeeMenu, MassageChairConfig, CoffeeMachineConfig) já usam a RPC `admin_remote_release`, que aplica exatamente essas regras (checa `operator_release_permissions` + soma de transações `manual_release` do dia/mês por usuário/lavanderia).

## Correção

Uma alteração pontual, sem mexer em backend nem em outras telas:

1. **`src/components/admin/MachineDetailsDialog.tsx` → `handleStartManualCycle`**
   - Trocar `supabase.functions.invoke("esp32-credit-release", ...)` por `adminRemoteRelease({ machineId: machine.id })`.
   - Manter o `confirm`, o toast de sucesso, o delay de 800 ms e o `onAfterAction`.
   - Em caso de erro, exibir a mensagem retornada pela RPC (ex.: "Operador sem autorização para liberar", "Limite diário atingido (R$ X/Y usado hoje)") no toast, para o operador entender o motivo.

Assim o fluxo de acionamento manual do dashboard passa a respeitar:
- `operator_release_permissions.can_release = true` (senão bloqueia com "Operador sem autorização");
- `daily_limit_cents` e `monthly_limit_cents` do próprio operador (bloqueia antes de enfileirar o comando quando o próximo release ultrapassaria o teto).

Admins e super_admins continuam liberando sem limite, pois a própria RPC já isenta esses papéis.

## Fora do escopo

- Não vou alterar `esp32-credit-release` nem `CreditReleaseWidget`/`ESP32MonitorTab` neste passo — o pedido é corrigir o botão do operador no dashboard, que é o único caminho exposto para ele. Se você quiser, num passo seguinte eu aplico as mesmas checagens dentro da edge function para blindar qualquer outro chamador.
