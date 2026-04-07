

## Diagnóstico: Transações do Totem não são registradas como pagamento

### Causa raiz

A tabela `transactions` possui um **CHECK constraint** que restringe `payment_method` a: `'credit'`, `'pix'`, `'card'`, `'cash'`, `'manual_release'`, `'totem'`.

O Totem está passando valores **fora dessa lista**, causando falha silenciosa no INSERT:

| Fluxo | Valor enviado | Resultado |
|---|---|---|
| Pagamento universal (crédito/débito) | `"Universal - PAYGO"` | **FALHA** — violação do constraint |
| Pagamento universal (PIX via PayGO) | `"Universal - PIX"` | **FALHA** |
| Pagamento PIX direto | `"PIX"` (maiúsculo) | **FALHA** — constraint exige `'pix'` minúsculo |

Por isso, só aparecem transações `manual_release` — estas são inseridas pelo painel admin com o valor correto.

### Correções necessárias

#### 1. Normalizar `payment_method` no `activateMachine` (Totem.tsx)

Mapear os valores recebidos para valores válidos do constraint:

```
"Universal - PAYGO" → "card"
"Universal - PIX"   → "pix"  
"Universal - TEF"   → "card"
"PIX"               → "pix"
"TEF"               → "card"
fallback            → "totem"
```

Lógica: criar uma função `normalizePaymentMethod(raw)` que converte para valores aceitos pelo banco.

#### 2. Tratar erro do INSERT (Totem.tsx)

Atualmente o `.insert().select().single()` não verifica erro — o resultado é ignorado. Adicionar verificação de erro para diagnosticar falhas futuras.

#### 3. Atualizar o CHECK constraint (migration SQL)

Adicionar `'cielo'` como valor permitido para transações futuras da Cielo LIO:

```sql
ALTER TABLE transactions DROP CONSTRAINT transactions_payment_method_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_payment_method_check 
  CHECK (payment_method IS NULL OR payment_method IN ('credit','pix','card','cash','manual_release','totem','cielo'));
```

#### 4. Dashboard e Relatórios

O Dashboard (`Dashboard.tsx`) e Reports (`ReportsTab.tsx`, `ConsolidatedReportsTab.tsx`) já consultam todas as transações sem filtro de `payment_method` — portanto, uma vez que as transações sejam inseridas corretamente, aparecerão automaticamente nos relatórios.

A página Transactions (`Transactions.tsx`) também não filtra por método — mostrará tudo corretamente.

### Arquivos a modificar

| Arquivo | Ação |
|---|---|
| `src/pages/Totem.tsx` | Normalizar `payment_method` + tratar erro do INSERT |
| Migration SQL | Adicionar `'cielo'` ao CHECK constraint |

### Impacto

Após esta correção, toda transação feita pelo Totem (crédito, débito, PIX, Cielo) será registrada corretamente e aparecerá no Dashboard, Transações e Relatórios.

