-- Adicionar campo logo_url na tabela laundries
ALTER TABLE public.laundries 
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Criar bucket de storage para logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('laundry-logos', 'laundry-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Deletar políticas antigas se existirem
DROP POLICY IF EXISTS "Logos são públicos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem fazer upload de logos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar logos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar logos" ON storage.objects;

-- Políticas de storage para logos
CREATE POLICY "Logos são públicos"
ON storage.objects FOR SELECT
USING (bucket_id = 'laundry-logos');

CREATE POLICY "Usuários autenticados podem fazer upload de logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'laundry-logos' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Usuários autenticados podem atualizar logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'laundry-logos' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Usuários autenticados podem deletar logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'laundry-logos' AND
  auth.role() = 'authenticated'
);