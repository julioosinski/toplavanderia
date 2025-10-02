import { registerPlugin } from '@capacitor/core';

export interface PayGOPlugin {
  /**
   * Inicializar PayGo com configurações
   */
  initialize(config?: { host: string; port: number; automationKey: string }): Promise<PayGOResult>;
  
  /**
   * Verificar status do PayGo
   */
  checkStatus(): Promise<PayGOStatus>;
  
  /**
   * Processar pagamento
   */
  processPayment(options: PaymentOptions): Promise<PayGOResult>;
  
  /**
   * Cancelar pagamento
   */
  cancelPayment(): Promise<PayGOResult>;
  
  /**
   * Cancelar transação específica
   */
  cancelTransaction(transactionId: string): Promise<PayGOResult>;
  
  /**
   * Testar PayGo
   */
  testPayGo(): Promise<PayGOResult>;
  
  /**
   * Obter status do sistema
   */
  getSystemStatus(): Promise<PayGOSystemStatus>;
  
  /**
   * Testar conexão
   */
  testConnection(): Promise<PayGOResult>;
  
  /**
   * Detectar pinpad PPC930
   */
  detectPinpad(): Promise<PinpadDetection>;
  
  /**
   * Adicionar listener para eventos de pagamento
   */
  addListener(eventName: 'paymentSuccess' | 'paymentError' | 'paymentProcessing', listenerFunc: (event: PayGOEvent) => void): Promise<{ remove: () => void }>;
}

export interface PayGOResult {
  success: boolean;
  message: string;
  authorizationCode?: string;
  transactionId?: string;
  orderId?: string;
  error?: string;
  status?: 'approved' | 'denied' | 'pending' | 'error';
  amount?: number;
  paymentType?: string;
}

export interface PayGOStatus {
  initialized: boolean;
  processing: boolean;
  connected: boolean;
  online?: boolean;
  status: 'ready' | 'not_initialized' | 'processing' | 'error';
}

export interface PayGOSystemStatus {
  initialized: boolean;
  online: boolean;
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
}

export interface PaymentOptions {
  amount: number;
  description?: string;
  orderId?: string;
  paymentType?: 'credit' | 'debit' | 'pix';
}

export interface PinpadDetection {
  detected: boolean;
  deviceName?: string;
  vendorId?: string;
  productId?: string;
  message: string;
}

export interface PayGOEvent {
  success?: boolean;
  authorizationCode?: string;
  transactionId?: string;
  error?: string;
  message: string;
  processing?: boolean;
}

const PayGO = registerPlugin<PayGOPlugin>('PayGO');

export default PayGO;