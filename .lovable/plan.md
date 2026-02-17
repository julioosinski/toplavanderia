

# ESP32 Auto-Configuravel - WiFi via Bluetooth + Auto-Registro

## Objetivo
Transformar o codigo do ESP32 para que seja "plug and play": basta ligar o ESP32, configurar o WiFi pelo celular via Bluetooth, e ele se registra automaticamente no sistema.

## O Que Muda

**Antes (manual):** Editar 5 linhas no codigo, recompilar e fazer upload para cada ESP32.

**Depois (automatico):** Fazer upload do mesmo codigo em todos os ESP32s. Configurar WiFi pelo celular via Bluetooth. O resto e automatico.

## Como Vai Funcionar

1. **Primeiro boot**: ESP32 liga e nao tem WiFi configurado. Ativa o Bluetooth (BLE) e aguarda conexao.
2. **Configuracao pelo celular**: O usuario abre o app/totem, conecta via Bluetooth, envia SSID, senha e LAUNDRY_ID.
3. **ESP32 salva na memoria**: Credenciais WiFi e LAUNDRY_ID sao salvos na memoria flash (persistem mesmo apos desligar).
4. **Conexao automatica**: ESP32 conecta ao WiFi e gera seu ID automaticamente a partir do MAC address (ex: `esp32_A1B2C3`).
5. **Auto-registro**: ESP32 envia heartbeat com `auto_register: true`. O servidor cria o registro automaticamente.
6. **Admin associa maquina**: No painel admin, o operador ve o ESP32 novo e associa a uma maquina existente.

## Detalhes Tecnicos

### 1. Novo Codigo Arduino (reescrita completa do .ino)

**Bibliotecas adicionais necessarias:**
- `BLEDevice.h` (ja incluida no ESP32 Arduino Core)
- `Preferences.h` (ja incluida no ESP32 Arduino Core)

**Estrutura do novo codigo:**

```text
[Boot]
  |
  v
[Ler Preferences (flash)]
  |
  +-- Tem WiFi salvo? --SIM--> [Conectar WiFi]
  |                               |
  |                               +-- Sucesso --> [Modo Normal: heartbeat + servidor HTTP]
  |                               |
  |                               +-- Falha --> [Ativar BLE para reconfigurar]
  |
  +-- NAO --> [Ativar BLE e aguardar configuracao]
```

**Dados salvos na flash (Preferences):**
- `wifi_ssid` - Nome da rede WiFi
- `wifi_pass` - Senha do WiFi
- `laundry_id` - UUID da lavanderia
- `configured` - Flag booleana (true/false)

**ESP32 ID automatico:**
```text
MAC Address: AA:BB:CC:DD:EE:FF
ESP32 ID gerado: "esp32_DDEEFF" (ultimos 3 bytes do MAC)
```

**Protocolo BLE:**
- Service UUID: `4fafc201-1fb5-459e-8fcc-c5c9c331914b`
- Caracteristica WiFi Config: recebe JSON `{"ssid":"rede","pass":"senha","laundry_id":"uuid"}`
- Caracteristica Status: retorna estado atual (configurado/conectado/erro)
- O ESP32 aparece como dispositivo BLE com nome `TopLav_DDEEFF`

**Pagina web de configuracao (fallback):**
- Se BLE nao funcionar, o ESP32 tambem cria um Access Point WiFi: `TopLav_DDEEFF` (sem senha)
- Acessar `192.168.4.1` no navegador mostra formulario para configurar WiFi
- Formulario simples: SSID, Senha, Laundry ID (com QR code do admin)

### 2. Edge Function `esp32-monitor` - Adicionar auto-registro

Quando receber heartbeat com flag `auto_register: true`:
- Verificar se `esp32_id` ja existe na tabela `esp32_status`
- Se nao existe, criar automaticamente com status `pending_approval`
- Retornar configuracao (heartbeat_interval, etc) na resposta

### 3. Painel Admin - Tela de aprovacao de ESP32s novos

Na pagina `/admin/settings` (onde o usuario esta agora):
- Adicionar secao "ESP32s Pendentes de Aprovacao"
- Lista ESP32s com `auto_register = true` que ainda nao foram associados a maquinas
- Botao para associar ESP32 a uma maquina existente (selecionar maquina no dropdown)
- Botao para rejeitar/remover ESP32 desconhecido

### 4. QR Code no Admin para facilitar configuracao

- No painel admin, gerar QR Code contendo: `{"laundry_id":"uuid","supabase_url":"...","api_key":"..."}`
- O app/totem le o QR Code e envia para o ESP32 via BLE
- Assim o operador nao precisa digitar o UUID manualmente

## Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `public/arduino/ESP32_AutoConfig_v3.ino` | Criar | Novo codigo com BLE + Preferences + auto-registro |
| `supabase/functions/esp32-monitor/index.ts` | Modificar | Adicionar logica de auto-registro no heartbeat |
| `src/pages/admin/Settings.tsx` ou componente equivalente | Modificar | Adicionar secao de ESP32s pendentes |
| `src/components/admin/ESP32PendingApproval.tsx` | Criar | Componente para aprovar/rejeitar ESP32s novos |
| `src/components/admin/ESP32ConfigQRCode.tsx` | Criar | Componente para gerar QR Code de configuracao |
| `public/arduino/CONFIG_RAPIDA.txt` | Atualizar | Novas instrucoes simplificadas |

## Migracao SQL

Adicionar coluna `registration_status` na tabela `esp32_status`:
```text
ALTER TABLE esp32_status ADD COLUMN registration_status TEXT DEFAULT 'approved';
-- Valores: 'pending', 'approved', 'rejected'
```

## Beneficios

- **Mesmo codigo para todos os ESP32s** - nao precisa recompilar para cada maquina
- **Configuracao WiFi sem computador** - faz tudo pelo celular via Bluetooth
- **Seguro** - ESP32 se registra mas precisa de aprovacao do admin
- **Resiliente** - se WiFi mudar, reconfigura via BLE sem recompilar

