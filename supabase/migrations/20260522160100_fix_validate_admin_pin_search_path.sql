-- pgcrypto (crypt/gen_salt) fica em extensions no Supabase; search_path só public quebrava a RPC.

CREATE OR REPLACE FUNCTION public.validate_admin_pin(_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  stored_hash text;
  normalized_pin text;
BEGIN
  normalized_pin := btrim(_pin);
  IF normalized_pin IS NULL OR normalized_pin = '' THEN
    RETURN false;
  END IF;

  SELECT pin_hash
  INTO stored_hash
  FROM public.admin_config
  ORDER BY last_updated DESC NULLS LAST, id DESC
  LIMIT 1;

  IF stored_hash IS NULL OR stored_hash = '' THEN
    RETURN false;
  END IF;

  RETURN stored_hash = crypt(normalized_pin, stored_hash);
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_admin_pin(text) TO anon, authenticated;
