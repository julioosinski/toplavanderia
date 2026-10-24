-- Sinal de vida do totem (APK >= 2.2.130): permite ao painel alertar quando o totem
-- fica sem comunicação (incidente 22/10/2026: ~15h sem vendas sem ninguém perceber).

CREATE TABLE IF NOT EXISTS public.totem_heartbeats (
  laundry_id uuid NOT NULL REFERENCES public.laundries(id) ON DELETE CASCADE,
  device_id text NOT NULL CHECK (length(device_id) BETWEEN 1 AND 64),
  app_version text,
  device_model text,
  -- Cache isOnline do APK no momento do envio (false = app se considera offline).
  network_online boolean,
  current_screen text,
  payment_in_progress boolean NOT NULL DEFAULT false,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (laundry_id, device_id)
);

ALTER TABLE public.totem_heartbeats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View totem heartbeats based on assigned laundry role" ON public.totem_heartbeats;
CREATE POLICY "View totem heartbeats based on assigned laundry role"
ON public.totem_heartbeats
FOR SELECT
TO authenticated
USING (
  public.is_super_admin((SELECT auth.uid()))
  OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role, laundry_id)
  OR public.has_role((SELECT auth.uid()), 'operator'::public.app_role, laundry_id)
);

-- Escrita só pela RPC abaixo (sem policies de INSERT/UPDATE/DELETE).
REVOKE ALL ON public.totem_heartbeats FROM anon;
GRANT SELECT ON public.totem_heartbeats TO authenticated;

-- ---------------------------------------------------------------------------
-- register_totem_heartbeat — chamada pelo APK (anon) a cada ~60 s.
-- Limita a 10 dispositivos por lavanderia para conter abuso da chave anon.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_totem_heartbeat(
  _laundry_id uuid,
  _device_id text,
  _app_version text DEFAULT NULL,
  _device_model text DEFAULT NULL,
  _network_online boolean DEFAULT NULL,
  _current_screen text DEFAULT NULL,
  _payment_in_progress boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _device text := left(btrim(coalesce(_device_id, '')), 64);
BEGIN
  IF _laundry_id IS NULL OR _device = '' OR _device !~ '^[A-Za-z0-9._:-]+$' THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.laundries l WHERE l.id = _laundry_id) THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.totem_heartbeats th
    WHERE th.laundry_id = _laundry_id AND th.device_id = _device
  ) AND (
    SELECT count(*) FROM public.totem_heartbeats th WHERE th.laundry_id = _laundry_id
  ) >= 10 THEN
    RETURN false;
  END IF;

  INSERT INTO public.totem_heartbeats AS th (
    laundry_id, device_id, app_version, device_model,
    network_online, current_screen, payment_in_progress, last_seen_at
  )
  VALUES (
    _laundry_id,
    _device,
    left(_app_version, 32),
    left(_device_model, 64),
    _network_online,
    left(_current_screen, 32),
    coalesce(_payment_in_progress, false),
    now()
  )
  ON CONFLICT (laundry_id, device_id) DO UPDATE
  SET
    app_version = EXCLUDED.app_version,
    device_model = EXCLUDED.device_model,
    network_online = EXCLUDED.network_online,
    current_screen = EXCLUDED.current_screen,
    payment_in_progress = EXCLUDED.payment_in_progress,
    last_seen_at = now();

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.register_totem_heartbeat(uuid, text, text, text, boolean, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_totem_heartbeat(uuid, text, text, text, boolean, text, boolean)
  TO anon, authenticated, service_role;
