

## Análise: O que falta para Cielo LIO funcionar

### Status Atual

O sistema já tem a **infraestrutura de roteamento** pronta (TypeScript → Capacitor → Java), mas o lado Android retorna erro placeholder quando `provider=cielo`. Falta a implementação real.

### O que precisa ser implementado

#### 1. CieloLioManager.java (PRINCIPAL — lado Android)

Criar classe `CieloLioManager.java` que integra com o SDK Cielo LIO (`cielo-lio-order-manager`). Esta classe precisa:

- Inicializar o `OrderManager` do SDK Cielo com as credenciais (Client ID, Access Token)
- Implementar `processPayment(amount, paymentType, description, orderId)` usando `OrderManager.createDraftOrder()` → `OrderManager.placeOrder()` → `OrderManager.checkoutOrder()`
- Suportar crédito, débito e PIX (via QR Code Cielo)
- Implementar callback `PaymentListener` do SDK para capturar `onPayment()`, `onError()`, `onCancel()`
- Usar a mesma interface `PayGoCallback` (renomear para `PaymentCallback`) para manter compatibilidade com o plugin

#### 2. Atualizar PayGOPlugin.java

Substituir o bloco placeholder (linhas 96-103) por instanciação real do `CieloLioManager`:
- Se `provider=cielo` → delegar para `CieloLioManager`
- Se `provider=paygo` → manter fluxo atual com `RealPayGoManager`

#### 3. Dependência do SDK Cielo no build.gradle

Adicionar ao `android/app/build.gradle`:
```
implementation 'com.cielo.lio:order-manager:1.8.4'
```

#### 4. Credenciais Cielo no Admin

Adicionar campos na tabela `system_settings`:
- `cielo_client_id` (text)
- `cielo_access_token` (text)
- `cielo_merchant_code` (text, código EC)
- `cielo_environment` (text: `'sandbox'` ou `'production'`)

Adicionar esses campos no `SettingsForm.tsx` (visíveis apenas quando provedor = cielo).

#### 5. Propagar credenciais Cielo ao Android

No `Totem.tsx` e hooks, passar as credenciais Cielo via Capacitor call para que o `CieloLioManager` receba Client ID e Access Token na inicialização.

#### 6. window.Android.pagar com Cielo

O `MainActivity.java` não tem `@JavascriptInterface` (usa Capacitor). Se o fallback WebView for necessário, adicionar sobrecarga `pagar(valor, descricao, provider)` no `TotemActivity.java`.

### Sugestões de Melhoria

1. **Interface unificada de pagamento** — Extrair uma interface Java `PaymentManager` com métodos `processPayment`, `cancelPayment`, `isProcessing`, `isInitialized` que tanto `RealPayGoManager` quanto `CieloLioManager` implementem. O plugin escolhe qual instância usar sem `if/else` espalhados.

2. **Diagnóstico por provedor no admin** — Na aba de diagnósticos, mostrar status específico do provedor selecionado (Cielo: verificar SDK instalado, credenciais válidas; PayGo: verificar pinpad conectado).

3. **Fallback automático** — Se o provedor principal falhar na inicialização, tentar o secundário (ex: Cielo falhou → tenta PayGo).

4. **Registro de transações com provedor** — Salvar na tabela `transactions` qual provedor processou cada pagamento (`payment_provider` column), útil para conciliação financeira.

5. **Tela de teste rápido** — Botão no admin para executar transação de R$ 1,00 no sandbox e validar que o provedor está operacional.

### Resumo de Arquivos

| Arquivo | Ação |
|---|---|
| `CieloLioManager.java` (novo) | Implementar SDK Cielo LIO |
| `PayGOPlugin.java` | Substituir placeholder por roteamento real |
| `build.gradle` | Adicionar dependência SDK Cielo |
| Migration SQL | Adicionar campos `cielo_*` em `system_settings` |
| `SettingsForm.tsx` | Formulário de credenciais Cielo |
| `useSystemSettings.ts` | Tipar novos campos |
| `supabase/types.ts` | Regenerar types |

