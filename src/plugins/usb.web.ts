import { WebPlugin } from '@capacitor/core';
import type { USBPlugin } from './usb';

export class USBWeb extends WebPlugin implements USBPlugin {
  async requestPermission(): Promise<{ granted: boolean }> {
    console.warn('USB not supported on web platform');
    return { granted: false };
  }

  async listDevices(): Promise<{ devices: any[] }> {
    return { devices: [] };
  }

  async hasPermission(): Promise<{ granted: boolean }> {
    return { granted: false };
  }

  async openDevice(): Promise<{ success: boolean; message: string }> {
    return {
      success: false,
      message: 'USB not supported on web',
    };
  }

  async closeDevice(): Promise<{ success: boolean }> {
    return { success: false };
  }

  async detectPinpads(): Promise<{ pinpads: any[] }> {
    return { pinpads: [] };
  }
}
