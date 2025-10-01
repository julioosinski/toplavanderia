import { useState, useEffect, useCallback } from 'react';
import PayGO from '@/plugins/paygo';
import { toast } from 'sonner';

export interface RealPayGOConfig {
  host: string;
  port: number;
  automationKey: string;
  timeout: number;
  retryAttempts?: number;
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

export interface PayGOTransaction {
  paymentType: 'credit' | 'debit' | 'pix';
  amount: number;
  orderId: string;
}

export interface PayGOPaymentResult {
  success: boolean;
  paymentType: string;
  amount: number;
  orderId: string;
  transactionId?: string;
  timestamp?: number;
  message: string;
  resultMessage?: string;
  status: 'approved' | 'denied' | 'pending' | 'error';
  nsu?: string;
  authorizationCode?: string;
}

export const useRealPayGOIntegration = (config: RealPayGOConfig) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [systemStatus, setSystemStatus] = useState<PayGOSystemStatus | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Initialize PayGO
  const initialize = useCallback(async (): Promise<boolean> => {
    try {
      setLastError(null);
      
      const result = await PayGO.initialize({
        host: config.host,
        port: config.port,
        automationKey: config.automationKey
      });

      if (result.success) {
        setIsInitialized(true);
        toast.success('PayGO initialized successfully');
        
        // Get initial system status
        await getSystemStatus();
        return true;
      } else {
        setLastError(result.message);
        toast.error(`PayGO initialization failed: ${result.message}`);
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLastError(errorMessage);
      toast.error(`PayGO initialization error: ${errorMessage}`);
      return false;
    }
  }, [config]);

  // Check connection status
  const checkStatus = useCallback(async (): Promise<boolean> => {
    try {
      const result = await PayGO.checkStatus();
      setIsConnected(result.connected);
      return result.connected;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLastError(errorMessage);
      setIsConnected(false);
      return false;
    }
  }, []);

  // Get detailed system status
  const getSystemStatus = useCallback(async (): Promise<PayGOSystemStatus | null> => {
    try {
      const status = await PayGO.getSystemStatus();
      const enhancedStatus = {
        ...status,
        online: status.clientConnected && status.usbDeviceDetected
      };
      setSystemStatus(enhancedStatus);
      setIsConnected(enhancedStatus.online);
      return enhancedStatus;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLastError(errorMessage);
      return null;
    }
  }, []);

  // Test PayGO connection
  const testConnection = useCallback(async (): Promise<boolean> => {
    try {
      const result = await PayGO.testConnection();
      setIsConnected(result.success);
      
      if (result.success) {
        toast.success('PayGO connection test successful');
      } else {
        toast.error(`Connection test failed: ${result.message}`);
      }
      
      return result.success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLastError(errorMessage);
      toast.error(`Connection test error: ${errorMessage}`);
      return false;
    }
  }, []);

  // Process payment
  const processPayment = useCallback(async (transaction: PayGOTransaction): Promise<PayGOPaymentResult> => {
    if (!isInitialized) {
      throw new Error('PayGO not initialized');
    }

    if (!isConnected) {
      throw new Error('PayGO not connected');
    }

    setIsProcessing(true);
    setLastError(null);

    try {
      const result = await PayGO.processPayment({
        paymentType: transaction.paymentType,
        amount: transaction.amount,
        orderId: transaction.orderId
      });

      if (result.success && result.status === 'approved') {
        toast.success(`Payment approved: R$ ${result.amount.toFixed(2)}`);
      } else {
        toast.error(`Payment failed: ${result.message}`);
      }

      return {
        ...result,
        status: result.status as 'approved' | 'denied' | 'pending' | 'error'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLastError(errorMessage);
      toast.error(`Payment error: ${errorMessage}`);
      
      return {
        success: false,
        paymentType: transaction.paymentType,
        amount: transaction.amount,
        orderId: transaction.orderId,
        message: errorMessage,
        status: 'error'
      };
    } finally {
      setIsProcessing(false);
    }
  }, [isInitialized, isConnected]);

  // Cancel transaction
  const cancelTransaction = useCallback(async (): Promise<boolean> => {
    try {
      const result = await PayGO.cancelTransaction();
      
      if (result.success) {
        toast.success('Transaction cancelled');
      } else {
        toast.error(`Failed to cancel: ${result.message}`);
      }
      
      return result.success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLastError(errorMessage);
      toast.error(`Cancel error: ${errorMessage}`);
      return false;
    }
  }, []);

  // Detect pinpad device
  const detectPinpad = useCallback(async () => {
    try {
      const result = await PayGO.detectPinpad();
      
      if (result.detected) {
        toast.success(`PPC930 detected: ${result.deviceName}`);
      } else {
        toast.warning('PPC930 device not detected');
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLastError(errorMessage);
      toast.error(`Detection error: ${errorMessage}`);
      return {
        detected: false,
        deviceName: 'Error',
        error: errorMessage
      };
    }
  }, []);

  // Auto-initialize on mount
  useEffect(() => {
    if (config.host && config.port && config.automationKey) {
      initialize();
    }
  }, [initialize, config.host, config.port, config.automationKey]);

  // Periodic status check
  useEffect(() => {
    if (!isInitialized) return;

    const interval = setInterval(() => {
      checkStatus();
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [isInitialized, checkStatus]);

  return {
    // State
    isInitialized,
    isConnected,
    isProcessing,
    systemStatus,
    lastError,
    
    // Actions
    initialize,
    checkStatus,
    getSystemStatus,
    testConnection,
    processPayment,
    cancelTransaction,
    detectPinpad
  };
};

// Default config for convenience
export const DEFAULT_REAL_PAYGO_CONFIG: RealPayGOConfig = {
  host: '192.168.1.100',
  port: 9999,
  automationKey: '',
  timeout: 30000,
  retryAttempts: 3
};