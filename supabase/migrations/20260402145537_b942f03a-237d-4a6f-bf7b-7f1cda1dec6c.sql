-- Drop the existing FK and recreate with CASCADE
ALTER TABLE public.pending_commands
  DROP CONSTRAINT IF EXISTS pending_commands_machine_id_fkey;

ALTER TABLE public.pending_commands
  ADD CONSTRAINT pending_commands_machine_id_fkey
  FOREIGN KEY (machine_id) REFERENCES public.machines(id)
  ON DELETE CASCADE;

-- Clean up old stale pending commands (older than 24 hours)
DELETE FROM public.pending_commands
WHERE status = 'pending' AND created_at < now() - interval '24 hours';