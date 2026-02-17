

# Analise da Estrutura de Pagamento - 4 Cenarios

## Resumo dos Cenarios

| Cenario | Status | Funciona? | Problemas |
|---------|--------|-----------|-----------|
| PWA (Lovable web) | Parcial | Limitado | PIX via HTTP local nao funciona; TEF/PayGO inacessiveis |
| Android Wrapper (Capacitor) | Funcional | Sim | E o cenario principal, bem coberto |
| TEF PayGo | Funcional | Sim | Depende do plugin nativo Android |
| ESP32 Wi-Fi | Funcional | Sim | Arquitetura pull ja corrigida |

---

## 1. PWA (Lovable Web no navegador)

**Status: PROBLEMATICO**

O sistema foi desenhado para rodar em Android nativo. No navegador (PWA):

- **PayGO**: `useRealPayGOIntegration` chama `PayGO.initialize()` do plugin Capacitor. No browser, nao existe plugin nativo registrado - vai lancar erro silencioso ou nao fazer nada
- **TEF**: `useTEFIntegration` faz `fetch()` para `http://192.168.1.100:8080` - isso so funciona se o dispositivo TEF estiver na mesma rede local E aceitar CORS (improvavel)
- **PIX**: `usePixPayment` faz `fetch()` para `http://localhost:8080/pix/generate` - nao existe servidor local no browser
- **`usePayGOIntegration`**: Tem fallback web via HTTP (`Capacitor.isNativePlatform()` check), mas o servidor HTTP PayGO estaria na rede local, inacessivel de um PWA hospedado na cloud

**Problema central**: Nenhum metodo de pagamento funciona em PWA puro. O `UniversalPaymentWidget` testa conexoes e mostra tudo como "Indisponivel", mas nao oferece alternativa real.

**Correcao necessaria**: 
- Para PWA funcionar com pagamentos, seria necessario um gateway de pagamento online (Stripe, Mercado Pago, PagSeguro) que processa tudo na nuvem
- Ou aceitar que PWA e apenas para visualizacao/admin, sem processar pagamentos

---

## 2. Android Wrapper (Capacitor APK)

**Status: BEM COBERTO**

Este e o cenario principal e esta bem implementado:

- **Plugin PayGO** (`src/plugins/paygo.ts`): Registrado via `registerPlugin('PayGO')`, se comunica com a biblioteca nativa `InterfaceAutomacao-v2.1.0.6.aar`
- **Plugin TEF** (`src/plugins/tef.ts`): Registrado via `registerPlugin('TEF')`, com fallback web (`tef.web.ts`)
- **Deteccao de plataforma**: `usePayGOIntegration` usa `Capacitor.isNativePlatform()` para escolher entre plugin nativo ou HTTP fallback
- **Kiosk mode**: `useKioskSecurity` e `useCapacitorIntegration` gerenciam modo quiosque no Android

**Sem problemas criticos** neste cenario. O fluxo completo funciona:
1. Totem mostra maquinas
2. Usuario seleciona e paga via PayGO/TEF/PIX
3. Sistema envia comando para `pending_commands`
4. ESP32 busca e executa

---

## 3. TEF PayGo (Pinpad PPC930)

**Status: FUNCIONAL COM RESSALVAS**

Dois caminhos paralelos existem, o que gera confusao:

- **Caminho 1 - Plugin Nativo** (`useRealPayGOIntegration` + `usePayGO`): Usa `PayGO.processPayment()` do plugin Capacitor. Requer o AAR nativo. So funciona em Android.
- **Caminho 2 - HTTP** (`usePayGOIntegration`): Faz fetch para `http://host:port/transaction`. Funciona se houver um servidor PayGO acessivel via rede.
- **Caminho 3 - TEF via HTTP** (`useTEFIntegration`): Faz fetch para o endpoint TEF Positivo L4.

**Problemas encontrados**:
1. **Hooks duplicados**: Existem 4 hooks de pagamento PayGO (`usePayGO`, `usePayGOIntegration`, `useRealPayGOIntegration`, `useUniversalPayment`) que fazem coisas similares mas com interfaces diferentes
2. **PayGO hardcoded como credito**: No `handlePayGOPayment()` do Totem (linha 290), o `paymentType` e sempre `'credit'` - o usuario nao escolhe debito/credito/pix
3. **Falta selecao de tipo no Totem**: O Totem tem botoes TEF/PayGO/PIX mas nao permite escolher credito vs debito dentro do PayGO

---

## 4. ESP32 Wi-Fi (Ativacao de Maquinas)

**Status: CORRIGIDO**

A arquitetura pull ja foi implementada:
- `esp32-control` insere em `pending_commands`
- ESP32 faz polling a cada 5s via `esp32-monitor?action=poll_commands`
- ESP32 confirma execucao via `confirm_command`

**Sem problemas** neste fluxo apos as correcoes anteriores.

---

## Problemas Estruturais Identificados

### A. Excesso de hooks de pagamento (4 hooks fazendo a mesma coisa)

```text
usePayGO.ts              -> Plugin nativo direto
usePayGOIntegration.ts   -> Plugin nativo + HTTP fallback
useRealPayGOIntegration.ts -> Plugin nativo com validacao
useUniversalPayment.ts   -> Orquestra PayGO + TEF + manual
```

O Totem usa `useRealPayGOIntegration` + `useTEFIntegration` + `usePixPayment` diretamente, mas tambem importa `UniversalPaymentWidget` que usa `useUniversalPayment` (que por sua vez usa `usePayGOIntegration` - diferente do `useRealPayGOIntegration`!).

Resultado: configuracoes diferentes, estados duplicados, comportamentos inconsistentes.

### B. PIX depende de servidor HTTP local

`usePixPayment` faz fetch para `http://localhost:8080/pix/generate` - isso so funciona se PayGO Integrado estiver rodando localmente. Em PWA, nunca funciona. Em Android, depende de ter o app PayGO com endpoint PIX ativo.

### C. Falta de gateway de pagamento online

Para PWA funcionar, precisaria de integracao com gateway online (Mercado Pago, Stripe, PagSeguro). Atualmente, todos os metodos dependem de hardware local.

---

## Plano de Correcao Recomendado

### Fase 1 - Consolidar hooks de pagamento
1. Manter apenas `useUniversalPayment` como hook principal
2. Dentro dele, usar `useRealPayGOIntegration` (nativo) e `useTEFIntegration` (TEF)
3. Remover `usePayGO` e `usePayGOIntegration` (duplicados)
4. Atualizar Totem para usar apenas `useUniversalPayment`

### Fase 2 - Adicionar selecao credito/debito no PayGO
5. No Totem, apos selecionar PayGO, perguntar: Credito, Debito ou PIX
6. Passar o tipo correto para `processPayment`

### Fase 3 - Definir estrategia PWA
7. Opcao A: PWA e somente admin/visualizacao (sem pagamentos)
8. Opcao B: Integrar gateway online (Mercado Pago/Stripe) para pagamentos via PWA

### Secao Tecnica - Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| `src/hooks/useUniversalPayment.ts` | Refatorar para usar `useRealPayGOIntegration` internamente |
| `src/hooks/usePayGO.ts` | Marcar como deprecated ou remover |
| `src/hooks/usePayGOIntegration.ts` | Marcar como deprecated ou remover |
| `src/pages/Totem.tsx` | Simplificar para usar apenas `useUniversalPayment`, adicionar selecao credito/debito |
| `src/components/payment/UniversalPaymentWidget.tsx` | Atualizar para refletir mudancas no hook |

