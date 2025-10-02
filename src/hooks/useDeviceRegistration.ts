import { useState, useEffect, useCallback } from 'react';
import { Device } from '@capacitor/device';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AuthorizedDevice {
  id: string;
  device_uuid: string;
  device_name: string;
  location: string | null;
  is_active: boolean;
  last_seen: string | null;
  created_at: string;
  updated_at: string;
}

export const useDeviceRegistration = () => {
  const [deviceInfo, setDeviceInfo] = useState<{
    uuid: string;
    name: string;
    model: string;
    platform: string;
  } | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [registeredDevice, setRegisteredDevice] = useState<AuthorizedDevice | null>(null);

  // Get device info
  const getDeviceInfo = useCallback(async () => {
    try {
      const info = await Device.getId();
      const deviceInfo = await Device.getInfo();

      const deviceData = {
        uuid: info.identifier,
        name: deviceInfo.name || `${deviceInfo.manufacturer} ${deviceInfo.model}`,
        model: deviceInfo.model,
        platform: deviceInfo.platform,
      };

      setDeviceInfo(deviceData);
      return deviceData;
    } catch (error) {
      console.error('Error getting device info:', error);
      toast.error('Erro ao obter informações do dispositivo');
      return null;
    }
  }, []);

  // Check if device is registered
  const checkRegistration = useCallback(async () => {
    try {
      const info = await getDeviceInfo();
      if (!info) return false;

      const { data, error } = await supabase
        .from('authorized_devices')
        .select('*')
        .eq('device_uuid', info.uuid)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking registration:', error);
        return false;
      }

      if (data) {
        setRegisteredDevice(data as AuthorizedDevice);
        setIsRegistered(true);
        
        // Update last_seen
        await supabase
          .from('authorized_devices')
          .update({ last_seen: new Date().toISOString() })
          .eq('id', data.id);

        return true;
      }

      setIsRegistered(false);
      return false;
    } catch (error) {
      console.error('Error checking registration:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [getDeviceInfo]);

  // Register new device (admin only)
  const registerDevice = useCallback(async (location?: string) => {
    try {
      const info = await getDeviceInfo();
      if (!info) return false;

      const { data, error } = await supabase
        .from('authorized_devices')
        .insert({
          device_uuid: info.uuid,
          device_name: info.name,
          location: location || null,
          is_active: true,
          last_seen: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error registering device:', error);
        toast.error('Erro ao registrar dispositivo');
        return false;
      }

      setRegisteredDevice(data as AuthorizedDevice);
      setIsRegistered(true);
      toast.success(`Dispositivo registrado: ${info.name}`);
      return true;
    } catch (error) {
      console.error('Error registering device:', error);
      toast.error('Erro ao registrar dispositivo');
      return false;
    }
  }, [getDeviceInfo]);

  // Update device location
  const updateLocation = useCallback(async (location: string) => {
    if (!registeredDevice) return false;

    try {
      const { error } = await supabase
        .from('authorized_devices')
        .update({ location })
        .eq('id', registeredDevice.id);

      if (error) {
        console.error('Error updating location:', error);
        toast.error('Erro ao atualizar localização');
        return false;
      }

      setRegisteredDevice({ ...registeredDevice, location });
      toast.success('Localização atualizada');
      return true;
    } catch (error) {
      console.error('Error updating location:', error);
      return false;
    }
  }, [registeredDevice]);

  // Deactivate device (admin only)
  const deactivateDevice = useCallback(async () => {
    if (!registeredDevice) return false;

    try {
      const { error } = await supabase
        .from('authorized_devices')
        .update({ is_active: false })
        .eq('id', registeredDevice.id);

      if (error) {
        console.error('Error deactivating device:', error);
        toast.error('Erro ao desativar dispositivo');
        return false;
      }

      setIsRegistered(false);
      toast.success('Dispositivo desativado');
      return true;
    } catch (error) {
      console.error('Error deactivating device:', error);
      return false;
    }
  }, [registeredDevice]);

  // Update last_seen heartbeat
  const heartbeat = useCallback(async () => {
    if (!registeredDevice) return;

    try {
      await supabase
        .from('authorized_devices')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', registeredDevice.id);
    } catch (error) {
      console.error('Error sending heartbeat:', error);
    }
  }, [registeredDevice]);

  // Initial check on mount
  useEffect(() => {
    checkRegistration();
  }, [checkRegistration]);

  // Send heartbeat every 5 minutes
  useEffect(() => {
    if (!isRegistered) return;

    const interval = setInterval(heartbeat, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isRegistered, heartbeat]);

  return {
    deviceInfo,
    isRegistered,
    isLoading,
    registeredDevice,
    checkRegistration,
    registerDevice,
    updateLocation,
    deactivateDevice,
    heartbeat,
  };
};
