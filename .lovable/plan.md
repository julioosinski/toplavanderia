

## Diagnóstico: Máquina volta para "Disponível" imediatamente

### Causa raiz

Há um **conflito de mapeamento de relay_pin** entre três camadas:

```text
DB machines:     relay_pin = 2          → UI procura relay_2
Firmware:        RELAY_LOGICAL_PIN = 1  → reporta relay_1
esp32_status:    { relay_1: "on" }      → relay_2 não existe!
```

**Fluxo do problema:**
1. `esp32-credit-release` cria `pending_command` com `relay_pin = 2` (do banco)
2. `confirm_command` salva `relay_2: "on"` no `esp32_status` e status = `running` ✅
3. **30 segundos depois**, o heartbeat chega com `{ relay_1: "on" }` e **sobrescreve** todo o `relay_status` → `relay_2` desaparece
4. A detecção de mudança de relé (linhas 256-272) vê `relay_2` indo de `"on"` para `undefined` → interpreta como desligamento → marca transação como `completed`
5. `computeMachineStatus` no frontend procura `relay_2`, não encontra → mostra "Disponível"

### Solução

Corrigir o **heartbeat handler** na Edge Function `esp32-monitor` para mapear o relay reportado pelo firmware para o `relay_pin` configurado no banco de dados.

#### 1. `esp32-monitor` — Heartbeat: mapear relay_status do firmware para o DB

Antes de salvar o `relay_status`, consultar a tabela `machines` para este `esp32_id` e remapear as chaves:

```text
Firmware reporta: { relay_1: "on" }
DB machine tem:   relay_pin = 2
Salva como:       { relay_2: "on" }
```

Isso garante que:
- O `relay_status` no `esp32_status` sempre usa a numeração do banco
- A detecção de mudança off→on / on→off funciona corretamente
- O `computeMachineStatus` no frontend encontra a chave certa

#### 2. `esp32-monitor` — Heartbeat: merge em vez de sobrescrever

Ao salvar o `relay_status`, fazer merge com o valor existente em vez de substituir completamente, para não perder estados de outros relés caso haja mais de uma máquina por ESP32.

### Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/esp32-monitor/index.ts` | Mapear relay_status do firmware para relay_pin do banco + merge |

### Resultado esperado

Após a correção, o heartbeat do ESP32 reportando `{ relay_1: "on" }` será mapeado para `{ relay_2: "on" }` no banco. O frontend encontrará `relay_2: "on"`, `computeMachineStatus` retornará `running`, e a máquina permanecerá "Em Uso" durante todo o ciclo.

