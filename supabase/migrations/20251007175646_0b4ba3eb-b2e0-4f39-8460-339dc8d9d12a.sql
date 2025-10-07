-- Tabela para comandos pendentes de ESP32 (retry queue)
CREATE TABLE IF NOT EXISTS public.pending_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  esp32_id TEXT NOT NULL,
  relay_pin INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('on', 'off')),
  machine_id UUID NOT NULL REFERENCES public.machines(id),
  transaction_id UUID REFERENCES public.transactions(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pending_commands_status ON public.pending_commands(status);
CREATE INDEX IF NOT EXISTS idx_pending_commands_esp32_id ON public.pending_commands(esp32_id);
CREATE INDEX IF NOT EXISTS idx_pending_commands_created_at ON public.pending_commands(created_at);

-- RLS policies
ALTER TABLE public.pending_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view pending commands"
  ON public.pending_commands
  FOR SELECT
  USING (
    is_super_admin(auth.uid()) OR 
    has_role(auth.uid(), 'admin')
  );

CREATE POLICY "System can manage pending commands"
  ON public.pending_commands
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_pending_commands_updated_at
  BEFORE UPDATE ON public.pending_commands
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários
COMMENT ON TABLE public.pending_commands IS 'Fila de comandos pendentes para ESP32s offline';
COMMENT ON COLUMN public.pending_commands.retry_count IS 'Número de tentativas de reenvio';
COMMENT ON COLUMN public.pending_commands.status IS 'pending=aguardando, processing=enviando, completed=sucesso, failed=falhou após retries';