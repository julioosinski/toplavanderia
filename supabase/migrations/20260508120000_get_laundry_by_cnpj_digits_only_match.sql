-- Totem e web enviam CNPJ só com dígitos; a coluna pode estar mascarada.
-- Compara pelo valor numérico (14 dígitos) em vez de igualdade de texto.
CREATE OR REPLACE FUNCTION public.get_laundry_by_cnpj(_cnpj text)
RETURNS TABLE(id uuid, name text, cnpj text, logo_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id, l.name, l.cnpj, l.logo_url
  FROM public.laundries l
  WHERE regexp_replace(l.cnpj, '[^0-9]', '', 'g') = regexp_replace(coalesce(_cnpj, ''), '[^0-9]', '', 'g')
    AND l.is_active = true
  LIMIT 1;
$$;
