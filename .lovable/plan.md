

## Análise: SDK Cielo 2.5.4 e o que falta

### O que o SDK-2.5.4.zip contém

Este é o **Cielo LIO Order Manager SDK v2.5.4**, que inclui o arquivo `.aar` (ou `.jar`) necessário para integrar pagamentos em terminais Cielo LIO. O SDK fornece as classes `OrderManager`, `Credentials`, `Order`, `PaymentListener`, etc.

### Status atual do sistema

| Componente | Status |
|---|---|
| `PaymentManager.java` (interface) | Pronto |
| `PaymentCallback.java` (interface) | Pronto |
| `CieloLioManager.java` (classe) | Existe, mas em **modo placeholder** — todo o código real está comentado |
| `PayGOPlugin.java` (roteamento) | Pronto — roteia para `cieloManager` quando `provider=cielo` |
| Campos Cielo no banco (`system_settings`) | Prontos — `cielo_client_id`, `cielo_access_token`, `cielo_merchant_code`, `cielo_environment` |
| Formulário admin (SettingsForm) | Pronto — campos visíveis quando provedor = cielo |
| Propagação TS → Android | Pronta — credenciais passam via Capacitor `initialize()` |
| SDK no build.gradle | **Falta** — linha comentada |
| Código real no CieloLioManager | **Falta** — precisa descomentar/implementar |
| TotemActivity.java | Usa `RealPayGoManager` diretamente — **não roteia** para `CieloLioManager` |

### O que será feito

#### 1. Adicionar o SDK ao projeto Android

- Copiar o arquivo `.aar` do SDK-2.5.4 para `android/app/libs/`
- Atualizar `build.gradle` para incluir o `.aar` como dependência:
  ```
  implementation(name: 'cielo-lio-order-manager-2.5.4', ext: 'aar')
  ```
- Remover o comentário da dependência Maven (substituir pela versão local `.aar`)

#### 2. Ativar o código real no CieloLioManager.java

Descomentar e completar a implementação:
- `initializeSdk()` — criar `Credentials` + `OrderManager` + chamar `bind()`
- `executeCieloPayment()` — `createDraftOrder()` → `addItem()` → `placeOrder()` → `checkoutOrder()` com `PaymentListener`
- `cancelPayment()` — chamar `orderManager.cancelOrder()`
- Mapear tipos: `credit` → `CREDITO/A_VISTA`, `debit` → `DEBITO/A_VISTA`, `pix` → `QRCODE/QRCODE_CREDIT`

#### 3. Atualizar TotemActivity.java

O `TotemActivity` acessa `RealPayGoManager` diretamente (campo na linha 46). Adicionar suporte ao provedor:
- Ler o provedor das settings (ou de um campo de configuração)
- Se `cielo` → instanciar e usar `CieloLioManager` em vez de `RealPayGoManager`
- Manter `RealPayGoManager` como fallback

#### 4. Atualizar cancelPayment no PayGOPlugin

Atualmente `cancelPayment()` e `cancelTransaction()` chamam apenas `payGoManager`. Atualizar para usar `getManager(provider)`.

### Como testar

#### Pré-requisitos
1. **Hardware**: Terminal Cielo LIO (LIO V2 ou LIO+) — o SDK **não funciona** em tablets/smartphones comuns
2. **Credenciais sandbox**: Obtidas no portal Cielo Developers (https://desenvolvedores.cielo.com.br)
3. **APK compilado**: Após as alterações, recompilar o APK com `./gradlew assembleDebug`

#### Passos de teste

1. **Configurar credenciais no admin**:
   - Acessar Configurações → Provedor de Pagamento → selecionar "Cielo LIO"
   - Preencher Client ID, Access Token, Código EC
   - Selecionar ambiente "sandbox"
   - Salvar

2. **Instalar o APK no terminal Cielo LIO**:
   ```bash
   adb install -r app-debug.apk
   ```

3. **Teste de inicialização**:
   - Abrir o app no terminal LIO
   - Verificar nos logs (`adb logcat | grep CieloLioManager`):
     - `"Configured: merchant=... env=sandbox"`
     - `"SDK initialized successfully"` (se o bind funcionou)

4. **Teste de pagamento crédito** (R$ 1,00):
   - Selecionar uma máquina no totem
   - Escolher pagamento cartão
   - A tela da Cielo LIO deve assumir o controle mostrando "Insira/Aproxime o cartão"
   - Usar cartão de teste Cielo sandbox
   - Verificar log: `"CIELO APPROVED"`

5. **Teste de pagamento PIX**:
   - Selecionar PIX no tipo de pagamento
   - O QR Code deve aparecer na tela do LIO
   - No sandbox, simular leitura

6. **Teste de cancelamento**:
   - Iniciar pagamento e cancelar antes de completar
   - Verificar que o callback `onPaymentError("cancelada")` é chamado

#### Verificação de logs
```bash
adb logcat -d | grep -E "CieloLioManager|PayGOPlugin" > cielo_test_logs.txt
```

### Observação importante

O SDK Cielo LIO **só funciona em terminais Cielo LIO** (é um hardware específico). Se você estiver testando em um tablet Gertec/PPC930, o SDK não vai inicializar — nesses dispositivos, continue usando PayGo. A escolha de provedor no admin permite alternar conforme o hardware disponível em cada lavanderia.

### Arquivos a serem modificados

| Arquivo | Ação |
|---|---|
| `android/app/libs/` | Copiar `.aar` do SDK |
| `android/app/build.gradle` | Adicionar dependência `.aar` |
| `CieloLioManager.java` | Ativar código real (descomentar + completar) |
| `tablet_deploy/.../CieloLioManager.java` | Espelhar alterações |
| `TotemActivity.java` | Adicionar roteamento de provedor |
| `PayGOPlugin.java` | Corrigir `cancelPayment` para usar `getManager()` |

