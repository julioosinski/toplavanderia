
# Revisao Completa do Sistema TopLavanderia

## Resumo Executivo

Apos analise detalhada do codigo, banco de dados, edge functions e logs, identifiquei **23 problemas** organizados por criticidade, seguidos de sugestoes de melhoria.

---

## PROBLEMAS CRITICOS (Sistema nao funciona corretamente)

### 1. ESP32 sem heartbeat ha 128 dias
- **Situacao**: Os ESP32s `lavadora_01` e `lavadora_02` tem `is_online: true` mas o ultimo heartbeat foi em 12/10/2025 (ha ~128 dias)
- **Impacto**: Todas as 10 maquinas aparecem como "OFFLINE" no totem, impossibilitando vendas
- **Causa raiz**: ESP32 fisico nao esta enviando heartbeats (provavelmente desligado ou sem WiFi)
- **Correcao**: Reconectar os ESP32s fisicos com o codigo Arduino corrigido, e executar SQL para limpar dados antigos:
```text
UPDATE esp32_status 
SET is_online = false, network_status = 'timeout' 
WHERE last_heartbeat < NOW() - INTERVAL '10 minutes';
```

### 2. Registro fantasma do ESP32 na lavanderia errada
- **Situacao**: Existe um registro `lavadora_01` com `laundry_id = 567a7bb6...` (Lavanderia Principal) quando deveria ser `8ace0bcb...` (TOP LAVANDERIA SINUELO)
- **Impacto**: Dados duplicados e confusos no sistema
- **Correcao**: Deletar o registro incorreto:
```text
DELETE FROM esp32_status 
WHERE laundry_id = '567a7bb6-8d26-4d9c-bbe3-f8dcc28e7569';
```

### 3. Lavadora 01 tem relay_pin = 2 (diferente de todas as outras)
- **Situacao**: Todas as maquinas usam `relay_pin = 1`, exceto Lavadora 01 que usa `relay_pin = 2`
- **Impacto**: Quando o ESP32 envia `relay_1: on/off`, o sistema nao consegue mapear para a Lavadora 01 (espera `relay_2`)
- **Correcao**: Verificar se o hardware realmente usa pino 2. Se nao, corrigir:
```text
UPDATE machines SET relay_pin = 1 
WHERE name = 'Lavadora 01' 
AND laundry_id = '8ace0bcb-83a9-4555-a712-63ef5f52e709';
```

### 4. Totem nao ativa a maquina fisicamente via ESP32
- **Situacao**: No `Totem.tsx` linhas 433-438, a chamada ao ESP32 para ativar a maquina esta comentada/mockada:
```text
// Simular chamada para ESP32 - na implementação real seria uma chamada HTTP
console.log(`Ativando máquina...`);
// await fetch(`http://esp32-host:port/activate/${machine.relay_pin}`)
```
- **Impacto**: Apos pagamento aprovado, a maquina NAO liga fisicamente
- **Correcao**: Implementar chamada real ao edge function `esp32-control`:
```text
await supabase.functions.invoke('esp32-control', {
  body: {
    esp32_id: selectedMachine.esp32_id,
    relay_pin: selectedMachine.relay_pin || 1,
    action: 'on',
    machine_id: selectedMachine.id
  }
});
```

### 5. Transacoes criadas sem user_id
- **Situacao**: Na funcao `activateMachine()` do Totem, as transacoes sao inseridas sem `user_id` (todos os registros atuais tem `user_id: null`)
- **Impacto**: Impossivel rastrear quem fez cada transacao, relatorios incompletos
- **Correcao**: Como o totem e publico, considerar vincular ao operador logado ou manter null mas registrar device_uuid

---

## PROBLEMAS DE SEGURANCA

### 6. RLS Policy `esp32_full_access` permite acesso publico total
- **Situacao**: A tabela `esp32_status` tem policy `ALL` com `USING (true)` e `WITH CHECK (true)` para o role `public`
- **Impacto**: Qualquer pessoa pode ler/inserir/atualizar/deletar dados de ESP32 sem autenticacao
- **Correcao**: Restringir para service_role (edge functions) e usuarios autenticados com role adequado

### 7. Policy `pending_commands` permite acesso publico total
- **Situacao**: `System can manage pending commands` usa `USING (true)` / `WITH CHECK (true)` para `public`
- **Impacto**: Qualquer pessoa pode enviar comandos aos ESP32s

### 8. Views com SECURITY DEFINER (linter errors 2 e 3)
- **Situacao**: As views `machine_status_view` e `public_machines` usam SECURITY DEFINER
- **Impacto**: Bypass de RLS policies
- **Correcao**: Recriar com `security_invoker = on`

### 9. Signup aberto - qualquer pessoa pode criar conta
- **Situacao**: A pagina de Auth permite cadastro livre sem restricoes
- **Impacto**: Qualquer pessoa pode criar conta (mesmo sem role, nao acessa admin, mas cria registros no banco)
- **Correcao**: Considerar desabilitar signup publico ou implementar aprovacao

### 10. ESP32 control usa ANON KEY em vez de SERVICE_ROLE_KEY
- **Situacao**: `esp32-control/index.ts` linha 24 usa `SUPABASE_ANON_KEY`
- **Impacto**: Edge function limitada pelas RLS policies do anon role, pode falhar ao atualizar dados
- **Correcao**: Trocar para `SUPABASE_SERVICE_ROLE_KEY`

---

## PROBLEMAS DE LOGICA/DADOS

### 11. Maquinas fallback no Totem criam dados falsos
- **Situacao**: `useMachines.ts` linhas 203-226 e `Totem.tsx` linhas 738-748 criam maquinas "fantasma" quando ha erro ou poucas maquinas
- **Impacto**: Usuarios podem selecionar maquinas que nao existem fisicamente
- **Correcao**: Remover fallback do Totem e mostrar mensagem de erro ao inves de maquinas falsas

### 12. Preco exibido como price_per_kg mas usado como preco total
- **Situacao**: A tabela `machines` tem coluna `price_per_kg` com valor 18.00, mas no `useMachines.ts` linha 181: `price: Number(machine.price_per_kg) || 18.00` - o preco e exibido como valor fixo, nao por kg
- **Impacto**: Confusao conceitual - o campo chama "preco por kg" mas e cobrado como preco fixo por ciclo
- **Correcao**: Renomear coluna para `price_per_cycle` ou implementar calculo por peso real

### 13. total_revenue e total_uses nunca sao atualizados
- **Situacao**: Todas as maquinas tem `total_revenue: 0.00` e `total_uses: 0`, apesar de existirem 3 transacoes completadas
- **Impacto**: Dashboard de relatorios mostra dados incorretos
- **Correcao**: Criar trigger que atualiza esses campos ao completar transacao, ou calcular via query

### 14. Cache do QueryClient invalida com queryKey incorreta
- **Situacao**: `useSystemSettings.ts` linha 142: `queryClient.setQueryData(['system-settings'], data)` mas a query usa `['system-settings', currentLaundry?.id]`
- **Impacto**: Cache nao atualiza corretamente apos mutation, mostra dados antigos
- **Correcao**: Usar `queryClient.setQueryData(['system-settings', currentLaundry?.id], data)`

### 15. esp32-health-check faz requests HTTP para IPs locais
- **Situacao**: Edge functions rodam na infraestrutura Supabase (cloud) e tentam acessar IPs locais como `192.168.0.x`
- **Impacto**: Nunca vai funcionar - edge functions nao tem acesso a rede local
- **Correcao**: O modelo correto ja existe (heartbeat do ESP32 para a edge function). Remover a logica de polling ativo do health-check

---

## PROBLEMAS MENORES

### 16. Duplicate realtime channels
- `useMachines.ts` e `useESP32Status.ts` ambos subscrevem a mudancas em `esp32_status` com nomes de channel diferentes, causando refetch duplicado

### 17. useMachineAutoStatus roda em todo componente
- O hook e chamado dentro de `useMachines` que e usado no Totem. Ele atualiza maquinas diretamente no banco a cada 60s, mesmo quando o totem esta ocioso

### 18. Sem tratamento de reconexao WiFi no Totem
- Se o tablet perder conexao WiFi, nao ha feedback visual ou retry automatico

### 19. Dados de transacao incompletos
- As 3 transacoes existentes tem `weight_kg: 8.00` e `total_amount: 144.00` (8 * 18), mas foram criadas pela edge function `esp32-monitor` com estimativa de 80% da capacidade, nao pelo Totem

### 20. Segunda lavanderia "Lavanderia Principal" sem maquinas
- Existe mas nao tem maquinas nem ESP32s configurados (apenas registro fantasma)

---

## PLANO DE CORRECAO (Priorizado)

### Fase 1 - Correcoes Criticas (fazer agora)
1. **Corrigir ativacao real do ESP32 no Totem** - Integrar com edge function `esp32-control` apos pagamento
2. **Limpar dados fantasma** - Deletar esp32_status da lavanderia errada, corrigir relay_pin da Lavadora 01
3. **Corrigir cache do useSystemSettings** - Fix na queryKey do setQueryData
4. **Remover maquinas fallback** - Tirar dados fictícios do Totem e useMachines

### Fase 2 - Seguranca
5. **Corrigir RLS de esp32_status** - Restringir acesso publico
6. **Corrigir RLS de pending_commands** - Restringir acesso publico
7. **Corrigir esp32-control** - Usar SERVICE_ROLE_KEY
8. **Corrigir views** - Alterar para security_invoker

### Fase 3 - Melhorias de Dados
9. **Criar trigger para total_revenue/total_uses** - Atualizar automaticamente
10. **Renomear price_per_kg** - Para refletir uso real (preco por ciclo)
11. **Implementar calculo real de receita** - Query consolidada

### Fase 4 - Melhorias de UX
12. **Adicionar indicador de conexao no Totem** - Feedback visual de WiFi/internet
13. **Implementar auto-reconnect** - Retry automatico quando perde conexao
14. **Remover health-check por polling** - Manter apenas modelo heartbeat

### Secao Tecnica - Detalhes de Implementacao

**Arquivos a modificar:**
- `src/pages/Totem.tsx` - Integrar esp32-control, remover fallback
- `src/hooks/useMachines.ts` - Remover maquinas fallback, corrigir duplicacao
- `src/hooks/useSystemSettings.ts` - Corrigir queryKey do cache
- `supabase/functions/esp32-control/index.ts` - Trocar ANON_KEY por SERVICE_ROLE_KEY
- Migracao SQL para: corrigir RLS, corrigir views, criar triggers

**Migracao SQL necessaria:**
```text
-- 1. Limpar dados fantasma
DELETE FROM esp32_status WHERE laundry_id = '567a7bb6-8d26-4d9c-bbe3-f8dcc28e7569';

-- 2. Marcar ESP32s desatualizados como offline
UPDATE esp32_status SET is_online = false, network_status = 'timeout'
WHERE last_heartbeat < NOW() - INTERVAL '10 minutes';

-- 3. Corrigir relay_pin (verificar hardware antes)
-- UPDATE machines SET relay_pin = 1 WHERE id = 'b7fbb991-...';

-- 4. Corrigir RLS esp32_status
DROP POLICY "esp32_full_access" ON esp32_status;
CREATE POLICY "esp32_select_authenticated" ON esp32_status 
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "esp32_service_role_all" ON esp32_status 
  FOR ALL USING (auth.role() = 'service_role');

-- 5. Corrigir RLS pending_commands
DROP POLICY "System can manage pending commands" ON pending_commands;
CREATE POLICY "pending_commands_service_role" ON pending_commands 
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "pending_commands_admin_select" ON pending_commands 
  FOR SELECT USING (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'));

-- 6. Corrigir views
DROP VIEW IF EXISTS machine_status_view;
CREATE VIEW machine_status_view WITH (security_invoker = on) AS ...;

DROP VIEW IF EXISTS public_machines;
CREATE VIEW public_machines WITH (security_invoker = on) AS ...;
```
