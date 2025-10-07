-- Corrigir conflito de relay_pin: mover Secadora 01 para relay_pin 2
UPDATE public.machines 
SET relay_pin = 2 
WHERE id = '82b0063c-afe8-4483-b90f-4ef60f70315f' 
  AND name = 'Secadora 01';