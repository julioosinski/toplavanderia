
-- =============================================
-- SECURITY FIX 1: Remove public read on laundries
-- Totem needs laundry lookup by CNPJ — use security definer function
-- =============================================
DROP POLICY IF EXISTS "Allow public read access" ON public.laundries;

-- Totem needs to find laundry by CNPJ (unauthenticated)
CREATE OR REPLACE FUNCTION public.get_laundry_by_cnpj(_cnpj text)
RETURNS TABLE(id uuid, name text, cnpj text, logo_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, cnpj, logo_url
  FROM public.laundries
  WHERE cnpj = _cnpj AND is_active = true
  LIMIT 1;
$$;

-- =============================================
-- SECURITY FIX 2: Remove unrestricted user_credits policies
-- =============================================
DROP POLICY IF EXISTS "APK can insert user credits" ON public.user_credits;
DROP POLICY IF EXISTS "APK can read user credits" ON public.user_credits;

-- =============================================
-- SECURITY FIX 3: Tighten esp32_status INSERT/UPDATE to laundry scope
-- =============================================
DROP POLICY IF EXISTS "Authenticated can update esp32_status" ON public.esp32_status;
DROP POLICY IF EXISTS "Authenticated can insert esp32_status" ON public.esp32_status;

CREATE POLICY "Admins can update esp32_status"
ON public.esp32_status
FOR UPDATE
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR laundry_id = get_user_laundry_id(auth.uid())
);

CREATE POLICY "Admins can insert esp32_status"
ON public.esp32_status
FOR INSERT
TO authenticated
WITH CHECK (
  is_super_admin(auth.uid())
  OR laundry_id = get_user_laundry_id(auth.uid())
);

-- =============================================
-- SECURITY FIX 4: Fix mutable search_path on validate_machine_config
-- =============================================
CREATE OR REPLACE FUNCTION public.validate_machine_config()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.machines 
    WHERE esp32_id = NEW.esp32_id 
      AND relay_pin = NEW.relay_pin 
      AND laundry_id = NEW.laundry_id
      AND id != NEW.id
  ) THEN
    RAISE EXCEPTION 'Já existe uma máquina usando ESP32 % com relay % nesta lavanderia', 
      NEW.esp32_id, NEW.relay_pin;
  END IF;
  RETURN NEW;
END;
$function$;
