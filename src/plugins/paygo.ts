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
}

const PayGO = registerPlugin<PayGOPlugin>('PayGO');

export default PayGO;