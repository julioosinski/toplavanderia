-- Insert some ESP32 status data for monitoring
INSERT INTO esp32_status (esp32_id, ip_address, is_online, uptime_seconds, machine_count, location, firmware_version, network_status, signal_strength) 
VALUES 
('main', '192.168.1.101', true, 86400, 2, 'Conjunto 01', 'v1.2.3', 'connected', -45),
('secondary', '192.168.1.102', true, 72000, 2, 'Conjunto 02', 'v1.2.3', 'connected', -52),
('Cj03', '192.168.1.103', false, 0, 2, 'Conjunto 03', 'v1.2.2', 'disconnected', -90),
('Cj04', '192.168.1.104', true, 43200, 2, 'Conjunto 04', 'v1.2.3', 'connected', -48),
('Cj05', '192.168.1.105', true, 36000, 2, 'Conjunto 05', 'v1.2.3', 'connected', -51)
ON CONFLICT (esp32_id) DO UPDATE SET
  ip_address = EXCLUDED.ip_address,
  is_online = EXCLUDED.is_online,
  uptime_seconds = EXCLUDED.uptime_seconds,
  machine_count = EXCLUDED.machine_count,
  location = EXCLUDED.location,
  firmware_version = EXCLUDED.firmware_version,
  network_status = EXCLUDED.network_status,
  signal_strength = EXCLUDED.signal_strength,
  last_heartbeat = now(),
  updated_at = now();

-- Insert additional machines for a complete laundry system
INSERT INTO machines (name, type, capacity_kg, price_per_kg, cycle_time_minutes, status, esp32_id, relay_pin, location)
VALUES 
('Lavadora 02', 'washing', 10, 18.00, 35, 'available', 'secondary', 1, 'top lavanderia'),
('Lavadora 03', 'washing', 10, 18.00, 35, 'maintenance', 'Cj03', 1, 'top lavanderia'),
('Lavadora 04', 'washing', 10, 18.00, 35, 'available', 'Cj04', 1, 'top lavanderia'),
('Lavadora 05', 'washing', 10, 18.00, 35, 'available', 'Cj05', 1, 'top lavanderia'),
('Secadora 03', 'drying', 10, 18.00, 45, 'offline', 'Cj03', 2, 'top lavanderia')
ON CONFLICT (name) DO UPDATE SET
  type = EXCLUDED.type,
  capacity_kg = EXCLUDED.capacity_kg,
  price_per_kg = EXCLUDED.price_per_kg,
  cycle_time_minutes = EXCLUDED.cycle_time_minutes,
  status = EXCLUDED.status,
  esp32_id = EXCLUDED.esp32_id,
  relay_pin = EXCLUDED.relay_pin,
  location = EXCLUDED.location,
  updated_at = now();