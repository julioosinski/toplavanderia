## Diagnóstico

O motivo real do bloqueio hoje é matemático, não um bug:

- Permissão salva no banco para o operador: **limite diário R$ 6,00** e **mensal R$ 10,00**.
- Uso hoje: **R$ 6,00** já liberados (6 máquinas de R$ 1,00).
- A RPC `admin_remote_release` bloqueia quando `usado + próximo > limite` → `6,00 + 1,00 > 6,00` → dispara "Limite diário atingido".

Ou seja, o "aumentei o limite" salvou 6,00 (provavelmente o valor digitado foi entendido como reais e o operador queria centavos, ou não foi salvo o novo valor). O sistema está funcionando — só que a mensagem chega genérica ("Erro ao iniciar ciclo") e o operador não vê quanto já usou nem qual é o teto.

## O que corrigir

Duas frentes, ambas front-end, sem mexer no backend.

### 1. Deixar a mensagem de erro clara na tela do operador

Arquivo: `src/components/admin/MachineDetailsDialog.tsx` (`handleStartManualCycle`).

- Se a RPC retornar erro cuja mensagem contenha "Limite diário", "Limite mensal", "sem autorização" ou "Sem permissão", exibir o toast com **título específico** ("Limite diário atingido", "Sem autorização", etc.) e a mensagem completa da RPC no `description`, que já inclui os valores usados/permitidos.
- Nos demais casos, exibir o texto real do erro (sem cair no "Tente novamente" genérico).
- Aplicar o mesmo tratamento em `handleReleaseCoffeeCredits` (mesmo arquivo).

### 2. Mostrar o status de autorização/consumo antes do operador clicar

Ainda em `MachineDetailsDialog.tsx`, quando `useOperatorReleasePermission().isOperator === true`:

- Adicionar um bloco compacto acima do botão "Iniciar Ciclo Manual" com:
  - Se `!canRelease` → aviso vermelho "Você não tem autorização para liberar máquinas. Peça ao gerente." e desabilitar o botão.
  - Se `dayLimitCents` definido → "Uso hoje: R$ X,YY de R$ A,BB" (barra ou texto colorido: verde se sobra, âmbar se >80%, vermelho se ao atingir).
  - Se `monthLimitCents` definido → mesma linha para o mês.
  - Quando o próximo release já ultrapassaria o teto (`day_cents + machine.price*100 > day_limit_cents`, idem mensal), desabilitar o botão e mostrar exatamente qual limite bloqueia.
- Depois de qualquer liberação bem-sucedida, chamar `refetch()` para atualizar os números na hora.

### 3. Ajuste pequeno no diálogo de autorização (para o gestor)

Arquivo: `src/components/admin/OperatorAuthorizationDialog.tsx`.

- Adicionar sob cada campo (diário/mensal) uma linha de preview em tempo real: "Equivale a R$ X,YY" com o resultado de `reaisToCentavos(...)`/100. Assim o gestor vê imediatamente se digitou "60" (=R$ 60,00) ou "6,00" (=R$ 6,00) antes de salvar.
- Placeholder atual "Sem limite" mantido; deixar claro no helper text que o valor é em reais (ex.: "Digite em reais — ex.: 60,00 para R$ 60,00").

## Fora do escopo

- Não altero `admin_remote_release`, `get_operator_release_usage` nem `esp32-credit-release`. As regras continuam iguais; só o operador passa a entender o motivo do bloqueio.
- Não mexo em Dashboard/Máquinas/CoffeeMenu — o botão que o operador usa está no `MachineDetailsDialog`.

## Detalhes técnicos

- O `useOperatorReleasePermission` já expõe `dayCents`, `monthCents`, `dayLimitCents`, `monthLimitCents`, `canRelease`, `isOperator`, `refetch()`. Basta consumir no dialog.
- Toast: usar `useToast` já importado; variant `destructive` para bloqueios de limite/autorização.
- Formatação: reaproveitar `centavosToReais` de `src/lib/money.ts` e `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
