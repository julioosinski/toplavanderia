-- Limpar dados antigos: marcar como offline ESP32s sem heartbeat recente
UPDATE esp32_status 
SET is_online = false, 
    network_status = 'offline',
    updated_at = now()
WHERE last_heartbeat < NOW() - INTERVAL '5 minutes'
   OR last_heartbeat IS NULL;