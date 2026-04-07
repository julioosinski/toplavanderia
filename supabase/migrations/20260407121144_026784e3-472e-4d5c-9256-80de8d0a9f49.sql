
UPDATE public.system_settings 
SET 
  tef_terminal_id = '109728',
  paygo_host = 'pos-transac-sb.tpgweb.io',
  paygo_port = 31735,
  paygo_cnpj_cpf = '43652666000137',
  paygo_automation_key = '314159',
  paygo_enabled = true,
  updated_at = now()
WHERE laundry_id IN (
  '8ace0bcb-83a9-4555-a712-63ef5f52e709',
  '567a7bb6-8d26-4d9c-bbe3-f8dcc28e7569'
);
