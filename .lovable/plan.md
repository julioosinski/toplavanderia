

## Análise: BLE ESP32 — O que falta para 100% funcional com dados reais

### Estado Atual

O sistema BLE já está bem estruturado:
- **Firmware v4.1-BLE**: Implementa BLE server com 3 características (Status, Command, Config), WiFi portal cativo, heartbeat e polling Supabase. UUIDs alinhados com o app.
- **Hook `useBLEDiagnostics`**: Scan, connect, read status, send command, configure WiFi via BLE.
- **Página `BLEDiagnostics.tsx`**: UI completa com scan, status, comandos, config WiFi e log.
- **AndroidManifest**: Todas as permissões BLE necessárias (BLUETOOTH_SCAN, BLUETOOTH_CONNECT, etc.) já estão declaradas.
- **Rota e menu**: `/admin/ble-diagnostics` registrada e visível no sidebar.

### Gaps identificados para operação real

#### 1. Falta de Notificações BLE em tempo real
O hook lê o status uma única vez após conectar (`BleClient.read`), mas não se inscreve para receber **notificações** quando o ESP32 atualiza o status (ex: relé mudou, WiFi reconectou). O firmware já envia `charStatus->notify()` após cada mudança.

**Correção**: Usar `BleClient.startNotifications()` na characteristic de Status para receber updates em tempo real e atualizar `esp32Status` automaticamente.

#### 2. Falta configurar Laundry ID via BLE
O firmware aceita `laundry_id` na characteristic CONFIG, mas a UI só envia SSID e senha WiFi. Um ESP32 novo precisa saber qual lavanderia ele pertence.

**Correção**: Adicionar campo "Laundry ID" na seção de configuração WiFi do `BLEDiagnostics.tsx`, e enviar junto no payload JSON da CONFIG characteristic.

#### 3. Falta botões para Relé 2
A UI só tem "Relé 1 ON/OFF". O firmware trata relay_1 e relay_2 como aliases para o mesmo GPIO, mas em ESP32s com 2 relés físicos (futuro), é importante ter controle de ambos.

**Correção**: Adicionar botões para "Relé 2 ON/OFF" e um botão "Forçar Heartbeat" para sincronizar imediatamente com o Supabase.

#### 4. Status BLE não sincronizado com Supabase
Quando se altera um relé via BLE, o ESP32 muda localmente mas o Supabase só descobre no próximo heartbeat (até 30s). O app BLE deveria poder pedir ao ESP32 para enviar heartbeat imediatamente.

**Correção**: Adicionar comando "force_heartbeat" no firmware e botão correspondente na UI.

#### 5. Auto-refresh do status após enviar comando
Após enviar um comando, o hook espera 1 segundo e faz `read()` — mas seria melhor usar as notificações BLE para atualização instantânea.

---

## Plano de Implementação

### Passo 1: Atualizar `useBLEDiagnostics` — Adicionar subscrição de notificações BLE
- Após conectar e ler o status inicial, chamar `BleClient.startNotifications()` no `CHAR_STATUS_UUID`
- Callback atualiza `esp32Status` em tempo real sempre que o ESP32 envia notify
- No disconnect, chamar `stopNotifications()`

### Passo 2: Atualizar `BLEDiagnostics.tsx` — Laundry ID + mais comandos
- Adicionar campo "Laundry ID" na seção de configuração WiFi, enviando no JSON da CONFIG characteristic
- Adicionar botões: Relé 2 ON/OFF, "Forçar Heartbeat" (`sendCommand("force_heartbeat")`)
- Adicionar botão "Atualizar Status" que faz read manual da characteristic

### Passo 3: Atualizar firmware — Comando `force_heartbeat`
- No `handleBleCommandLine`, adicionar case para `"force_heartbeat"` que chama `sendHeartbeat()` imediatamente
- Adicionar case para `"relay_2_on"` / `"relay_2_off"` (preparação para multi-relé)

### Passo 4: Configuração dinâmica do Laundry ID via CONFIG characteristic
- O firmware já aceita `laundry_id` no payload JSON da CONFIG — confirmar que funciona e salva no NVS
- Atualizar o payload JSON enviado pelo app para incluir `laundry_id` quando preenchido

### Resumo de arquivos alterados
- `src/hooks/useBLEDiagnostics.ts` — adicionar startNotifications, readStatus manual
- `src/pages/admin/BLEDiagnostics.tsx` — campo Laundry ID, botões extras, auto-refresh visual
- `public/arduino/TopLavanderia_v4_BLE/TopLavanderia_v4_BLE.ino` — comando force_heartbeat, relay_2 explícito, laundry_id na CONFIG

