-- First, let's safely insert ESP32 status data
-- Only insert if not exists to avoid conflicts
INSERT INTO esp32_status (esp32_id, ip_address, is_online, uptime_seconds, machine_count, location, firmware_version, network_status, signal_strength, last_heartbeat) 
SELECT 'main', '192.168.1.101', true, 86400, 2, 'Conjunto 01', 'v1.2.3', 'connected', -45, now()
WHERE NOT EXISTS (SELECT 1 FROM esp32_status WHERE esp32_id = 'main');

INSERT INTO esp32_status (esp32_id, ip_address, is_online, uptime_seconds, machine_count, location, firmware_version, network_status, signal_strength, last_heartbeat) 
SELECT 'secondary', '192.168.1.102', true, 72000, 2, 'Conjunto 02', 'v1.2.3', 'connected', -52, now()
WHERE NOT EXISTS (SELECT 1 FROM esp32_status WHERE esp32_id = 'secondary');

INSERT INTO esp32_status (esp32_id, ip_address, is_online, uptime_seconds, machine_count, location, firmware_version, network_status, signal_strength, last_heartbeat) 
SELECT 'Cj03', '192.168.1.103', false, 0, 2, 'Conjunto 03', 'v1.2.2', 'disconnected', -90, now()
WHERE NOT EXISTS (SELECT 1 FROM esp32_status WHERE esp32_id = 'Cj03');

INSERT INTO esp32_status (esp32_id, ip_address, is_online, uptime_seconds, machine_count, location, firmware_version, network_status, signal_strength, last_heartbeat) 
SELECT 'Cj04', '192.168.1.104', true, 43200, 2, 'Conjunto 04', 'v1.2.3', 'connected', -48, now()
WHERE NOT EXISTS (SELECT 1 FROM esp32_status WHERE esp32_id = 'Cj04');

INSERT INTO esp32_status (esp32_id, ip_address, is_online, uptime_seconds, machine_count, location, firmware_version, network_status, signal_strength, last_heartbeat) 
SELECT 'Cj05', '192.168.1.105', true, 36000, 2, 'Conjunto 05', 'v1.2.3', 'connected', -51, now()
WHERE NOT EXISTS (SELECT 1 FROM esp32_status WHERE esp32_id = 'Cj05');

-- Insert additional machines if they don't exist
INSERT INTO machines (name, type, capacity_kg, price_per_kg, cycle_time_minutes, status, esp32_id, relay_pin, location)
SELECT 'Lavadora 02', 'washing', 10, 18.00, 35, 'available', 'secondary', 1, 'top lavanderia'
WHERE NOT EXISTS (SELECT 1 FROM machines WHERE name = 'Lavadora 02');

INSERT INTO machines (name, type, capacity_kg, price_per_kg, cycle_time_minutes, status, esp32_id, relay_pin, location)
SELECT 'Lavadora 03', 'washing', 10, 18.00, 35, 'maintenance', 'Cj03', 1, 'top lavanderia'
WHERE NOT EXISTS (SELECT 1 FROM machines WHERE name = 'Lavadora 03');

INSERT INTO machines (name, type, capacity_kg, price_per_kg, cycle_time_minutes, status, esp32_id, relay_pin, location)
SELECT 'Lavadora 04', 'washing', 10, 18.00, 35, 'available', 'Cj04', 1, 'top lavanderia'
WHERE NOT EXISTS (SELECT 1 FROM machines WHERE name = 'Lavadora 04');

INSERT INTO machines (name, type, capacity_kg, price_per_kg, cycle_time_minutes, status, esp32_id, relay_pin, location)
SELECT 'Lavadora 05', 'washing', 10, 18.00, 35, 'available', 'Cj05', 1, 'top lavanderia'
WHERE NOT EXISTS (SELECT 1 FROM machines WHERE name = 'Lavadora 05');

INSERT INTO machines (name, type, capacity_kg, price_per_kg, cycle_time_minutes, status, esp32_id, relay_pin, location)
SELECT 'Secadora 03', 'drying', 10, 18.00, 45, 'offline', 'Cj03', 2, 'top lavanderia'
WHERE NOT EXISTS (SELECT 1 FROM machines WHERE name = 'Secadora 03');