-- Seed Sinuelo: poltrona de massagem (totem exibe categoria MASSAGEM quando houver type=massage)

DO $$
DECLARE
  _laundry_id uuid := '8ace0bcb-83a9-4555-a712-63ef5f52e709';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.laundries WHERE id = _laundry_id) THEN
    RAISE NOTICE 'Lavanderia Sinuelo não encontrada; seed massagem ignorado';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.machines
    WHERE laundry_id = _laundry_id AND type = 'massage'
  ) THEN
    RAISE NOTICE 'Poltrona Sinuelo já cadastrada';
    RETURN;
  END IF;

  INSERT INTO public.machines (
    laundry_id,
    name,
    type,
    device_profile,
    status,
    price_per_cycle,
    cycle_time_minutes,
    capacity_kg,
    location,
    esp32_id,
    relay_pin,
    metadata
  )
  VALUES (
    _laundry_id,
    'Poltrona de Massagem',
    'massage',
    'timed_session',
    'available',
    15.00,
    15,
    0,
    'Recepção',
    NULL,
    NULL,
    '{"seed": "sinuelo_massage"}'::jsonb
  );

  RAISE NOTICE 'Poltrona de massagem Sinuelo cadastrada';
END $$;
