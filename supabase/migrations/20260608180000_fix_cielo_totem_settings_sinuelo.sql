-- TOP LAVANDERIA SINUELO: corrige credenciais Cielo no totem (EC UUID errado + ambiente sandbox em terminal produção)

UPDATE public.system_settings
SET
  paygo_provedor = 'cielo',
  paygo_enabled = true,
  paygo_cnpj_cpf = COALESCE(NULLIF(btrim(paygo_cnpj_cpf), ''), '43652666000137'),
  cielo_environment = 'production',
  cielo_merchant_code = NULL,
  updated_at = now()
WHERE laundry_id = '8ace0bcb-83a9-4555-a712-63ef5f52e709'
  AND (
    cielo_merchant_code IS NULL
    OR cielo_merchant_code ~ '-'
    OR lower(coalesce(cielo_environment, '')) = 'sandbox'
    OR coalesce(paygo_provedor, '') <> 'cielo'
  );

GRANT EXECUTE ON FUNCTION public.get_totem_settings(uuid) TO anon, authenticated;
