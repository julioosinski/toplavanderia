import { registerPlugin } from '@capacitor/core';

export interface USBDevice {
  vendorId: number;
  productId: number;
  deviceName: string;
  serialNumber?: string;
  manufacturer?: string;
  deviceClass: number;
  deviceSubclass: number;
}

export interface USBPlugin {
  /**
   * Solicita permissão para acessar dispositivo USB
   */
  requestPermission(options: {
    vendorId: number;
    productId: number;
  }): Promise<{ granted: boolean }>;

  /**
   * Lista dispositivos USB conectados
   */
  listDevices(): Promise<{
    devices: USBDevice[];
  }>;

  /**
   * Verifica se tem permissão para dispositivo
   */
  hasPermission(options: {
    vendorId: number;
    productId: number;
  }): Promise<{ granted: boolean }>;

  /**
   * Abre conexão com dispositivo USB
   */
  openDevice(options: {
    vendorId: number;
    productId: number;
  }): Promise<{
    success: boolean;
    message: string;
  }>;

  /**
   * Fecha conexão com dispositivo
   */
  closeDevice(options: {
    vendorId: number;
    productId: number;
  }): Promise<{
    success: boolean;
  }>;

  /**
   * Detecta pinpads conhecidos (Positivo L4, PPC930, etc)
   */
  detectPinpads(): Promise<{
    pinpads: Array<{
      vendorId: number;
      productId: number;
      name: string;
      connected: boolean;
    }>;
  }>;
}

const USB = registerPlugin<USBPlugin>('USB', {
  web: () => import('./usb.web').then(m => new m.USBWeb()),
});

export default USB;
