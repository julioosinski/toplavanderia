-- Permite que o totem (anônimo) consulte heartbeats dos ESP32 para mostrar status online/offline.
-- A função usa SECURITY DEFINER então os dados acessados são controlados pela query interna.
GRANT EXECUTE ON FUNCTION public.get_esp32_heartbeats(uuid) TO anon, authenticated;
