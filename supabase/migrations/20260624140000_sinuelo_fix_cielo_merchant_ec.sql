-- EC Cielo correto do terminal DX8000 Sinuelo (16 dígitos).
-- Valor 3001024102 no painel não é EC válido para Order Manager.

UPDATE public.system_settings
SET
  cielo_merchant_code = '0010000234570003',
  updated_at = now()
WHERE laundry_id = '8ace0bcb-83a9-4555-a712-63ef5f52e709'
  AND (
    cielo_merchant_code IS NULL
    OR btrim(cielo_merchant_code) = ''
    OR length(btrim(cielo_merchant_code)) < 14
    OR cielo_merchant_code ~ '-'
  );
