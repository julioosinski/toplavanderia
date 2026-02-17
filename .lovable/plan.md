

# O Que Falta Para Funcionar 100% REAL no Tablet com PPC930

## Diagnostico: Dois Sistemas Desconectados

Atualmente existem **dois sistemas completamente separados** que nao se comunicam:

### Sistema 1: Activities Java Nativas (funciona parcialmente)
- `TotemActivity.java` - UI nativa em Java (nao e Capacitor/React)
- `RealPayGoManager.java` - Usa a biblioteca `InterfaceAutomacao-v2.1.0.6.aar` REAL
- Comunica diretamente com o PPC930 via API do PayGo
- **Problema**: A UI e toda construida em Java puro (botoes, layouts), nao usa a interface React bonita

### Sistema 2: Capacitor/React (interface bonita, pagamento NAO funciona)
- `PayGOPlugin.java` - Faz chamadas HTTP para `localhost:8080` (um "PayGO Web SDK" que **nao existe**)
- `src/plugins/paygo.ts` + `useRealPayGOIntegration.ts` - Hooks React que chamam o plugin
- `src/pages/Totem.tsx` - Interface React bonita com grid de maquinas
- **Problema**: O plugin nunca chama o `RealPayGoManager` - ele tenta HTTP para um servidor que nao esta rodando

### Resultado: Nada funciona ponta a ponta
- A `TotemActivity` (launcher no AndroidManifest) abre uma UI nativa Java, nao o WebView Capacitor
- O plugin Capacitor `PayGOPlugin.java` nao usa a biblioteca InterfaceAutomacao
- A interface React nunca e exibida no tablet

---

## O Que Precisa Ser Feito (7 itens)

### 1. Substituir TotemActivity por Capacitor BridgeActivity
**Criticidade: ALTA** - Sem isso, o React nunca roda no tablet.

A `TotemActivity` e uma Activity Java pura. Precisa ser convertida para uma `BridgeActivity` do Capacitor que carrega o WebView com a aplicacao React.

Mudancas:
- Criar `MainActivity.java` que estende `BridgeActivity` do Capacitor
- Registrar os plugins `PayGOPlugin`, `USBPlugin`, `TEFPlugin` nessa Activity
- Atualizar `AndroidManifest.xml` para usar `MainActivity` como launcher
- Manter a deteccao USB e modo kiosk na nova Activity

### 2. Reescrever PayGOPlugin.java para usar RealPayGoManager
**Criticidade: ALTA** - Sem isso, pagamentos nao funcionam.

O plugin atual faz HTTP para `localhost:8080`. Precisa chamar diretamente o `RealPayGoManager` que ja tem a integracao real com `InterfaceAutomacao`.

Mudancas no `PayGOPlugin.java`:
- Remover todas as chamadas HTTP (`makeHttpRequest`)
- Instanciar `RealPayGoManager` no `load()` do plugin
- Metodo `initialize()`: chamar `RealPayGoManager` em vez de HTTP
- Metodo `processPayment()`: delegar para `RealPayGoManager.processPayment()`
- Metodo `checkStatus()`: verificar `RealPayGoManager.isInitialized()`
- Metodo `detectPinpad()`: detectar USB diretamente via Android UsbManager
- Usar callbacks do `RealPayGoManager` para notificar o JS via `notifyListeners()`

### 3. Adicionar suporte a tipo de pagamento (Credito/Debito/PIX)
**Criticidade: MEDIA** - O `RealPayGoManager` atual sempre usa `PAGAMENTO_CARTAO`.

Mudancas no `RealPayGoManager.java`:
- Receber parametro `paymentType` ("credit", "debit", "pix")
- Mapear para as constantes corretas:
  - `credit` -> `ModalidadesPagamento.PAGAMENTO_CARTAO` (o PayGo escolhe credito no pinpad)
  - `debit` -> `ModalidadesPagamento.PAGAMENTO_CARTAO` (idem, o pinpad pergunta)
  - `pix` -> `Operacoes.PIX` ou modalidade equivalente
- Extrair dados REAIS do `SaidaTransacao` (NSU, codigo autorizacao, bandeira) em vez de gerar timestamps

### 4. Registrar Transacao no Supabase apos pagamento
**Criticidade: ALTA** - Sem isso, nao ha registro do pagamento.

O fluxo completo deve ser:
1. Usuario seleciona maquina no React (Totem.tsx)
2. Escolhe tipo de pagamento (credito/debito/PIX)
3. PayGOPlugin chama RealPayGoManager
4. PPC930 processa o cartao
5. Se aprovado: salvar transacao no Supabase + ativar ESP32
6. Se negado: mostrar erro na tela

Verificar que o hook `useUniversalPayment` ja faz os passos 5 e 6 corretamente apos receber o resultado do plugin.

### 5. Instalar o PayGo Integrado APK no tablet
**Criticidade: ALTA** - Pre-requisito de hardware.

A biblioteca `InterfaceAutomacao` exige que o app "PayGo Integrado" esteja instalado no tablet Android. Sem ele, a excecao `AplicacaoNaoInstaladaExcecao` sera lancada.

Passos:
- Instalar o APK `PGIntegrado-v4.1.50.5_CERT_geral_250605.apk` (ambiente de teste)
- Abrir o PayGo Integrado e parear via Bluetooth com o PPC930
- Instalar o "Ponto de Captura" com CNPJ e dados do estabelecimento
- Testar comunicacao basica antes de usar o app

### 6. Configurar CNPJ e Dados do Estabelecimento
**Criticidade: MEDIA** - Necessario para transacoes reais.

O `DadosAutomacao` no `RealPayGoManager` usa dados fixos. Para producao:
- Configurar CNPJ real no PayGo Integrado
- Atualizar nome do estabelecimento no `DadosAutomacao`
- Obter e configurar a chave de automacao (automationKey)
- Estas configuracoes devem vir das `system_settings` do Supabase

### 7. Tratar Recibos/Comprovantes
**Criticidade: BAIXA** - O PPC930 pode imprimir comprovantes.

O `SaidaTransacao` retorna vias para impressao. Implementar:
- Exibir comprovante na tela do tablet (via digital)
- Ou enviar para impressora termica se disponivel
- Guardar comprovante digital no Supabase

---

## Resumo de Prioridades

| # | Item | Criticidade | Tipo |
|---|------|-------------|------|
| 1 | Criar MainActivity (BridgeActivity Capacitor) | ALTA | Codigo |
| 2 | Reescrever PayGOPlugin para usar RealPayGoManager | ALTA | Codigo |
| 3 | Suporte a credito/debito/PIX no RealPayGoManager | MEDIA | Codigo |
| 4 | Registrar transacao no Supabase | ALTA | Codigo |
| 5 | Instalar PayGo Integrado APK no tablet | ALTA | Hardware/Config |
| 6 | Configurar CNPJ e dados do estabelecimento | MEDIA | Config |
| 7 | Tratar recibos/comprovantes | BAIXA | Codigo |

Os itens 1, 2, 3 e 4 sao mudancas de codigo que podem ser implementadas aqui no Lovable. Os itens 5 e 6 sao configuracoes que voce precisa fazer diretamente no tablet/PPC930. O item 7 e uma melhoria futura.

---

## Secao Tecnica - Arquivos a Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `android/app/src/main/java/.../MainActivity.java` | Criar | BridgeActivity Capacitor com plugins registrados |
| `android/app/src/main/AndroidManifest.xml` | Modificar | Apontar launcher para MainActivity |
| `android/app/src/main/java/.../PayGOPlugin.java` | Reescrever | Usar RealPayGoManager em vez de HTTP |
| `android/app/src/main/java/.../RealPayGoManager.java` | Modificar | Adicionar suporte a tipo de pagamento |
| `src/hooks/useUniversalPayment.ts` | Verificar | Confirmar que salva transacao apos aprovacao |

### Fluxo Final Esperado

```text
[React Totem.tsx] --> Seleciona maquina
       |
       v
[UniversalPaymentWidget] --> Escolhe Credito/Debito/PIX
       |
       v
[useUniversalPayment] --> Valida maquina + ESP32 online
       |
       v
[PayGO.processPayment()] --> Plugin Capacitor (JS -> Java)
       |
       v
[PayGOPlugin.java] --> RealPayGoManager.processPayment()
       |
       v
[InterfaceAutomacao] --> transacao.realizaTransacao(entrada)
       |
       v
[PayGo Integrado APK] --> Comunica via Bluetooth com PPC930
       |
       v
[PPC930 Pinpad] --> Cliente insere cartao / aproxima / escaneia QR PIX
       |
       v
[Resultado] --> Aprovado/Negado retorna por callback ate o React
       |
       v
[Se aprovado] --> Salva no Supabase + Ativa ESP32 (liga maquina)
```

