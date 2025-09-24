# Database Schema - TopLavanderia

## Visão Geral
O TopLavanderia utiliza Supabase (PostgreSQL) como banco de dados principal, com Row Level Security (RLS) habilitado para todas as tabelas.

## Tabelas Principais

### profiles
Perfis de usuários do sistema
```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user', 'operator')),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

**RLS Policies:**
- `profiles_select_policy`: Usuários podem ver todos os perfis
- `profiles_update_policy`: Usuários podem atualizar apenas seu próprio perfil
- `profiles_insert_policy`: Usuários podem criar apenas seu próprio perfil

### machines
Máquinas de lavar cadastradas no sistema
```sql
CREATE TABLE public.machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('washer', 'dryer')),
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance', 'offline')),
  location TEXT,
  esp32_ip TEXT,
  price_per_cycle DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  cycle_duration_minutes INTEGER DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

**Indexes:**
- `idx_machines_status` ON (status)
- `idx_machines_type` ON (type)
- `idx_machines_esp32_ip` ON (esp32_ip)

### transactions
Transações de pagamento
```sql
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  machine_id UUID REFERENCES public.machines(id),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('paygo_credit', 'paygo_debit', 'paygo_pix', 'tef', 'cash')),
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'refunded')),
  paygo_transaction_id TEXT,
  tef_transaction_id TEXT,
  pix_qr_code TEXT,
  pix_payment_id TEXT,
  order_id TEXT UNIQUE,
  error_message TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

**Indexes:**
- `idx_transactions_user_id` ON (user_id)
- `idx_transactions_machine_id` ON (machine_id)
- `idx_transactions_status` ON (status)
- `idx_transactions_payment_method` ON (payment_method)
- `idx_transactions_order_id` UNIQUE ON (order_id)

### machine_usage
Histórico de uso das máquinas
```sql
CREATE TABLE public.machine_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID REFERENCES public.machines(id) NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  transaction_id UUID REFERENCES public.transactions(id),
  start_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
  end_time TIMESTAMP WITH TIME ZONE,
  cycle_type TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'interrupted', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### esp32_devices
Dispositivos ESP32 conectados
```sql
CREATE TABLE public.esp32_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address INET UNIQUE NOT NULL,
  mac_address TEXT,
  device_name TEXT,
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'maintenance')),
  connected_machines TEXT[], -- Array de IDs das máquinas conectadas
  last_ping TIMESTAMP WITH TIME ZONE,
  firmware_version TEXT,
  uptime_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### paygo_config
Configurações do PayGO por instalação
```sql
CREATE TABLE public.paygo_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id TEXT UNIQUE NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 3000,
  automation_key TEXT NOT NULL,
  timeout_seconds INTEGER DEFAULT 30,
  retry_attempts INTEGER DEFAULT 3,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### tef_config
Configurações do TEF
```sql
CREATE TABLE public.tef_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id TEXT UNIQUE NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('positivo', 'stone', 'cielo')),
  endpoint_url TEXT NOT NULL,
  merchant_id TEXT NOT NULL,
  terminal_id TEXT NOT NULL,
  access_token TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### system_logs
Logs do sistema
```sql
CREATE TABLE public.system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
  source TEXT NOT NULL, -- 'paygo', 'tef', 'esp32', 'app'
  message TEXT NOT NULL,
  metadata JSONB,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Partition por data para performance
CREATE INDEX idx_system_logs_created_at ON public.system_logs (created_at);
CREATE INDEX idx_system_logs_level ON public.system_logs (level);
CREATE INDEX idx_system_logs_source ON public.system_logs (source);
```

## Views

### machine_status_view
View consolidada do status das máquinas
```sql
CREATE VIEW public.machine_status_view AS
SELECT 
  m.id,
  m.name,
  m.type,
  m.status,
  m.location,
  m.price_per_cycle,
  e.status as esp32_status,
  e.ip_address as esp32_ip,
  mu.start_time as current_cycle_start,
  mu.end_time as current_cycle_end,
  CASE 
    WHEN mu.status = 'active' THEN 
      EXTRACT(EPOCH FROM (now() - mu.start_time))/60
    ELSE NULL 
  END as current_cycle_minutes
FROM public.machines m
LEFT JOIN public.esp32_devices e ON e.ip_address::text = m.esp32_ip
LEFT JOIN public.machine_usage mu ON mu.machine_id = m.id 
  AND mu.status = 'active';
```

### transaction_summary_view
Resumo de transações por período
```sql
CREATE VIEW public.transaction_summary_view AS
SELECT 
  DATE(created_at) as transaction_date,
  payment_method,
  status,
  COUNT(*) as transaction_count,
  SUM(amount) as total_amount,
  AVG(amount) as average_amount
FROM public.transactions
GROUP BY DATE(created_at), payment_method, status
ORDER BY transaction_date DESC;
```

## Funções

### handle_new_user()
Trigger function para criar perfil automaticamente
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data ->> 'full_name', new.email),
    'user'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

### update_updated_at_column()
Trigger function para atualizar timestamp automaticamente
```sql
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

### calculate_machine_revenue()
Função para calcular receita por máquina
```sql
CREATE OR REPLACE FUNCTION public.calculate_machine_revenue(
  machine_uuid UUID,
  start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  total_revenue DECIMAL(10,2),
  transaction_count INTEGER,
  average_transaction DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(t.amount), 0) as total_revenue,
    COUNT(t.id)::INTEGER as transaction_count,
    COALESCE(AVG(t.amount), 0) as average_transaction
  FROM public.transactions t
  WHERE t.machine_id = machine_uuid
    AND t.status = 'completed'
    AND DATE(t.created_at) BETWEEN start_date AND end_date;
END;
$$ LANGUAGE plpgsql;
```

## Triggers

### profiles_updated_at_trigger
```sql
CREATE TRIGGER profiles_updated_at_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
```

### machines_updated_at_trigger
```sql
CREATE TRIGGER machines_updated_at_trigger
  BEFORE UPDATE ON public.machines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
```

### new_user_trigger
```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

## Row Level Security (RLS)

### Políticas Gerais
Todas as tabelas têm RLS habilitado. As políticas seguem estes padrões:

**Para tabelas de configuração (paygo_config, tef_config):**
- SELECT: Apenas admins
- INSERT/UPDATE/DELETE: Apenas admins

**Para tabelas operacionais (transactions, machine_usage):**
- SELECT: Usuários podem ver suas próprias transações, admins veem tudo
- INSERT: Usuários autenticados podem criar
- UPDATE: Apenas admins ou o próprio usuário
- DELETE: Apenas admins

**Para tabelas públicas (machines, esp32_devices):**
- SELECT: Todos os usuários autenticados
- INSERT/UPDATE/DELETE: Apenas admins

### Exemplo de Política RLS
```sql
-- Política para transactions
CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (
    auth.uid() = user_id OR 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
```

## Migrações

### Exemplo de Migration
```sql
-- Migration: 001_initial_schema.sql
BEGIN;

-- Criar tabelas...
-- Criar indexes...
-- Criar RLS policies...
-- Inserir dados iniciais...

COMMIT;
```

## Backup e Manutenção

### Rotinas Recomendadas
- Backup diário automático via Supabase
- Limpeza de logs antigos (>90 dias)
- Reindex semanal das tabelas principais
- Monitoramento de performance das queries

### Comandos de Manutenção
```sql
-- Limpar logs antigos
DELETE FROM public.system_logs 
WHERE created_at < now() - INTERVAL '90 days';

-- Analisar estatísticas
ANALYZE public.transactions;
ANALYZE public.machine_usage;

-- Verificar tamanho das tabelas
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```