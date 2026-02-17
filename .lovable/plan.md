

# Corrigir Arquitetura de Comunicacao ESP32 (Pull em vez de Push)

## Problema Atual

O sistema tenta enviar comandos HTTP diretamente para o IP local do ESP32 a partir da edge function na nuvem. Isso nunca funciona porque:
- Edge functions rodam nos servidores do Supabase (cloud)
- ESP32 esta em rede local (192.168.x.x)
- A nuvem nao consegue acessar IPs privados

## Solucao: Modelo Pull (ESP32 busca comandos)

Em vez do servidor empurrar comandos para o ESP32, o ESP32 periodicamente consulta o servidor por comandos pendentes.

```text
ANTES (nao funciona):
  Totem -> Edge Function -> HTTP para 192.168.x.x -> ESP32
                            ^^^^^ BLOQUEADO ^^^^^

DEPOIS (funciona):
  Totem -> Edge Function -> Insere em pending_commands
  ESP32 -> Consulta pending_commands a cada 5s -> Executa -> Confirma
```

## Mudancas Necessarias

### 1. Firmware ESP32 (`public/arduino/ESP32_AutoConfig_v3.ino`)

Adicionar no loop principal:
- A cada 5 segundos, fazer GET para `supabase/functions/v1/esp32-monitor?action=poll_commands&esp32_id=esp32_XXYYZZ`
- Se houver comandos pendentes, executar (ligar/desligar relay)
- Apos executar, confirmar com POST para marcar comando como `executed`

Novo trecho no loop:
```text
if (millis() - lastCommandPoll > 5000) {
  pollPendingCommands();  // GET -> verifica pending_commands
  lastCommandPoll = millis();
}
```

Nova funcao `pollPendingCommands()`:
- Faz GET para a edge function pedindo comandos pendentes para seu esp32_id
- Recebe lista de comandos (relay_pin, action)
- Executa cada comando (digitalWrite no relay)
- Confirma execucao enviando POST com o command_id

### 2. Edge Function `esp32-control` (`supabase/functions/esp32-control/index.ts`)

Simplificar para APENAS inserir na tabela `pending_commands`:
- Remover toda logica de HTTP fetch para IP local (linhas 83-174)
- Inserir comando na tabela `pending_commands` com status `pending`
- Retornar imediatamente com `{ success: true, queued: true }`
- O ESP32 vai buscar e executar o comando em ate 5 segundos

### 3. Edge Function `esp32-monitor` (`supabase/functions/esp32-monitor/index.ts`)

Adicionar acao `poll_commands`:
- Receber `esp32_id` como parametro
- Buscar comandos pendentes na tabela `pending_commands` para aquele esp32_id
- Retornar lista de comandos
- Quando ESP32 confirmar execucao, atualizar status para `executed` e atualizar a maquina correspondente

### 4. Tabela `pending_commands` - Adicionar campo

Adicionar coluna `executed_at` (timestamp) para registrar quando o ESP32 executou o comando.

## Detalhes Tecnicos

### Fluxo completo apos a mudanca:

1. Usuario seleciona maquina no Totem e paga
2. Totem chama edge function `esp32-control`
3. Edge function insere registro em `pending_commands` com status `pending`
4. Edge function retorna `{ success: true, queued: true }` para o Totem
5. ESP32 faz polling a cada 5 segundos via `esp32-monitor?action=poll_commands`
6. ESP32 recebe o comando pendente
7. ESP32 executa (liga o relay)
8. ESP32 confirma execucao via `esp32-monitor?action=confirm_command`
9. Edge function atualiza `pending_commands` para `executed` e `machines.status` para `running`

### Arquivos a modificar:

| Arquivo | Mudanca |
|---------|---------|
| `public/arduino/ESP32_AutoConfig_v3.ino` | Adicionar polling de comandos no loop + funcao pollPendingCommands() + funcao confirmCommand() |
| `supabase/functions/esp32-control/index.ts` | Remover fetch HTTP local, apenas inserir em pending_commands |
| `supabase/functions/esp32-monitor/index.ts` | Adicionar acoes poll_commands e confirm_command |
| Migracao SQL | Adicionar coluna executed_at em pending_commands |

### Sobre IPs dinamicos:

Com esta arquitetura, o IP do ESP32 deixa de ser critico para o funcionamento. O ESP32 e quem inicia a conexao com a nuvem (pull), entao:
- IP pode mudar a qualquer momento sem problema
- Multiplos ESP32 na mesma rede funcionam independentemente
- Cada um usa seu esp32_id unico (baseado no MAC) para buscar seus proprios comandos
- O IP continua sendo reportado no heartbeat apenas para fins de monitoramento/debug

### Tempo de resposta:

- Polling a cada 5 segundos significa que a maquina liga em no maximo 5 segundos apos o pagamento
- Pode ser reduzido para 2-3 segundos se necessario (mais requisicoes ao servidor)
- Alternativa futura: usar WebSocket para resposta instantanea (mais complexo)

