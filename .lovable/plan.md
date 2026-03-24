

# Implementar Todas as 5 Melhorias do Sistema

## Melhoria 1: PIN Administrativo do Supabase

Migrar `useAdminAccess.ts` para buscar o PIN via `validate_admin_pin()` do Supabase em vez do hardcoded `"1234"`.

**Arquivo: `src/hooks/useAdminAccess.ts`**
- Tornar `authenticate` e `validatePin` assíncronos
- Chamar `supabase.rpc('validate_admin_pin', { _pin: pin })` para validação
- Manter fallback local `"1234"` apenas se a chamada RPC falhar (offline)
- Atualizar assinaturas: `authenticate(pin) → Promise<boolean>`, `validatePin(pin) → Promise<boolean>`

**Arquivos impactados pela mudança de assinatura:**
- `src/pages/Totem.tsx` — `handleReconfigurePin` e `handleAdminAuthenticate` precisam virar `async`
- `src/components/admin/AdminPinDialog.tsx` — `onAuthenticate` precisa aceitar retorno `Promise<boolean>`

**Nota:** A tabela `admin_config` e a função `validate_admin_pin` já existem no Supabase. A RLS permite apenas super_admins lerem a tabela, mas a função é `SECURITY DEFINER` e pode ser chamada por qualquer um — ideal para o totem sem login.

---

## Melhoria 2: Refatorar Totem.tsx em Componentes

Extrair do monolito de 934 linhas:

| Componente | Responsabilidade | Linhas aprox. |
|---|---|---|
| `TotemHeader.tsx` | Logo, hora, badge de modo, gesto secreto | 650-683 |
| `TotemMachineCard.tsx` | Card individual de máquina (reutilizado para lavadoras e secadoras) | 712-759 / 774-823 |
| `TotemMachineGrid.tsx` | Grid de lavadoras + secadoras | 697-827 |
| `TotemCNPJSetup.tsx` | Tela de configuração inicial por CNPJ | 416-471 |
| `TotemReconfigureDialog.tsx` | Dialog de reconfiguração via gesto secreto | 848-930 |
| `TotemPaymentScreens.tsx` | Telas de processing, error, success | 486-595 |

**Diretório:** `src/components/totem/`

O `Totem.tsx` ficará como orquestrador (~150 linhas), delegando renderização aos sub-componentes.

---

## Melhoria 3: Cache Offline de Máquinas

**Arquivo: `src/hooks/useMachines.ts`**
- Após cada `fetchMachines` bem-sucedido, salvar os dados transformados via `nativeStorage.setItem('machines_cache_<laundryId>', JSON.stringify(machines))`
- No `catch` do `fetchMachines`, antes de setar `setMachines([])`, tentar carregar do cache
- Adicionar flag `isOffline` ao retorno do hook para que a UI possa mostrar indicador

**Arquivo: `src/pages/Totem.tsx` (ou `TotemHeader.tsx` após refactor)**
- Mostrar badge "Offline - dados em cache" quando `isOffline` for `true`

---

## Melhoria 4: Tela de Diagnóstico

**Novo arquivo: `src/components/totem/TotemDiagnostics.tsx`**

Acessível pelo gesto secreto (após PIN), como uma terceira opção além de "reconfigurar CNPJ". Ou como aba no dialog de reconfiguração.

Informações exibidas:
- CNPJ e nome da lavanderia configurada
- ID do totem (`totem_laundry_id`)
- Status de conexão Supabase (realtime channel status)
- Quantidade de máquinas carregadas (online/offline/total)
- Último heartbeat de cada ESP32
- Informações do dispositivo (`deviceInfo` do Capacitor)
- Versão do app (do `package.json`)
- Botão "Copiar Diagnóstico" para suporte remoto

**Integração:** Adicionar `reconfigureStep = 'pin' | 'cnpj' | 'diagnostics'` no dialog existente, com botões para navegar entre as opções após autenticação do PIN.

---

## Melhoria 5: Countdown Visual para Máquinas em Uso

**Arquivo: `src/hooks/useMachines.ts`**
- Calcular `timeRemaining` baseado em `updated_at` + `cycle_time_minutes`:
  ```
  const elapsed = (now - updatedAt) / 60000;
  timeRemaining = Math.max(0, cycleTime - elapsed);
  ```
- Setar esse valor no campo `timeRemaining` da interface `Machine`

**Arquivo: `TotemMachineCard.tsx` (ou diretamente no Totem.tsx)**
- O código de Progress bar já existe (linhas 746-753), mas nunca é ativado porque `timeRemaining` nunca é populado
- Com o cálculo acima, a barra de progresso e o texto de minutos restantes aparecerão automaticamente
- Adicionar atualização a cada 30s via `setInterval` no `Totem.tsx` para manter o countdown atualizado

---

## Ordem de Implementação

1. **Melhoria 5** (countdown) — menor risco, ativa funcionalidade existente
2. **Melhoria 1** (PIN do Supabase) — correção de segurança crítica
3. **Melhoria 3** (cache offline) — resiliência
4. **Melhoria 2** (refatoração) — organização do código
5. **Melhoria 4** (diagnósticos) — utiliza estrutura refatorada

## Arquivos Criados/Modificados

- `src/hooks/useAdminAccess.ts` — PIN via Supabase RPC
- `src/hooks/useMachines.ts` — cache offline + cálculo timeRemaining
- `src/pages/Totem.tsx` — orquestrador simplificado
- `src/components/totem/TotemHeader.tsx` — novo
- `src/components/totem/TotemMachineCard.tsx` — novo
- `src/components/totem/TotemMachineGrid.tsx` — novo
- `src/components/totem/TotemCNPJSetup.tsx` — novo
- `src/components/totem/TotemReconfigureDialog.tsx` — novo
- `src/components/totem/TotemPaymentScreens.tsx` — novo
- `src/components/totem/TotemDiagnostics.tsx` — novo
- `src/components/admin/AdminPinDialog.tsx` — async pin validation

