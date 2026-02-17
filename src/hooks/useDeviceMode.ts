import { useState, useEffect, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';

export type DeviceMode = 'totem' | 'smartpos' | 'pwa';

const SMARTPOS_MAX_WIDTH = 800;

export interface DeviceModeResult {
  mode: DeviceMode;
  screenSize: { width: number; height: number };
  isSmallScreen: boolean;
  isNative: boolean;
  isPWA: boolean;
  canProcessPayments: boolean;
}

export const useDeviceMode = (): DeviceModeResult => {
  const [screenSize, setScreenSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setScreenSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isNative = Capacitor.isNativePlatform();
  const isPWA = !isNative;
  const isSmallScreen = screenSize.width < SMARTPOS_MAX_WIDTH;

  const mode: DeviceMode = useMemo(() => {
    if (!isNative) return 'pwa';
    return isSmallScreen ? 'smartpos' : 'totem';
  }, [isNative, isSmallScreen]);

  return {
    mode,
    screenSize,
    isSmallScreen,
    isNative,
    isPWA,
    canProcessPayments: isNative,
  };
};
