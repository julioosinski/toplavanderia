

## Sincronizar tempo de ciclo do painel com o ESP32

### Problema

O ESP32 usa `CYCLE_TIME_MINUTES` como constante compilada (`#define CYCLE_TIME_MINUTES 40`). Quando o admin altera o tempo de ciclo no painel, o ESP32 não recebe essa informação — continua usando o valor antigo até o firmware ser recompilado e reenviado.

### Solução

Usar o fluxo de comunicação existente (heartbeat response + poll_commands) para enviar o `cycle_time_minutes` atualizado do banco para o ESP32, que passará a usar o valor recebido em vez do hardcoded.

### Mudanças

#### 1. Edge Function `esp32-monitor` — incluir config na resposta do heartbeat

Na seção do heartbeat (linha ~289), antes de retornar, buscar `cycle_time_minutes` da tabela `machines` para o ESP32 que enviou o heartbeat e incluir na resposta:

```json
{
  "success": true,
  "next_interval": 30,
  "config": {
    "cycle_time_minutes": 35
  }
}
```

#### 2. Edge Function `esp32-monitor` — incluir config no poll_commands

Na resposta do `poll_commands`, incluir também o `cycle_time_minutes` da máquina associada ao comando `on`, para que o ESP32 saiba a duração correta ao iniciar o ciclo.

#### 3. Firmware `ESP32_Lavadora_Individual_CORRIGIDO_v2.ino`

- Converter `CYCLE_TIME_MINUTES` de `#define` para variável global `int cycleTimeMinutes = 40;`
- No `sendHeartbeat()`, após receber resposta HTTP 200, parsear o JSON e extrair `config.cycle_time_minutes` — se presente, atualizar `cycleTimeMinutes`
- No `pollSupabaseCommands()`, ao processar comando `on`, extrair `cycle_time_minutes` se presente no comando
- O `loop()` já usa `CYCLE_TIME_MINUTES` para desligar o relé — apenas trocar pela variável

#### 4. Firmware template `src/firmware/esp32LavadoraTemplate.ino`

Aplicar as mesmas mudanças para manter ambos alinhados.

### Arquivos modificados

| Arquivo | Ação |
|---|---|
| `supabase/functions/esp32-monitor/index.ts` | Retornar `cycle_time_minutes` no heartbeat e poll_commands |
| `public/arduino/ESP32_Lavadora_Individual_CORRIGIDO_v2.ino` | Usar variável dinâmica + parsear config da resposta |
| `src/firmware/esp32LavadoraTemplate.ino` | Mesmo alinhamento do firmware principal |

### Fluxo após a mudança

```text
Admin altera cycle_time → DB machines.cycle_time_minutes = 35
   ↓
ESP32 envia heartbeat (a cada 30s)
   ↓
esp32-monitor lê machines WHERE esp32_id + laundry_id
   ↓
Resposta: { config: { cycle_time_minutes: 35 } }
   ↓
ESP32 atualiza cycleTimeMinutes = 35
   ↓
Próximo ciclo usa 35 minutos
```

A atualização reflete no ESP32 em no máximo 30 segundos (próximo heartbeat).

