-- "Parar ciclo", "Colocar em manutenção" e "Sair da manutenção" para dono, gerente e operador.
-- A RLS de machines só permite UPDATE a super_admin/admin: para gerente/operador o UPDATE do
-- painel não gravava nada (sem erro) e dependia do confirm do ESP32. Esta RPC valida o papel
-- na lavanderia da máquina e grava status + relé OFF espelhado + OFF forçado no hardware.

CREATE OR REPLACE FUNCTION public.admin_set_machine_status(_machine_id uuid, _status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _machine RECORD;
  _relay integer;
  _cmd_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF _status IS NULL OR _status NOT IN ('available', 'maintenance') THEN
    RAISE EXCEPTION 'Status inválido: %', COALESCE(_status, 'null');
  END IF;

  SELECT m.id, m.laundry_id, m.esp32_id, m.relay_pin, m.status
  INTO _machine
  FROM public.machines m
  WHERE m.id = _machine_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Máquina não encontrada';
  END IF;

  IF NOT (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'manager', 'operator')
        AND ur.laundry_id = _machine.laundry_id
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para alterar esta máquina';
  END IF;

  -- auth.uid() continua definido (SECURITY DEFINER mantém o JWT), então o trigger
  -- protect_machine_maintenance_status aceita a saída de manutenção.
  UPDATE public.machines
  SET status = _status, updated_at = now()
  WHERE id = _machine.id;

  IF _machine.esp32_id IS NOT NULL AND length(trim(_machine.esp32_id)) > 0 THEN
    _relay := COALESCE(_machine.relay_pin, 1);

    UPDATE public.esp32_status s
    SET relay_status = s.relay_status || jsonb_build_object('relay_' || _relay, 'off')
    WHERE s.esp32_id = _machine.esp32_id
      AND s.laundry_id = _machine.laundry_id
      AND jsonb_typeof(s.relay_status) = 'object';

    INSERT INTO public.pending_commands (esp32_id, relay_pin, action, machine_id, status, payload)
    VALUES (
      _machine.esp32_id, _relay, 'off', _machine.id, 'pending',
      jsonb_build_object('force', true, 'remote_stop', true, 'admin_stop', true, 'target_status', _status)
    )
    RETURNING id INTO _cmd_id;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_values, new_values)
  VALUES (
    auth.uid(),
    CASE WHEN _status = 'maintenance' THEN 'MACHINE_MAINTENANCE_ON' ELSE 'MACHINE_SET_AVAILABLE' END,
    'machines',
    _machine.id,
    jsonb_build_object('status', _machine.status),
    jsonb_build_object('status', _status, 'machine_id', _machine.id, 'command_id', _cmd_id)
  );

  RETURN jsonb_build_object('machine_id', _machine.id, 'status', _status, 'command_id', _cmd_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_machine_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_machine_status(uuid, text) TO authenticated, service_role;
