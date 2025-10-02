-- FASE 4: SISTEMA DE AUDITORIA E LOGS
-- ==========================================

-- Criar tabela de audit logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- Habilitar RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: apenas admins podem ver logs
CREATE POLICY "Only admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Criar tabela de security events
CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('failed_login', 'suspicious_payment', 'unauthorized_access', 'device_change', 'rate_limit_exceeded', 'invalid_pin_attempt')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  device_uuid TEXT,
  ip_address INET,
  user_agent TEXT,
  details JSONB,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para security events
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON public.security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON public.security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON public.security_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_resolved ON public.security_events(resolved);

-- Habilitar RLS
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Policy: apenas admins podem ver security events
CREATE POLICY "Only admins can view security events"
  ON public.security_events FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update security events"
  ON public.security_events FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Função para log de auditoria automático
CREATE OR REPLACE FUNCTION public.log_audit_trail()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (
    action,
    table_name,
    record_id,
    old_values,
    new_values,
    timestamp
  )
  VALUES (
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    now()
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar triggers de auditoria para tabelas críticas
DROP TRIGGER IF EXISTS audit_transactions ON public.transactions;
CREATE TRIGGER audit_transactions
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();

DROP TRIGGER IF EXISTS audit_user_credits ON public.user_credits;
CREATE TRIGGER audit_user_credits
  AFTER INSERT OR UPDATE OR DELETE ON public.user_credits
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();

DROP TRIGGER IF EXISTS audit_machines ON public.machines;
CREATE TRIGGER audit_machines
  AFTER INSERT OR UPDATE OR DELETE ON public.machines
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();

DROP TRIGGER IF EXISTS audit_system_settings ON public.system_settings;
CREATE TRIGGER audit_system_settings
  AFTER UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();

DROP TRIGGER IF EXISTS audit_user_roles ON public.user_roles;
CREATE TRIGGER audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();

-- Função para registrar eventos de segurança
CREATE OR REPLACE FUNCTION public.log_security_event(
  _event_type TEXT,
  _severity TEXT,
  _user_id UUID DEFAULT NULL,
  _device_uuid TEXT DEFAULT NULL,
  _details JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  event_id UUID;
BEGIN
  INSERT INTO public.security_events (
    event_type,
    severity,
    user_id,
    device_uuid,
    details,
    timestamp
  )
  VALUES (
    _event_type,
    _severity,
    _user_id,
    _device_uuid,
    _details,
    now()
  )
  RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função para limpar logs antigos (executar via cron)
CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
RETURNS void AS $$
BEGIN
  -- Deletar audit logs com mais de 90 dias
  DELETE FROM public.audit_logs
  WHERE timestamp < now() - INTERVAL '90 days';
  
  -- Deletar security events resolvidos com mais de 180 dias
  DELETE FROM public.security_events
  WHERE resolved = true 
    AND resolved_at < now() - INTERVAL '180 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para notificar admins sobre eventos críticos
CREATE OR REPLACE FUNCTION public.notify_critical_security_event()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.severity = 'critical' THEN
    -- Inserir notificação para todos os admins
    INSERT INTO public.security_events (event_type, severity, details)
    VALUES ('critical_alert', 'critical', jsonb_build_object(
      'original_event_id', NEW.id,
      'event_type', NEW.event_type,
      'timestamp', NEW.timestamp
    ));
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS notify_on_critical_event ON public.security_events;
CREATE TRIGGER notify_on_critical_event
  AFTER INSERT ON public.security_events
  FOR EACH ROW
  WHEN (NEW.severity = 'critical')
  EXECUTE FUNCTION public.notify_critical_security_event();