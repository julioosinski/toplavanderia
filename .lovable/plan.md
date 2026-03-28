

# Liberacao Manual no Dashboard + Relatorios com Dados Reais

## Problemas Identificados

1. **Liberacao manual so existe na pagina Payments** — nao ha botao de "liberar ciclo" ao clicar numa maquina no Dashboard
2. **Liberacao manual nao cria transacao** — o `CreditReleaseWidget` e o `esp32-credit-release` nao inserem registro em `transactions`, entao nao aparece em relatorios
3. **Liberacao manual nao registra quem fez** — nenhum `user_id` e associado a acao
4. **MachineStatusCard so abre detalhes para maquinas "available"** — linha 67: `onClick={() => isAvailable && onClick?.()}` impede clique em maquinas running/offline
5. **MachineDetailsDialog so mostra "Parar/liberar"** — falta botao "Iniciar Ciclo Manual"
6. **Relatorios LaundryReportsTab**: filtros de periodo e maquina funcionam corretamente, mas faltam filtros por tipo (lavadora/secadora) e por metodo de pagamento
7. **ConsolidatedReportsTab**: nao tem filtro de periodo — sempre mostra tudo
8. **Transacoes**: nao distinguem entre pagamento normal e liberacao manual

---

## Plano de Implementacao

### 1. Permitir clique em todas as maquinas no Dashboard

**MachineStatusCard.tsx**: Remover restricao `isAvailable &&` do onClick. Todas as maquinas devem ser clicaveis (menos opacity para offline mas ainda interativas).

### 2. Adicionar "Iniciar Ciclo Manual" no MachineDetailsDialog

**MachineDetailsDialog.tsx**: Adicionar botao "Iniciar Ciclo Manual" para maquinas com status `available`. Ao clicar:
- Buscar `auth.uid()` do admin logado
- Inserir registro em `transactions` com `payment_method: 'manual_release'`, `user_id: auth.uid()`, `status: 'completed'`, `laundry_id`, `machine_id`
- Chamar `esp32-credit-release` com `machineId` para enfileirar comando ON no ESP32
- Atualizar status da maquina para `running`
- Registrar o nome do admin via join com `profiles`

### 3. Atualizar esp32-credit-release para criar transacao

**supabase/functions/esp32-credit-release/index.ts**: Quando receber `machineId`, criar um registro em `transactions`:
```
{ machine_id, laundry_id, total_amount: amount, payment_method: 'manual_release', 
  user_id (do JWT se disponivel), status: 'completed', completed_at: now }
```
Isso garante que toda liberacao manual apareca automaticamente nos relatorios existentes.

### 4. Melhorar Relatorios

**LaundryReportsTab.tsx**:
- Adicionar filtro por tipo de maquina (lavadora/secadora) — via join com `machines.type`
- Adicionar filtro por metodo de pagamento (cartao, PIX, manual, todos)
- Na lista de transacoes, mostrar badge "Manual" quando `payment_method = 'manual_release'`
- Buscar nome do usuario que fez liberacao manual (join com `profiles` via `user_id`)

**ConsolidatedReportsTab.tsx**:
- Adicionar filtro de periodo (data inicial/final) — atualmente so mostra totais acumulados sem restricao temporal

**Transactions.tsx**:
- Adicionar coluna "Operador" que mostra o nome do admin quando `payment_method = 'manual_release'`
- Mostrar badge visual "Liberacao Manual" na coluna de pagamento

### 5. Garantir dados 100% reais

- Dashboard ja usa `supabase.from('machines')` e `transactions` — dados reais
- Relatorios usam queries reais com joins
- Verificar que `ConsolidatedReportsTab` usa `total_revenue` de `machines` (acumulado) em vez de somar transacoes — manter consistencia
- Status das maquinas no dashboard ja reflete ESP32 via Realtime + polling

---

## Detalhes Tecnicos

**Edge Function `esp32-credit-release`**: Adicionar INSERT em `transactions` apos criar o `pending_command`. Extrair `user_id` do header Authorization (JWT) se presente, caso contrario `null`.

**MachineDetailsDialog**: Usar `supabase.auth.getUser()` para obter o admin logado e passar ao edge function. Adicionar botao condicional para `status === 'available'` que chama a liberacao completa.

**MachineStatusCard**: Mudar para `onClick={() => onClick?.()}` — remover gate `isAvailable`. Manter estilo visual diferente para offline/running mas permitir interacao.

**LaundryReportsTab**: Query expandida com join `machines!inner(name, type)` e filtro opcional por `payment_method`.

**Nenhuma migracao SQL necessaria** — `transactions` ja tem `user_id` nullable e `payment_method` text.

