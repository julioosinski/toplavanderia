import { registerPlugin } from '@capacitor/core';

export interface PayGOPlugin {
  initialize(options: {
    host: string;
    port: number;
    automationKey: string;
  }): Promise<{ success: boolean; message: string }>;

  checkStatus(): Promise<{ connected: boolean; status: string }>;

  processPayment(options: {
    paymentType: 'credit' | 'debit' | 'pix';
    amount: number;
    orderId: string;
  }): Promise<{
    success: boolean;
    paymentType: string;
    amount: number;
    orderId: string;
    transactionId?: string;
    timestamp?: number;
    message: string;
    status: 'approved' | 'denied' | 'pending';
  }>;

  cancelTransaction(): Promise<{ success: boolean; message: string }>;

  detectPinpad(): Promise<{
    detected: boolean;
    deviceName: string;
    vendorId?: number;
    productId?: number;
    deviceId?: number;
    serialNumber?: string;
    error?: string;
  }>;

  getSystemStatus(): Promise<{
    initialized: boolean;
    host?: string;
    port?: number;
    clientConnected: boolean;
    libraryVersion?: string;
    usbDeviceDetected: boolean;
    deviceInfo?: {
      vendorId: number;
      productId: number;
      deviceName: string;
      serialNumber: string;
    };
    timestamp: number;
    error?: string;
  }>;

  testConnection(): Promise<{
    success: boolean;
    usbConnection: boolean;
    clientStatus: string;
    message: string;
    timestamp: number;
  }>;
}

const PayGO = registerPlugin<PayGOPlugin>('PayGO');

export default PayGO;