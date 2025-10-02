import { registerPlugin } from '@capacitor/core';

export interface PayGOPlugin {
  /**
   * Inicializar PayGo
   */
  initialize(): Promise<PayGOResult>;
  
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
   * Testar PayGo
   */
  testPayGo(): Promise<PayGOResult>;
  
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
}

export interface PayGOStatus {
  initialized: boolean;
  processing: boolean;
  status: 'ready' | 'not_initialized' | 'processing' | 'error';
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