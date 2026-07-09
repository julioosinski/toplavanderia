Plano de ajuste:

1. Alterar o roteamento do operador
   - Hoje o operador é forçado para `/admin/machines`, por isso ele continua vendo a tela antiga de Máquinas.
   - Vou trocar esse redirecionamento para `/admin/dashboard`.
   - Se o operador tentar abrir `/admin/machines`, será enviado para o Dashboard operacional.

2. Ajustar o menu lateral do operador
   - Para operador, deixar apenas o item “Dashboard” acessível.
   - Remover “Máquinas” do menu do operador para evitar voltar para a tela errada.

3. Garantir o conteúdo correto do Dashboard
   - Manter o Dashboard sem faturamento, sem receita e sem cards financeiros.
   - Exibir somente as máquinas da lavanderia do operador, status e botões de liberação manual.

4. Validar no preview
   - Confirmar que um operador ao entrar em `/admin`, `/admin/dashboard` ou `/admin/machines` vê a tela operacional com máquinas e botões, não a tela de cadastro/gestão e não os faturamentos.