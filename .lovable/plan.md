# Diagnóstico: valores do dashboard NÃO são reais

Conferi o código (`src/pages/admin/Dashboard.tsx`, função `loadRevenueData`) contra os dados reais da tabela `transactions`. Há um bug claro de cálculo: o dashboard soma **todas** as transações, incluindo `cancelled` e `pending`, inflando a receita.

## Evidência (lavanderia principal, dados atuais)

| status     | nº transações | soma `total_amount` |
|------------|---------------|---------------------|
| completed  | 76            | R$ 164,00           |
| cancelled  | 65            | R$ 121,00           |
| pending    | 7             | R$ 31,00            |

- **Receita real (completed):** R$ 164,00 / 76 transações
- **Valor exibido hoje no dashboard:** ~R$ 316,00 / 148 transações (soma tudo)

A consulta em `loadRevenueData` seleciona `status` mas nunca filtra por ele:
```ts
.select('total_amount, created_at, status')
.gte('created_at', fromISO).lte('created_at', toISO)
// faltam: .eq('status', 'completed')
```
O mesmo problema existe na `monthlyQuery` (sem filtro de status) e em `ConsolidatedReportsTab.tsx` (relatórios consolidados do super admin).

Observação: o gatilho `update_machine_stats` no banco já incrementa `machines.total_revenue` apenas quando `status='completed'`, então os totais por máquina estão corretos — só o dashboard/relatório está errado.

## Correção proposta

1. **`src/pages/admin/Dashboard.tsx` → `loadRevenueData`**
   - Adicionar `.eq('status', 'completed')` em `periodQuery` e `monthlyQuery`.
   - `periodTransactions` passa a contar somente transações concluídas (alinha com a receita exibida).
   - Manter o filtro de período (`created_at`) atual.

2. **`src/components/admin/ConsolidatedReportsTab.tsx` → `loadConsolidatedStats`**
   - Adicionar `.eq('status', 'completed')` na query `transactions` para que "Receita no Período", "Transações" e "Ranking de Eficiência" reflitam a realidade.

3. **(Opcional, recomendado) Tooltip/legenda**
   - Acrescentar dica curta ("Considera apenas transações concluídas") abaixo dos cards "Receita do Período" e "Receita Mensal" para evitar dúvidas futuras.

## Fora de escopo
- Não mudar regra de negócio do gatilho de banco (já está correta).
- Não alterar a lógica de status das máquinas (card "Disponíveis"), que usa estado real do ESP32.

Quer que eu inclua também o item 3 (legenda) ou prefere apenas o fix de cálculo (itens 1 e 2)?
