

# Mostrar ESP32 Pendentes no Painel de Maquinas

## Problema
O componente `ESP32PendingApproval` (que mostra ESP32s pendentes para aprovacao e criacao de maquinas) so aparece na aba **Configuracoes** (`SettingsTab.tsx`). O usuario espera ver dispositivos pendentes diretamente na pagina **Maquinas** (`Machines.tsx`), onde gerencia todas as maquinas.

## Solucao

Adicionar o componente `ESP32PendingApproval` na pagina `src/pages/admin/Machines.tsx`, acima da tabela de maquinas existentes. Assim, quando um novo ESP32 envia heartbeat e aparece como "pending", o admin pode aprova-lo e criar a maquina diretamente no painel de maquinas.

## Alteracoes

### 1. `src/pages/admin/Machines.tsx`
- Importar `ESP32PendingApproval`
- Renderizar o componente entre o header e o card da tabela de maquinas
- Adicionar subscription realtime para a tabela `esp32_status` para que a lista de maquinas atualize automaticamente quando um ESP32 pendente for aprovado

### 2. Nenhuma outra alteracao necessaria
O componente `ESP32PendingApproval` ja e auto-contido — busca dados, exibe formulario, aprova/rejeita e cria a maquina. Basta inclui-lo na pagina.

## Resultado
Ao abrir o painel Maquinas, o admin vera:
1. Banner com ESP32s pendentes (se houver) — com formulario para nomear, definir tipo/preco e aprovar
2. Tabela com todas as maquinas ja cadastradas

