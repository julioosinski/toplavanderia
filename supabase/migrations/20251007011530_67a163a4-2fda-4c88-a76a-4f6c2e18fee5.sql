-- Corrigir esp32_id das máquinas para usar o ID que existe no esp32_status
-- Atualizar máquinas que usam 'principal' ou 'cj02' para 'main'
UPDATE machines 
SET esp32_id = 'main' 
WHERE esp32_id IN ('principal', 'cj02') 
  AND laundry_id = '8ace0bcb-83a9-4555-a712-63ef5f52e709';

-- Comentário: Esta correção garante que as máquinas referenciem o ESP32 correto
-- que está registrado na tabela esp32_status com o id 'main'