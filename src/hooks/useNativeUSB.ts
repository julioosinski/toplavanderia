import { useState, useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import USB from '@/plugins/usb';
import { toast } from 'sonner';

export interface NativeUSBDevice {
  vendorId: number;
  productId: number;
  deviceName: string;
  serialNumber?: string;
  manufacturer?: string;
  connected: boolean;
}

export const useNativeUSB = () => {
  const [devices, setDevices] = useState<NativeUSBDevice[]>([]);
  const [pinpads, setPinpads] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  const scanDevices = useCallback(async () => {
    if (!isNative) {
      toast.error('USB disponível apenas em Android');
      return;
    }

    setIsScanning(true);

    try {
      const result = await USB.listDevices();
      setDevices(result.devices.map(d => ({ ...d, connected: false })));
      setIsScanning(false);
    } catch (error) {
      console.error('Erro ao escanear dispositivos USB:', error);
      setIsScanning(false);
      toast.error('Erro ao escanear dispositivos USB');
    }
  }, [isNative]);

  const detectPinpads = useCallback(async () => {
    if (!isNative) return;

    try {
      const result = await USB.detectPinpads();
      setPinpads(result.pinpads);
      
      if (result.pinpads.length > 0) {
        toast.success(`${result.pinpads.length} pinpad(s) detectado(s)`);
      } else {
        toast.warning('Nenhum pinpad detectado');
      }
    } catch (error) {
      console.error('Erro ao detectar pinpads:', error);
      toast.error('Erro ao detectar pinpads');
    }
  }, [isNative]);

  const requestPermission = useCallback(async (
    vendorId: number,
    productId: number
  ): Promise<boolean> => {
    if (!isNative) return false;

    try {
      const result = await USB.requestPermission({ vendorId, productId });
      
      if (result.granted) {
        toast.success('Permissão USB concedida');
      } else {
        toast.error('Permissão USB negada');
      }
      
      return result.granted;
    } catch (error) {
      console.error('Erro ao solicitar permissão USB:', error);
      toast.error('Erro ao solicitar permissão USB');
      return false;
    }
  }, [isNative]);

  const hasPermission = useCallback(async (
    vendorId: number,
    productId: number
  ): Promise<boolean> => {
    if (!isNative) return false;

    try {
      const result = await USB.hasPermission({ vendorId, productId });
      return result.granted;
    } catch (error) {
      return false;
    }
  }, [isNative]);

  const openDevice = useCallback(async (
    vendorId: number,
    productId: number
  ): Promise<boolean> => {
    if (!isNative) return false;

    try {
      const result = await USB.openDevice({ vendorId, productId });
      
      if (result.success) {
        toast.success('Dispositivo USB conectado');
        // Atualizar lista de dispositivos
        await scanDevices();
      } else {
        toast.error(`Falha ao conectar: ${result.message}`);
      }
      
      return result.success;
    } catch (error) {
      console.error('Erro ao abrir dispositivo USB:', error);
      toast.error('Erro ao conectar dispositivo USB');
      return false;
    }
  }, [isNative, scanDevices]);

  const closeDevice = useCallback(async (
    vendorId: number,
    productId: number
  ): Promise<boolean> => {
    if (!isNative) return false;

    try {
      const result = await USB.closeDevice({ vendorId, productId });
      
      if (result.success) {
        toast.success('Dispositivo USB desconectado');
        await scanDevices();
      }
      
      return result.success;
    } catch (error) {
      console.error('Erro ao fechar dispositivo USB:', error);
      return false;
    }
  }, [isNative, scanDevices]);

  // Auto-scan on mount (only on native)
  useEffect(() => {
    if (isNative) {
      scanDevices();
      detectPinpads();
    }
  }, [isNative, scanDevices, detectPinpads]);

  return {
    isNative,
    devices,
    pinpads,
    isScanning,
    scanDevices,
    detectPinpads,
    requestPermission,
    hasPermission,
    openDevice,
    closeDevice
  };
};
