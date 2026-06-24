-- EC Cielo do terminal DX8000 (merchantID dos pagamentos aprovados: 0010000234570003).
-- Necessário para o Order Manager fechar pedidos entre checkouts (evita erro -4281).

UPDATE public.system_settings
SET
  cielo_merchant_code = '0010000234570003',
  updated_at = now()
WHERE laundry_id = '8ace0bcb-83a9-4555-a712-63ef5f52e709'
  AND (
    cielo_merchant_code IS NULL
    OR btrim(cielo_merchant_code) = ''
    OR cielo_merchant_code ~ '-'
  );
