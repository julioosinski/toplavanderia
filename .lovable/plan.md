

## Diagnóstico: Comando manual não aciona o ESP32

### Causa raiz encontrada

O problema é um **conflito de relay_pin** entre o banco de dados e o firmware.

**No banco de dados**, as máquinas (ex: Lavadora 01) têm `relay_pin = 2`.

**No firmware**, o ESP32 tem `RELAY_LOGICAL_PIN = 1`.

Quando o comando manual é criado via `esp32-credit-release`, ele insere na `pending_commands` com `relay_pin = 2` (lido do banco). O firmware busca esse comando, mas na linha 302 faz:

```cpp
if (cmdRelay != RELAY_LOGICAL_PIN) {
  // Ignora o comando e confirma como "completed" sem executar!
  confirmSupabaseCommand(cid);
  continue;
}
```

O comando é **confirmado como executado** sem nunca ligar o relé. Por isso aparece como "completed" mas nada acontece fisicamente.

### Solução

Há duas abordagens (implementaremos ambas para robustez):

#### 1. Firmware: usar o relay_pin do comando em vez de ignorá-lo

O firmware não deveria rejeitar relay_pins diferentes — ele deveria mapear o relay lógico para o GPIO físico correto. Como cada ESP32 neste sistema controla apenas 1 máquina com 1 relé (GPIO 2), o firmware deve aceitar qualquer relay_pin e acionar o mesmo GPIO.

**Arquivo**: `public/arduino/ESP32_Lavadora_Individual_CORRIGIDO_v2.ino` e `src/firmware/esp32LavadoraTemplate.ino`

- Remover a verificação `if (cmdRelay != RELAY_LOGICAL_PIN)` que pula o comando
- Aceitar qualquer relay_pin e acionar o GPIO configurado (`RELAY_PIN`)
- Manter o log informativo mas sem ignorar

#### 2. Edge Function: garantir consistência do relay_pin

**Arquivo**: `supabase/functions/esp32-credit-release/index.ts`

- Usar `machine.relay_pin || 1` ao criar o pending_command (já faz isso, está correto)

### Mudança necessária no firmware (principal)

Substituir as linhas 301-306 de:
```cpp
int cmdRelay = c["relay_pin"] | RELAY_LOGICAL_PIN;
if (cmdRelay != RELAY_LOGICAL_PIN) {
  Serial.printf("Ignorando comando relay_%d\n", cmdRelay, RELAY_LOGICAL_PIN);
  confirmSupabaseCommand(cid);
  continue;
}
```

Para:
```cpp
int cmdRelay = c["relay_pin"] | RELAY_LOGICAL_PIN;
Serial.printf("📌 Comando relay_%d → GPIO físico %d\n", cmdRelay, RELAY_PIN);
```

Isso permite que o ESP32 execute o comando independentemente do relay_pin lógico, já que cada ESP32 controla apenas um GPIO.

### Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `public/arduino/ESP32_Lavadora_Individual_CORRIGIDO_v2.ino` | Remover filtro de relay_pin que bloqueia execução |
| `src/firmware/esp32LavadoraTemplate.ino` | Mesma correção |

