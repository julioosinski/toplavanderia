CREATE INDEX IF NOT EXISTS idx_admin_config_updated_by
  ON public.admin_config (updated_by);

CREATE INDEX IF NOT EXISTS idx_laundries_owner_id
  ON public.laundries (owner_id);

CREATE INDEX IF NOT EXISTS idx_pending_commands_machine_id
  ON public.pending_commands (machine_id);

CREATE INDEX IF NOT EXISTS idx_pending_commands_transaction_id
  ON public.pending_commands (transaction_id);

CREATE INDEX IF NOT EXISTS idx_security_events_resolved_by
  ON public.security_events (resolved_by);

CREATE INDEX IF NOT EXISTS idx_security_events_user_id
  ON public.security_events (user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_machine_id
  ON public.transactions (machine_id);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id
  ON public.transactions (user_id);

CREATE INDEX IF NOT EXISTS idx_user_credits_transaction_id
  ON public.user_credits (transaction_id);

CREATE INDEX IF NOT EXISTS idx_user_credits_user_id
  ON public.user_credits (user_id);
