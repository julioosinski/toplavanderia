

# ESP32 com Portal de Configuração WiFi (Captive Portal)

## Objetivo

Alterar o firmware para que o ESP32 crie um Access Point (AP) chamado `TopLav_Config_XXXXXX` quando não conseguir conectar ao WiFi. O usuário conecta nessa rede e acessa `192.168.4.1` para configurar SSID e senha. Após salvar, o ESP32 reinicia, conecta ao WiFi configurado e faz auto-registro normalmente.

## Fluxo

```text
ESP32 ligado
  ↓
Tenta conectar WiFi pré-configurado (10s)
  ↓ falhou?
Abre AP: "TopLav_Config_XXXXXX" (sem senha)
  ↓
Usuário conecta ao AP pelo celular
  ↓
Acessa http://192.168.4.1 → formulário HTML
  ↓
Preenche SSID + Senha → Salva no SPIFFS
  ↓
ESP32 reinicia → conecta WiFi → auto-registro normal
```

## Mudanças

### 1. Firmware `public/arduino/ESP32_AutoConfig_v4.ino`

Reescrever com:
- **SPIFFS** para salvar/carregar WiFi credentials persistentemente
- **WebServer** na porta 80 do AP para servir formulário HTML de configuração
- No `setup()`: tenta conectar com credenciais salvas no SPIFFS (ou hardcoded se for a primeira vez). Se falhar em 10s, entra em **modo AP** com portal captive
- Página HTML simples em `192.168.4.1` com campos SSID e Senha + botão Salvar
- Ao salvar: grava no SPIFFS e reinicia (`ESP.restart()`)
- Laundry ID, Supabase URL e Key continuam hardcoded (vêm do painel)
- Adicionar `#include <SPIFFS.h>` e `#include <WebServer.h>`

### 2. Template no `ESP32ConfigQRCode.tsx`

Atualizar o `FIRMWARE_TEMPLATE` com o novo código que inclui modo AP + SPIFFS. O WiFi SSID/senha do painel serão usados como **valores padrão iniciais**, mas o ESP32 poderá ser reconfigurado via AP a qualquer momento.

### 3. Instruções na UI

Atualizar o texto de "Como usar" para mencionar que, se o WiFi falhar, o ESP32 criará uma rede `TopLav_Config_*` para reconfiguração.

## Arquivos Modificados

| Arquivo | Mudança |
|---|---|
| `public/arduino/ESP32_AutoConfig_v4.ino` | Adicionar modo AP + SPIFFS + WebServer portal |
| `src/components/admin/ESP32ConfigQRCode.tsx` | Atualizar FIRMWARE_TEMPLATE e instruções |

