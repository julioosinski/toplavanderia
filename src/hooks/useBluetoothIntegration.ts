import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';

export interface BluetoothDevice {
  id: string;
  name: string;
  address: string;
  paired: boolean;
  connected: boolean;
}

export interface BluetoothTransaction {
  amount: number;
  type: 'credit' | 'debit' | 'pix';
  orderId?: string;
}

export interface BluetoothResponse {
  success: boolean;
  data?: any;
  error?: string;
  transactionId?: string;
}

// Simulação de Bluetooth para desenvolvimento
const BluetoothSerialSimulator = {
  isEnabled: async () => ({ enabled: true }),
  enable: async () => ({ enabled: true }),
  scan: async () => ({
    devices: [
      { id: '1', name: 'Positivo L4', address: '00:11:22:33:44:55' },
      { id: '2', name: 'Maquininha Bluetooth', address: '00:11:22:33:44:66' }
    ]
  }),
  list: async () => ({
    devices: [
      { id: '1', name: 'Positivo L4', address: '00:11:22:33:44:55' }
    ]
  }),
  connect: async ({ address }: { address: string }) => ({ connected: true }),
  disconnect: async () => ({ disconnected: true }),
  write: async ({ data }: { data: string }) => ({ written: true }),
  read: async () => ({ data: JSON.stringify({ success: true, transactionId: 'BT_' + Date.now() }) })
};

export const useBluetoothIntegration = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<BluetoothDevice | null>(null);
  const [availableDevices, setAvailableDevices] = useState<BluetoothDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
    checkBluetoothEnabled();
  }, []);

  const checkBluetoothEnabled = useCallback(async (): Promise<boolean> => {
    try {
      const result = await BluetoothSerialSimulator.isEnabled();
      setIsEnabled(result.enabled);
      return result.enabled;
    } catch (error) {
      console.error('Erro ao verificar Bluetooth:', error);
      setIsEnabled(false);
      return false;
    }
  }, []);

  const enableBluetooth = useCallback(async (): Promise<boolean> => {
    try {
      await BluetoothSerialSimulator.enable();
      setIsEnabled(true);
      return true;
    } catch (error) {
      console.error('Erro ao habilitar Bluetooth:', error);
      return false;
    }
  }, []);

  const scanDevices = useCallback(async (): Promise<BluetoothDevice[]> => {
    setIsScanning(true);
    try {
      const devices = await BluetoothSerialSimulator.scan();
      const formattedDevices: BluetoothDevice[] = devices.devices.map(device => ({
        id: device.id,
        name: device.name || 'Dispositivo Desconhecido',
        address: device.address,
        paired: false,
        connected: false
      }));
      
      setAvailableDevices(formattedDevices);
      return formattedDevices;
    } catch (error) {
      console.error('Erro ao escanear dispositivos:', error);
      return [];
    } finally {
      setIsScanning(false);
    }
  }, []);

  const getPairedDevices = useCallback(async (): Promise<BluetoothDevice[]> => {
    try {
      const devices = await BluetoothSerialSimulator.list();
      const pairedDevices: BluetoothDevice[] = devices.devices.map(device => ({
        id: device.id,
        name: device.name || 'Dispositivo Pareado',
        address: device.address,
        paired: true,
        connected: false
      }));
      
      return pairedDevices;
    } catch (error) {
      console.error('Erro ao listar dispositivos pareados:', error);
      return [];
    }
  }, []);

  const connectToDevice = useCallback(async (deviceAddress: string): Promise<boolean> => {
    try {
      await BluetoothSerialSimulator.connect({ address: deviceAddress });
      setIsConnected(true);
      
      const device = availableDevices.find(d => d.address === deviceAddress);
      if (device) {
        setConnectedDevice({ ...device, connected: true });
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao conectar ao dispositivo:', error);
      setIsConnected(false);
      return false;
    }
  }, [availableDevices]);

  const disconnect = useCallback(async (): Promise<boolean> => {
    try {
      await BluetoothSerialSimulator.disconnect();
      setIsConnected(false);
      setConnectedDevice(null);
      return true;
    } catch (error) {
      console.error('Erro ao desconectar:', error);
      return false;
    }
  }, []);

  const sendData = useCallback(async (data: string): Promise<string> => {
    if (!isConnected) {
      throw new Error('Bluetooth não conectado');
    }
    
    try {
      await BluetoothSerialSimulator.write({ data });
      
      // Aguardar resposta
      const response = await BluetoothSerialSimulator.read();
      return response.data;
    } catch (error) {
      console.error('Erro ao enviar dados:', error);
      throw error;
    }
  }, [isConnected]);

  const processPayment = useCallback(async (transaction: BluetoothTransaction): Promise<BluetoothResponse> => {
    if (!isConnected || !connectedDevice) {
      return {
        success: false,
        error: 'Nenhum dispositivo conectado'
      };
    }

    try {
      // Formato genérico de comando para maquininhas
      const command = JSON.stringify({
        action: 'payment',
        amount: transaction.amount,
        type: transaction.type,
        orderId: transaction.orderId || Date.now().toString()
      });

      const response = await sendData(command);
      const parsedResponse = JSON.parse(response);

      return {
        success: parsedResponse.success || false,
        data: parsedResponse,
        transactionId: parsedResponse.transactionId
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }, [isConnected, connectedDevice, sendData]);

  return {
    // Estado
    isNative,
    isEnabled,
    isConnected,
    connectedDevice,
    availableDevices,
    isScanning,
    
    // Funções
    checkBluetoothEnabled,
    enableBluetooth,
    scanDevices,
    getPairedDevices,
    connectToDevice,
    disconnect,
    sendData,
    processPayment
  };
};