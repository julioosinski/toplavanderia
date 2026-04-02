

## Plano: Mostrar ESP32s pendentes no diálogo de Nova Máquina + corrigir re-registro

### Problemas identificados

**1. ESP32 rejeitado não pode ser re-aprovado**
O `lavadora_02` foi rejeitado anteriormente e agora está online (`is_online: true`). Quando envia heartbeat com `auto_register: true`, o código na Edge Function retorna "Device rejected" e ignora. Não há como "resetar" um ESP32 rejeitado para `pending`.

**2. MachineDialog usa campo de texto livre para ESP32 ID**
O campo "ESP32 ID" é um `<Input>` onde o admin digita manualmente. O admin não sabe quais ESP32s estão disponíveis. Deveria ser um `<Select>` mostrando ESP32s detectados (pendentes, aprovados sem máquina, ou online).

### Correções

#### 1. `src/components/admin/MachineDialog.tsx` — dropdown de ESP32s disponíveis

Substituir o `<Input>` do ESP32 ID por um `<Select>` que busca da tabela `esp32_status`:
- ESP32s com `registration_status = 'pending'` (novos, aguardando)
- ESP32s com `registration_status = 'approved'` que não têm máquina vinculada (órfãos)
- ESP32s com `registration_status = 'rejected'` mas `is_online = true` (re-conectados)
- Manter opção "Outro (digitar manualmente)" para casos especiais

Ao selecionar um ESP32 pendente/rejeitado, o sistema automaticamente atualiza o `registration_status` para `approved` ao salvar a máquina.

#### 2. `src/components/admin/MachineDialog.tsx` — aprovar ESP32 ao criar máquina

No `handleSubmit`, após criar a máquina com sucesso, atualizar o `esp32_status` correspondente para `registration_status: 'approved'`.

#### 3. `supabase/functions/esp32-monitor/index.ts` — permitir re-registro de rejeitados

Quando um ESP32 rejeitado envia heartbeat com `auto_register: true`, em vez de bloquear, atualizar para `pending` novamente. Isso permite que o admin re-aprove.

### Arquivos editados

| Arquivo | Mudança |
|---|---|
| `src/components/admin/MachineDialog.tsx` | ESP32 ID vira Select com ESP32s disponíveis; aprova ESP32 ao criar máquina |
| `supabase/functions/esp32-monitor/index.ts` | ESP32 rejeitado volta a `pending` quando re-conecta com `auto_register` |

### Fluxo corrigido

```text
ESP32 novo conecta → heartbeat com auto_register → inserido como "pending"
ESP32 rejeitado re-conecta → heartbeat com auto_register → atualizado para "pending"
Admin clica "Nova Máquina" → Select mostra ESP32s pendentes/órfãos
Admin seleciona ESP32, preenche dados, salva → máquina criada + ESP32 aprovado
```

