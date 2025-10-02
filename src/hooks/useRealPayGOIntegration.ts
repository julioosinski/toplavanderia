import { useState, useEffect, useCallback, useMemo } from 'react';
import PayGO from '@/plugins/paygo';
import { toast } from 'sonner';
import { handlePayGOError, formatCurrency, validatePayGOConfig } from '@/utils/paygoHelpers';

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
  const [systemStatus, setSystemStatus] = useState<PayGOSystemStatus>({
    initialized: false,
    online: false,
    clientConnected: false,
    usbDeviceDetected: false,
    timestamp: Date.now()
  });
  const [lastError, setLastError] = useState<string | null>(null);

  // Validate config on mount
  const isConfigValid = useMemo(() => {
    return validatePayGOConfig(config);
  }, [config]);

  // Initialize PayGO
  const initialize = useCallback(async (): Promise<boolean> => {
    if (!isConfigValid) return false;

    try {
      setLastError(null);
      
      const result = await PayGO.initialize({
        host: config.host,
        port: config.port,
        automationKey: config.automationKey
      });

      if (result.success) {
        setIsInitialized(true);
        toast.success('PayGO inicializado com sucesso');
        await getSystemStatus();
        return true;
      } else {
        const errorMsg = result.message;
        setLastError(errorMsg);
        toast.error(`Falha ao inicializar PayGO: ${errorMsg}`);
        return false;
      }
    } catch (error) {
      const errorMsg = handlePayGOError(error, 'Erro ao inicializar PayGO');
      setLastError(errorMsg);
      return false;
    }
  }, [config, isConfigValid]);

  // Check connection status
  const checkStatus = useCallback(async (): Promise<boolean> => {
    try {
      const result = await PayGO.checkStatus();
      setIsConnected(result.connected);
      return result.connected;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      setLastError(errorMsg);
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
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      setLastError(errorMsg);
      return null;
    }
  }, []);

  // Test PayGO connection
  const testConnection = useCallback(async (): Promise<boolean> => {
    try {
      const result = await PayGO.testConnection();
      setIsConnected(result.success);
      
      if (result.success) {
        toast.success('Teste de conexão PayGO bem-sucedido');
      } else {
        toast.error(`Falha no teste: ${result.message}`);
      }
      
      return result.success;
    } catch (error) {
      handlePayGOError(error, 'Erro no teste de conexão');
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
        toast.success(`Pagamento aprovado: ${formatCurrency(result.amount || transaction.amount)}`);
      } else {
        toast.error(`Pagamento falhou: ${result.message}`);
      }

      return {
        success: result.success,
        paymentType: result.paymentType || transaction.paymentType,
        amount: result.amount || transaction.amount,
        orderId: result.orderId || transaction.orderId,
        transactionId: result.transactionId,
        timestamp: Date.now(),
        message: result.message,
        status: (result.status || 'error') as 'approved' | 'denied' | 'pending' | 'error',
        nsu: result.authorizationCode,
        authorizationCode: result.authorizationCode
      };

    } catch (error) {
      const errorMsg = handlePayGOError(error, 'Erro no pagamento');
      
      return {
        success: false,
        paymentType: transaction.paymentType,
        amount: transaction.amount,
        orderId: transaction.orderId,
        message: errorMsg,
        status: 'error'
      };
    } finally {
      setIsProcessing(false);
    }
  }, [isInitialized, isConnected]);

  // Cancel transaction
  const cancelTransaction = useCallback(async (transactionId?: string): Promise<boolean> => {
    try {
      const result = await PayGO.cancelTransaction(transactionId || '');
      
      if (result.success) {
        toast.success('Transação cancelada');
      } else {
        toast.error(`Falha ao cancelar: ${result.message}`);
      }
      
      return result.success;
    } catch (error) {
      handlePayGOError(error, 'Erro ao cancelar');
      return false;
    }
  }, []);

  // Detect pinpad device
  const detectPinpad = useCallback(async () => {
    try {
      const result = await PayGO.detectPinpad();
      
      if (result.detected) {
        toast.success(`PPC930 detectado: ${result.deviceName}`);
      } else {
        toast.warning('Dispositivo PPC930 não detectado');
      }
      
      return result;
    } catch (error) {
      const errorMsg = handlePayGOError(error, 'Erro ao detectar pinpad');
      return {
        detected: false,
        deviceName: 'Error',
        error: errorMsg
      };
    }
  }, []);

  // Auto-initialize on mount
  useEffect(() => {
    if (isConfigValid) {
      initialize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfigValid]);

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