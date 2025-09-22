import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';

export interface USBDevice {
  vendorId: number;
  productId: number;
  deviceName: string;
  serialNumber?: string;
  isConnected: boolean;
  deviceType: 'pinpad' | 'unknown';
}

export interface USBConnectionState {
  isSupported: boolean;
  devices: USBDevice[];
  isScanning: boolean;
  lastError: string | null;
}

const KNOWN_PINPAD_DEVICES = [
  { vendorId: 1155, productId: 22336, name: 'Positivo L4' },
  { vendorId: 1027, productId: 24577, name: 'Generic TEF' },
  { vendorId: 1105, productId: 32768, name: 'POS Terminal' },
];

export const useUSBConnection = () => {
  const [state, setState] = useState<USBConnectionState>({
    isSupported: false,
    devices: [],
    isScanning: false,
    lastError: null
  });

  const identifyDevice = useCallback((vendorId: number, productId: number): { name: string; type: 'pinpad' | 'unknown' } => {
    const known = KNOWN_PINPAD_DEVICES.find(
      device => device.vendorId === vendorId && device.productId === productId
    );
    
    if (known) {
      return { name: known.name, type: 'pinpad' };
    }
    
    return { name: `Unknown Device (${vendorId}:${productId})`, type: 'unknown' };
  }, []);

  const scanForDevices = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      setState(prev => ({ ...prev, lastError: 'USB not supported on web platform' }));
      return;
    }

    setState(prev => ({ ...prev, isScanning: true, lastError: null }));

    try {
      // On native Android, we would use a USB plugin
      // For now, we simulate the detection based on common scenarios
      const mockDevices: USBDevice[] = [];
      
      // Check if we're on Android and can access USB
      if (Capacitor.getPlatform() === 'android') {
        // This is where we would integrate with a USB plugin
        // For now, return empty array but set as supported
        setState(prev => ({
          ...prev,
          isSupported: true,
          devices: mockDevices,
          isScanning: false
        }));
      } else {
        setState(prev => ({
          ...prev,
          isSupported: false,
          devices: [],
          isScanning: false,
          lastError: 'USB only supported on Android'
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isScanning: false,
        lastError: error instanceof Error ? error.message : 'Unknown USB error'
      }));
    }
  }, [identifyDevice]);

  const connectToDevice = useCallback(async (device: USBDevice): Promise<boolean> => {
    if (!device || !state.isSupported) {
      return false;
    }

    try {
      // This is where we would implement actual USB connection logic
      // For now, simulate success for pinpad devices
      if (device.deviceType === 'pinpad') {
        setState(prev => ({
          ...prev,
          devices: prev.devices.map(d => 
            d.vendorId === device.vendorId && d.productId === device.productId
              ? { ...d, isConnected: true }
              : d
          )
        }));
        return true;
      }
      
      return false;
    } catch (error) {
      setState(prev => ({
        ...prev,
        lastError: error instanceof Error ? error.message : 'Connection failed'
      }));
      return false;
    }
  }, [state.isSupported]);

  const disconnectFromDevice = useCallback((device: USBDevice) => {
    setState(prev => ({
      ...prev,
      devices: prev.devices.map(d => 
        d.vendorId === device.vendorId && d.productId === device.productId
          ? { ...d, isConnected: false }
          : d
      )
    }));
  }, []);

  const getConnectedPinpads = useCallback(() => {
    return state.devices.filter(device => 
      device.deviceType === 'pinpad' && device.isConnected
    );
  }, [state.devices]);

  useEffect(() => {
    // Initialize USB support check
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      setState(prev => ({ ...prev, isSupported: true }));
      scanForDevices();
    }
  }, [scanForDevices]);

  return {
    ...state,
    scanForDevices,
    connectToDevice,
    disconnectFromDevice,
    getConnectedPinpads,
    refresh: scanForDevices
  };
};