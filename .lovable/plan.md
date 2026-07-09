## Contexto

- Você aumentou o limite diário para **R$ 10,00** (banco confirma: `daily_limit_cents = 1000`, `monthly_limit_cents = 1000`).
- Uso do operador hoje: **R$ 6,00** (6 liberações de R$ 1,00). Próxima liberação (R$ 1,00) daria R$ 7,00 — **abaixo do limite**.
- Mesmo assim a chamada `POST /rest/v1/rpc/admin_remote_release` volta **400**.
- O toast atual só mostra "Falha desconhecida" porque o `error.message` do PostgREST está sendo perdido no caminho.

Ou seja: o 400 **não** é mais o "Limite diário atingido". É outra coisa (provavelmente `Máquina sem ESP32 configurado`, `Sem permissão`, ou algum erro Postgres) — mas a UI está engolindo a mensagem real.

## O que fazer

### 1. Capturar e exibir o motivo real do 400
Em `src/lib/deviceRemoteRelease.ts`, o RPC retorna um `PostgrestError` com `message`, `details`, `hint`, `code`. Hoje o wrapper faz `return { error: error as Error }`, mas o consumidor às vezes só lê `error.message`. Vamos:

- Construir uma `Error` normalizada com `message` = `error.message || error.details || error.hint || 'Erro ao liberar'` e anexar `code`/`details` em `console.error` para diagnóstico.
- Fazer `console.error('[adminRemoteRelease]', error)` sempre que retornar erro, para o próximo turno ter o motivo real nos logs.

### 2. Melhorar `classifyReleaseError`
Em `src/lib/manualReleaseFeedback.ts` (arquivo já criado), adicionar mapeamento para os erros que ainda caem no genérico:

- `"máquina não encontrada"` → "Máquina não encontrada"
- `"máquina sem esp32"` → "Máquina sem ESP32 configurado — cadastre o ESP32 no painel de máquinas"
- `"produto de café inválido"` → "Produto de café inválido"
- `"informe product_id ou valor_centavos"` → "Valor de café não informado"
- fallback: manter a mensagem crua do banco (nunca "Falha desconhecida")

### 3. Toasts que sempre mostram o texto do banco
Nos 4 pontos de chamada de `adminRemoteRelease`:
- `src/components/admin/MachineDetailsDialog.tsx` (2 lugares)
- `src/pages/admin/Machines.tsx` (3 lugares: café, poltrona, operador)

Trocar `toast({ title: 'Erro', description: error.message })` por `toast(classifyReleaseError(error.message))` para que o operador veja **exatamente** o motivo devolvido pela RPC (por ex.: "Máquina sem ESP32 configurado" ou "Limite diário atingido (R$ 6,00/10,00 usado hoje)").

### 4. Confirmar pré-checagem sincronizada
No `MachineDetailsDialog`, antes de chamar a RPC, já estamos fazendo `permission.refetch()` e usando `getManualReleaseBlock`. Vou reaproveitar a mesma pré-checagem em `src/pages/admin/Machines.tsx` (fluxo operador), para que operadores vejam o bloqueio **antes** do 400 quando for realmente limite/autorização.

## Fora do escopo

- Não alterar a RPC `admin_remote_release` nem a `get_operator_release_usage`.
- Não mexer no firmware/edge functions.
- Não tocar em Dashboard/Faturamento.

## Como validar

Depois de aplicado, você tenta liberar a máquina de novo. Se ainda der 400, o toast agora vai dizer o texto exato do banco (ex.: "Máquina sem ESP32 configurado", "Sem permissão para liberar esta máquina") — e me manda o texto para eu corrigir a causa raiz no próximo passo.