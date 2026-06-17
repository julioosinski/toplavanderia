## Objetivo

No `/admin/dashboard`, os 4 cards de KPI (Receita Total, Receita Mensal, Transações Hoje, Disponíveis) hoje truncam o valor (`truncate` + fonte grande em telas estreitas) e não permitem mudar o período. Vamos:

1. Garantir que os valores apareçam **sem corte**, em qualquer largura.
2. Tornar cada card **clicável** para abrir um seletor de período que controla o que é mostrado.

## Mudanças (somente UI no `src/pages/admin/Dashboard.tsx`)

### 1. Cards sem corte
- Remover `truncate` dos `<p>` de valor.
- Trocar tamanho fixo `text-lg sm:text-2xl` por classe responsiva fluida (`text-base sm:text-xl lg:text-2xl`) com `whitespace-nowrap` + `tabular-nums` e `leading-tight`.
- Permitir o card quebrar em 2 linhas (ícone em cima do texto em telas estreitas) trocando `flex items-center` por layout que prioriza o número.
- Formatar moeda com `Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' })` para ficar consistente.

### 2. Período configurável
- Adicionar estado `dateRange: { from: Date; to: Date }` com padrão **mês atual** (1º dia → hoje).
- Adicionar `preset: 'today' | '7d' | '30d' | 'month' | 'custom'`.
- Recalcular `loadRevenueData` em função de `dateRange`:
  - `Receita do Período` (substitui "Receita Total" — agregada de `transactions.total_amount` no intervalo)
  - `Receita Mensal` continua mês corrente (independe do filtro), OU passa a refletir o intervalo — **a decidir** (ver pergunta).
  - `Transações no Período` (substitui "Transações Hoje")
  - `Disponíveis` continua tempo-real (não depende de data).
- Mostrar um chip acima dos cards: `Período: 01/06/2026 – 17/06/2026` com botão "Alterar".

### 3. Cards como botões
- Envolver cada `<Card>` num `<button>` (ou `role="button"` + `tabIndex`) com hover/focus.
- Ao clicar em qualquer card de valor financeiro/transações → abre `Dialog` (shadcn) com:
  - Presets: Hoje, 7 dias, 30 dias, Mês atual, Personalizado.
  - Se "Personalizado": dois `Calendar` (shadcn datepicker, `pointer-events-auto`) para `from`/`to`.
  - Botões: Cancelar / Aplicar.
- Clicar no card "Disponíveis" navega para `/admin/machines` (atalho útil, mantém padrão de botão).

### 4. Persistência leve
- Salvar o preset escolhido em `localStorage` (`dashboard:dateRange`) para manter na próxima visita.

## Arquivos
- `src/pages/admin/Dashboard.tsx` (edição)
- Nenhum novo arquivo; reutiliza `Dialog`, `Calendar`, `Button`, `Popover` já existentes em `@/components/ui`.

## Pergunta antes de implementar

Quer que **todos** os 3 cards financeiros (Receita Total, Receita Mensal, Transações) passem a respeitar o período escolhido — virando "Receita do Período / Ticket Médio / Transações do Período" — ou prefere manter "Receita Mensal" fixa no mês corrente e só os outros dois passam a usar o filtro?
