

## Plano: Suporte a Múltiplos Provedores de Pagamento (PayGo + Cielo LIO)

### Resumo

Adicionar suporte ao provedor Cielo LIO sem alterar nenhum fluxo existente. O campo `paygo_provedor` já existe no banco de dados — basta conectá-lo ao fluxo de pagamento para que o Android decida qual SDK usar.

### O que já existe

- Campo `paygo_provedor` na tabela `system_settings` (já no banco e nos types)
- Hook `useSystemSettings` já lê `paygo_provedor`
- PayGOPlugin.java recebe `processPayment` via Capacitor mas **não passa** o provider ao RealPayGoManager

### Alterações

#### 1. Propagar `provider` no fluxo TypeScript

**`src/hooks/useUniversalPayment.ts`**
- Adicionar campo `provider` ao `UniversalPaymentConfig` (default: `'paygo'`)
- No `processPayment`, passar `provider` como parâmetro ao chamar `processPaygoPayment`

**`src/hooks/useRealPayGOIntegration.ts`**
- Adicionar `provider` ao `RealPayGOConfig`
- Na chamada `PayGO.processPayment(...)`, incluir o campo `provider`

**`src/plugins/paygo.ts`**
- Adicionar `provider?: string` ao `PaymentOptions`

#### 2. Configurar `provider` a partir das settings

**`src/pages/Totem.tsx`**
- Ler `systemSettings.paygo_provedor` e passá-lo no `paygoConfig` / `universalConfig`
- Default: `'paygo'` quando vazio

#### 3. Seletor de provedor no painel admin

**`src/components/admin/settings/SettingsForm.tsx`**
- Adicionar dropdown no bloco PayGO para escolher provedor: "PayGo (padrão)" ou "Cielo LIO"
- Salvar no campo `paygo_provedor` existente

#### 4. Android: receber e logar o provider

**`android/app/src/main/java/app/lovable/toplavanderia/PayGOPlugin.java`**
- Ler `call.getString("provider", "paygo")` em `processPayment`
- Logar o provider para futura implementação do SDK Cielo
- Passar ao `RealPayGoManager` (campo novo)
- Estrutura `if/else` preparada: `paygo` → fluxo atual; `cielo` → placeholder que loga e retorna erro "Cielo LIO ainda não implementado no nativo"

**`android/app/src/main/java/app/lovable/toplavanderia/RealPayGoManager.java`**
- Adicionar parâmetro `provider` ao método `processPayment`
- Se `provider.equals("cielo")` → callback com erro informativo (SDK Cielo será integrado futuramente)
- Se `provider.equals("paygo")` ou qualquer outro → fluxo atual intacto

#### 5. Funções globais `window.Android.pagar` (compatibilidade)

**`android/app/src/main/java/app/lovable/toplavanderia/MainActivity.java`** (ou TotemActivity)
- Adicionar sobrecarga: `pagar(valor, descricao, provider)`
- Se `provider` não informado → `"paygo"` (compatibilidade retroativa)

### O que NÃO será alterado

- Lógica de acionamento ESP32
- Backend/Edge Functions
- Fluxo de PIX (continua via PayGO nativo)
- Nenhuma remoção de funcionalidade existente

### Detalhes técnicos

```text
Fluxo atualizado:

  Totem (React)
    │
    ├─ systemSettings.paygo_provedor → "paygo" | "cielo"
    │
    ├─ UniversalPaymentWidget
    │   └─ useUniversalPayment.processPayment(tx)
    │       └─ useRealPayGOIntegration.processPayment({...tx, provider})
    │           └─ PayGO.processPayment({...opts, provider})  ← Capacitor
    │               └─ PayGOPlugin.java
    │                   ├─ if "paygo" → RealPayGoManager (InterfaceAutomacao) ✅
    │                   └─ if "cielo" → placeholder / futuro Cielo SDK
    │
    └─ window.Android.pagar(valor, desc, provider)  ← WebView fallback
```

