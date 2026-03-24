

# Auto-Descoberta de ESP32: Plug-and-Play Completo

## Problema Atual

O fluxo atual exige **3 etapas manuais** para cada ESP32:
1. Conectar ao AP do ESP32 (`TopLav_XXXXXX`)
2. Inserir WiFi SSID, senha e Laundry ID manualmente
3. Aprovar no painel admin e associar a uma máquina existente

O usuário quer: **ligar o ESP32 → ele aparece no painel → admin dá nome e aprova**.

## Novo Fluxo

```text
ESP32 ligado (firmware v4 com WiFi+Laundry hardcoded)
         ↓ conecta WiFi automaticamente
Heartbeat enviado com auto_register=true
         ↓
Aparece no painel admin como "Pendente"
         ↓
Admin preenche:
  - Nome amigável (ex: "Lavadora 01")
  - Tipo (Lavadora / Secadora)
  - Pino do relé (padrão: 2)
         ↓
Clica "Aprovar" → máquina criada automaticamente ✅
```

## Mudanças

### 1. Novo firmware v4 — `public/arduino/ESP32_AutoConfig_v4.ino`

Firmware simplificado que **elimina AP/BLE**:
- WiFi SSID, senha e laundry_id vêm hardcoded (gerados pelo painel admin)
- No boot: conecta WiFi direto, sem etapa de configuração
- Envia heartbeat com `auto_register: true` imediatamente
- Se WiFi falhar, tenta reconectar em loop (sem abrir AP)
- Mantém polling de comandos e confirmação igual ao v3
- Gera `esp32_id` pelo MAC normalmente, mas **inicializa WiFi antes** para corrigir o bug `esp32_000000`

### 2. Atualizar `ESP32PendingApproval.tsx` — Aprovação com criação automática de máquina

Substituir o select de "associar a uma máquina existente" por um formulário inline:
- Campo **Nome** (ex: "Lavadora 01") — obrigatório
- Select **Tipo** (Lavadora / Secadora) — obrigatório
- Campo **Pino do Relé** (padrão: 2)
- Campo **Preço por ciclo** (padrão do system_settings)
- Campo **Tempo de ciclo** (padrão do system_settings)
- Campo **Capacidade (kg)** (padrão: 10)

Ao clicar "Aprovar":
1. Cria automaticamente uma nova máquina na tabela `machines` com os dados preenchidos e `esp32_id` do dispositivo
2. Atualiza `esp32_status.registration_status` para `approved`
3. Atualiza `esp32_status.device_name` com o nome dado pelo admin

### 3. Atualizar `ESP32ConfigQRCode.tsx` — Gerar firmware pronto para download

Substituir o QR Code por um **gerador de firmware .ino**:
- Puxa `wifi_ssid` e `wifi_password` do `system_settings`
- Gera o arquivo `.ino` v4 com WiFi + laundry_id já preenchidos
- Botão "Baixar Firmware" que faz download do `.ino` pronto para upload no Arduino IDE
- Se WiFi não estiver configurado nas settings, mostra aviso pedindo para preencher

### 4. Edge function `esp32-monitor` — Nenhuma mudança necessária

O heartbeat com `auto_register: true` já funciona corretamente: insere na `esp32_status` com `registration_status: 'pending'` e o polling só retorna comandos para ESP32s existentes.

## Arquivos Modificados/Criados

| Arquivo | Ação |
|---|---|
| `public/arduino/ESP32_AutoConfig_v4.ino` | Novo — firmware simplificado sem AP/BLE |
| `src/components/admin/ESP32PendingApproval.tsx` | Reescrever — formulário de criação de máquina inline na aprovação |
| `src/components/admin/ESP32ConfigQRCode.tsx` | Reescrever — gerador de firmware .ino para download |

