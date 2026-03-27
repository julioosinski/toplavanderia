

# Corrigir Detecção de ESP32 sem Máquina Associada

## Problema

O ESP32 "lavadora teste" está na tabela `esp32_status` com `registration_status = 'approved'` e `is_online = true`, mas **não existe uma máquina na tabela `machines`** vinculada a ele. O componente `ESP32PendingApproval` só busca dispositivos com `registration_status = 'pending'`, então esse ESP32 fica invisível.

## Solução

Duas ações:

### 1. Corrigir o registro atual no banco
- Alterar o `registration_status` do ESP32 "lavadora teste" de `approved` para `pending` via migration, para que ele apareça no painel de aprovação e o admin possa criar a máquina.

### 2. Melhorar o componente `ESP32PendingApproval`
- Além de buscar ESP32s com `registration_status = 'pending'`, também buscar ESP32s com `registration_status = 'approved'` que **não têm máquina associada** na tabela `machines`.
- Isso previne que o problema se repita: se um ESP32 for aprovado mas a máquina não for criada (por erro ou falha), ele continuará aparecendo no painel.

## Alterações

### Arquivo: `src/components/admin/ESP32PendingApproval.tsx`
- Modificar `fetchPendingDevices` para buscar ESP32s pendentes E ESP32s aprovados sem máquina correspondente
- Buscar a lista de `esp32_id`s da tabela `machines` para a lavanderia atual
- Filtrar ESP32s aprovados que não estão vinculados a nenhuma máquina
- Mostrar ambos os grupos (pendentes e "órfãos") no mesmo painel

### Database: Corrigir registro atual
- Executar UPDATE para setar `registration_status = 'pending'` no ESP32 "lavadora teste" (solução imediata enquanto o código é melhorado)

## Resultado
- O ESP32 "lavadora teste" aparecerá imediatamente no painel de Máquinas para ser configurado
- Futuramente, qualquer ESP32 aprovado sem máquina também será detectado automaticamente

