

## Plano: Corrigir PIX no PPC930 (Smart POS)

### Problema

Quando o usuário toca "PIX" no Totem, o widget força `preferredMethod = 'pix'` (linha 49 do `UniversalPaymentWidget.tsx`). No hook `useUniversalPayment.ts`, isso cai no `case 'pix'` (linha 261) que chama `generatePixQR()` via HTTP — um endpoint que **não existe** no PPC930.

O código Java (`RealPayGoManager.java`) já suporta PIX nativamente via `PAGAMENTO_CARTEIRA_VIRTUAL`. O PayGo Integrado exibe o QR na própria tela do pinpad. Basta rotear para o `case 'paygo'` em vez do `case 'pix'`.

### Correção

**2 mudanças simples, sem alterar nada que já funciona:**

#### 1. `src/hooks/useUniversalPayment.ts` — rotear PIX via PayGO nativo em smartPosMode

No `processPayment`, antes do `switch`, interceptar: se `config.smartPosMode` e o tipo for `pix`, forçar `methodToUse = 'paygo'`. O `case 'paygo'` já passa `transaction.type` (`'pix'`) para o plugin nativo, que chama `PAGAMENTO_CARTEIRA_VIRTUAL`.

```typescript
// Após determinar methodToUse (linha ~215), adicionar:
if (config.smartPosMode && transaction.type === 'pix') {
  methodToUse = 'paygo';  // PIX handled natively by PayGo Integrado
}
```

#### 2. `src/components/payment/UniversalPaymentWidget.tsx` — não forçar method 'pix'

Linha 49: remover o override que força `preferredMethod = 'pix'`. O hook agora roteia corretamente baseado no `transaction.type`.

```typescript
// De:
const method: PaymentMethod | undefined = type === 'pix' ? 'pix' : undefined;
// Para:
const method: PaymentMethod | undefined = undefined;
```

### Fluxo corrigido

```text
Usuário toca "PIX"
  → Widget: processPayment({ type: 'pix' }, undefined)
  → Hook: smartPosMode + type=pix → methodToUse = 'paygo'
  → case 'paygo': processPaygoPayment({ paymentType: 'pix', ... })
  → Plugin nativo: PayGOPlugin.java → RealPayGoManager
  → Java: PAGAMENTO_CARTEIRA_VIRTUAL
  → PayGo Integrado exibe QR no PPC930
  → Cliente paga → resultado volta ao React
```

### Arquivos editados

| Arquivo | Mudança |
|---|---|
| `src/hooks/useUniversalPayment.ts` | Adicionar interceptação smartPosMode+pix → paygo |
| `src/components/payment/UniversalPaymentWidget.tsx` | Remover override de method para 'pix' |

### Impacto

- Crédito e Débito continuam funcionando exatamente como antes
- PIX agora passa pelo mesmo caminho nativo (PayGo Integrado → PPC930)
- Nenhuma mudança no Java — o `RealPayGoManager` já trata PIX corretamente

