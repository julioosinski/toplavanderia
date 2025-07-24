import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { App } from '@capacitor/app';
import { Device } from '@capacitor/device';

interface DeviceInfo {
  platform: string;
  isTablet: boolean;
  operatingSystem: string;
  osVersion: string;
  manufacturer: string;
  model: string;
}

export const useCapacitorIntegration = () => {
  const [isNative, setIsNative] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initializeCapacitor = async () => {
      try {
        // Check if running on native platform
        const native = Capacitor.isNativePlatform();
        setIsNative(native);

        if (native) {
          // Get device information
          const info = await Device.getInfo();
          const deviceInfo: DeviceInfo = {
            platform: info.platform,
            isTablet: info.platform === 'android' || info.platform === 'ios',
            operatingSystem: info.operatingSystem,
            osVersion: info.osVersion,
            manufacturer: info.manufacturer,
            model: info.model,
          };
          setDeviceInfo(deviceInfo);

          // Configure status bar for kiosk mode
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: '#000000' });
          
          // Hide status bar for full kiosk experience
          await StatusBar.hide();

          // Hide splash screen
          await SplashScreen.hide();

          // Prevent app from being backgrounded
          App.addListener('appStateChange', ({ isActive }) => {
            if (!isActive) {
              // Try to bring app back to foreground (Android)
              console.log('App going to background - kiosk mode should prevent this');
            }
          });

          // Handle back button (Android)
          App.addListener('backButton', () => {
            // Prevent back button in kiosk mode
            console.log('Back button pressed - blocked in kiosk mode');
          });

          console.log('Capacitor initialized for tablet kiosk mode', deviceInfo);
        }

        setIsReady(true);
      } catch (error) {
        console.error('Error initializing Capacitor:', error);
        setIsReady(true);
      }
    };

    initializeCapacitor();
  }, []);

  const enableKioskMode = async () => {
    if (!isNative) return;

    try {
      // Hide status bar
      await StatusBar.hide();
      
      // Set immersive mode styling
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      
      console.log('Kiosk mode enabled');
    } catch (error) {
      console.error('Error enabling kiosk mode:', error);
    }
  };

  const disableKioskMode = async () => {
    if (!isNative) return;

    try {
      // Show status bar
      await StatusBar.show();
      
      // Reset styling
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      
      console.log('Kiosk mode disabled');
    } catch (error) {
      console.error('Error disabling kiosk mode:', error);
    }
  };

  const exitApp = async () => {
    if (!isNative) return;

    try {
      await App.exitApp();
    } catch (error) {
      console.error('Error exiting app:', error);
    }
  };

  return {
    isNative,
    deviceInfo,
    isReady,
    enableKioskMode,
    disableKioskMode,
    exitApp,
  };
};