# Melhorias de Segurança - TopLavanderia

Este documento descreve as melhorias de segurança recomendadas e alertas identificados pelo Supabase Linter.

## ✅ Implementado

### 1. Autenticação e Autorização

#### ✅ Restrição de Criação de Usuários
- **Implementado**: Apenas super administradores podem criar novos usuários
- **Local**: `src/components/admin/UserManagement.tsx`
- **Validação**: Botão "Novo Usuário" visível apenas para `super_admin`

#### ✅ Troca de Senha
- **Implementado**: Usuários podem trocar suas próprias senhas
- **Local**: `src/components/admin/PasswordChangeDialog.tsx`
- **Requisitos**: Senha com mínimo de 6 caracteres

#### ✅ Gestão de Lavanderias
- **Implementado**: Apenas super administradores podem criar/editar lavanderias
- **Local**: `src/components/admin/LaundryManagement.tsx`
- **RLS**: Políticas `is_super_admin()` validam acesso

### 2. Relatórios e Filtros

#### ✅ Filtro por Lavanderia
- **Implementado**: Super admin pode filtrar relatórios consolidados por lavanderia específica
- **Local**: `src/components/admin/ConsolidatedReportsTab.tsx`
- **Funcionalidade**: Select com opção "Todas as Lavanderias" + lavanderias individuais

### 3. Monitoramento ESP32

#### ✅ Teste de Conexão
- **Implementado**: Botão para testar conectividade de cada ESP32
- **Local**: `src/components/settings/ESP32ConnectionTest.tsx`
- **Funcionalidade**: 
  - Timeout de 5 segundos
  - Indicador visual (verde/vermelho)
  - Feedback via toast

#### ✅ Health Check Automático
- **Implementado**: Edge Function para verificar saúde de todos os ESP32s
- **Local**: `supabase/functions/esp32-health-check/index.ts`
- **Funcionalidade**:
  - Verifica todos os ESP32s configurados
  - Atualiza status no banco (`esp32_status`)
  - Pode ser agendado via cron

### 4. Backend - Edge Functions

#### ✅ Transaction Webhook
- **Implementado**: Webhook para receber atualizações de transações do APK
- **Local**: `supabase/functions/transaction-webhook/index.ts`
- **Funcionalidade**:
  - Atualiza status de transações
  - Registra logs de auditoria
  - Atualiza estatísticas de máquinas
- **Segurança**: JWT desabilitado (público, mas validado internamente)

### 5. Documentação APK

#### ✅ Guia de Integração
- **Criado**: `docs/APK_INTEGRATION.md`
- **Conteúdo**:
  - Endpoints disponíveis
  - Fluxos de autenticação
  - Exemplos de uso
  - Tratamento de erros
  - Checklist de segurança

## ⚠️ Alertas de Segurança (Supabase Linter)

### 🔴 ERROR: Security Definer View

**Problema**: Views com `SECURITY DEFINER` podem representar riscos de segurança se não forem auditadas.

**Recomendação**:
```sql
-- Revisar todas as views SECURITY DEFINER
SELECT 
  schemaname, 
  viewname, 
  viewowner 
FROM pg_views 
WHERE definition ILIKE '%SECURITY DEFINER%';

-- Avaliar se cada view realmente precisa de SECURITY DEFINER
-- Se possível, remover ou usar SECURITY INVOKER
```

**Ação necessária**: Revisar manualmente cada view e validar necessidade.

### 🟡 WARN: OTP Expiry Longo (3600 segundos)

**Problema**: Tempo de expiração de OTP muito longo aumenta janela de ataque.

**Recomendação**:
```bash
# Via Supabase Dashboard
# Authentication > Settings > Auth
# OTP Expiry: Reduzir para 300-600 segundos (5-10 minutos)
```

**Ação necessária**: Configurar no Supabase Dashboard.

### 🟡 WARN: Leaked Password Protection Desabilitada

**Problema**: Sistema não verifica se senhas foram vazadas em breaches conhecidos.

**Recomendação**:
```bash
# Via Supabase Dashboard
# Authentication > Settings > Auth
# Enable "Password Breach Protection"
```

**Ação necessária**: Habilitar no Supabase Dashboard.

### 🟡 WARN: Postgres Desatualizado

**Problema**: Versão do Postgres desatualizada pode conter vulnerabilidades.

**Recomendação**:
```bash
# Via Supabase Dashboard
# Database > Settings
# Agendar upgrade para próxima janela de manutenção
```

**Ação necessária**: Agendar upgrade no Supabase Dashboard.

## 🔒 Checklist de Segurança

### Autenticação
- ✅ RLS habilitado em todas as tabelas sensíveis
- ✅ Funções `SECURITY DEFINER` para verificação de roles
- ✅ Políticas específicas por role (`super_admin`, `admin`, `operator`, `user`)
- ✅ Validação de entrada com zod
- ⚠️ OTP expiry precisa ser reduzido
- ⚠️ Password breach protection precisa ser habilitado

### Autorização
- ✅ Usuários só veem dados de suas lavanderias
- ✅ Super admin tem acesso total
- ✅ Admin/Operator acesso limitado à sua lavanderia
- ✅ Criação de usuários restrita a super_admin

### Backend (Edge Functions)
- ✅ CORS configurado corretamente
- ✅ Validação de entrada em todas as functions
- ✅ Logging detalhado para auditoria
- ✅ Timeout configurado para requisições externas
- ✅ Retry logic implementado

### APK/Totem
- ✅ Autenticação via `device_uuid`
- ✅ RLS policies específicas para APK
- ✅ Webhook público mas com validação
- ✅ Documentação completa de endpoints

### Monitoramento
- ✅ Logs de auditoria (`audit_logs`)
- ✅ Eventos de segurança (`security_events`)
- ✅ Health checks dos ESP32s
- ✅ Heartbeat automático

## 📋 Próximos Passos

### Prioridade Alta
1. **Configurar OTP Expiry** (5-10 minutos)
2. **Habilitar Password Breach Protection**
3. **Revisar e documentar views SECURITY DEFINER**

### Prioridade Média
4. **Agendar upgrade do Postgres**
5. **Implementar rate limiting nas Edge Functions**
6. **Adicionar 2FA para super admins**

### Prioridade Baixa
7. **Adicionar logs de acesso detalhados**
8. **Implementar rotação automática de credenciais ESP32**
9. **Criar dashboard de segurança dedicado**

## 🔧 Como Aplicar as Correções

### 1. Configurações do Supabase Dashboard

```bash
# 1. Acesse o Supabase Dashboard
# 2. Navegue até o projeto TopLavanderia
# 3. Vá em Authentication > Settings

# Configurar OTP Expiry:
OTP Expiry: 600 (10 minutos)

# Habilitar Password Breach Protection:
☑️ Enable Password Breach Protection

# 4. Vá em Database > Settings

# Agendar upgrade do Postgres:
☑️ Schedule Postgres Upgrade
Data: [Próxima janela de manutenção]
```

### 2. Revisar SECURITY DEFINER Views

```sql
-- 1. Conectar ao banco via SQL Editor
-- 2. Executar query para listar views

SELECT 
  n.nspname AS schema_name,
  c.relname AS view_name,
  pg_get_userbyid(c.relowner) AS owner,
  pg_get_viewdef(c.oid) AS view_definition
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'v'
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND pg_get_viewdef(c.oid) ILIKE '%security definer%';

-- 3. Para cada view encontrada:
--    a) Validar se SECURITY DEFINER é realmente necessário
--    b) Se não for, alterar para SECURITY INVOKER
--    c) Documentar o motivo de usar SECURITY DEFINER

-- Exemplo de correção:
-- ALTER VIEW view_name SET (security_invoker = true);
```

## 📞 Suporte

Para dúvidas sobre implementação de segurança:
1. Consulte a documentação do Supabase: https://supabase.com/docs/guides/auth
2. Verifique as RLS policies: https://supabase.com/docs/guides/auth/row-level-security
3. Revise os logs de segurança em `security_events`

## 📊 Métricas de Segurança

### Implementadas
- ✅ 100% das tabelas com RLS habilitado
- ✅ 4 roles distintos com permissões específicas
- ✅ 3 níveis de logs (audit, security, system)
- ✅ 2 edge functions para monitoramento
- ✅ 1 guia completo de integração APK

### Pendentes
- ⚠️ 1 ERROR (SECURITY DEFINER views)
- ⚠️ 3 WARNs (OTP, Password Protection, Postgres)
- 📋 9 itens no backlog de melhorias
