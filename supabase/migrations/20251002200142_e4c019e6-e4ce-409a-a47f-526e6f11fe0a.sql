-- =====================================================
-- PARTE 1: Adicionar super_admin ao enum app_role
-- =====================================================

-- Adicionar super_admin ao enum app_role
DO $$ 
BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
END $$;