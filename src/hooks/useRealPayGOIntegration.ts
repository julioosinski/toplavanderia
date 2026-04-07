import { useState, useEffect, useCallback, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import PayGO from '@/plugins/paygo';
import { toast } from 'sonner';
import { handlePayGOError, formatCurrency, validatePayGOConfig } from '@/utils/paygoHelpers';

export interface RealPayGOConfig {
  host: string;
  port: number;
  automationKey: string;
  timeout: number;
  retryAttempts?: number;
  /** Payment provider: 'paygo' (default) or 'cielo' */
  provider?: string;
  /** Cielo LIO credentials (only needed when provider = 'cielo') */
  cieloClientId?: string;
  cieloAccessToken?: string;
  cieloMerchantCode?: string;
  cieloEnvironment?: string;
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
  const isCieloProvider = (config.provider || 'paygo').toLowerCase() === 'cielo';
  const hasCieloCredentials = Boolean(
    config.cieloClientId?.trim() && config.cieloAccessToken?.trim()
  );

  // Validate config on mount
  const isConfigValid = useMemo(() => {
    return validatePayGOConfig(config);
  }, [config]);

  // Check connection status
  const checkStatus = useCallback(async (): Promise<boolean> => {
    try {
      const result = await PayGO.checkStatus({ provider: (config.provider as 'paygo' | 'cielo') || 'paygo' });
      setIsConnected(result.connected);
      return result.connected;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      setLastError(errorMsg);
      setIsConnected(false);
      return false;
    }
  }, [config.provider]);

  // Get detailed system status
  const getSystemStatus = useCallback(async (): Promise<PayGOSystemStatus | null> => {
    try {
      const status = await PayGO.getSystemStatus({ provider: (config.provider as 'paygo' | 'cielo') || 'paygo' });
      // No nativo, usbDeviceDetected usa lista fixa de VIDs; pinpad ainda pode funcionar pelo PayGo Integrado.
      const enhancedStatus = {
        ...status,
        online: Capacitor.isNativePlatform()
          ? Boolean(status.initialized)
          : status.clientConnected && status.usbDeviceDetected,
      };
      setSystemStatus(enhancedStatus);
      setIsConnected(enhancedStatus.online);
      return enhancedStatus;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      setLastError(errorMsg);
      return null;
    }
  }, [config.provider]);

  // Initialize PayGO
  const initialize = useCallback(async (options?: { silent?: boolean }): Promise<boolean> => {
    if (!isConfigValid) return false;

    if (isCieloProvider && !hasCieloCredentials) {
      const msg = 'Credenciais Cielo pendentes (Client ID / Access Token)';
      setLastError(msg);
      // During startup, avoid noisy errors while settings are still loading.
      if (!options?.silent) {
        toast.error(msg);
      }
      return false;
    }

    try {
      setLastError(null);
      
      const result = await PayGO.initialize({
        host: config.host,
        port: config.port,
        automationKey: config.automationKey,
        provider: config.provider || 'paygo',
        cieloClientId: config.cieloClientId || '',
        cieloAccessToken: config.cieloAccessToken || '',
        cieloMerchantCode: config.cieloMerchantCode || '',
        cieloEnvironment: config.cieloEnvironment || 'sandbox',
      } as any);

      if (result.success) {
        setIsInitialized(true);
        if (!options?.silent) {
          toast.success(config.provider === 'cielo' ? 'Cielo inicializado com sucesso' : 'PayGO inicializado com sucesso');
        }
        await getSystemStatus();
        return true;
      } else {
        const errorMsg = result.message;
        setLastError(errorMsg);
        if (!options?.silent) {
          toast.error(config.provider === 'cielo' ? `Falha ao inicializar Cielo: ${errorMsg}` : `Falha ao inicializar PayGO: ${errorMsg}`);
        }
        return false;
      }
    } catch (error) {
      const errorMsg = handlePayGOError(error, config.provider === 'cielo' ? 'Erro ao inicializar Cielo' : 'Erro ao inicializar PayGO');
      setLastError(errorMsg);
      return false;
    }
  }, [config, isConfigValid, getSystemStatus, isCieloProvider, hasCieloCredentials]);

  // Test PayGO connection (silent: sem toast — uso em polling / teste automático)
  const testConnection = useCallback(async (options?: { silent?: boolean }): Promise<boolean> => {
    const silent = options?.silent === true;
    try {
      const result = await PayGO.testConnection({ provider: (config.provider as 'paygo' | 'cielo') || 'paygo' });
      setIsConnected(result.success);

      if (!silent) {
        if (result.success) {
          toast.success(config.provider === 'cielo' ? 'Teste de conexão Cielo bem-sucedido' : 'Teste de conexão PayGO bem-sucedido');
        } else {
          toast.error(`Falha no teste: ${result.message}`);
        }
      }

      return result.success;
    } catch (error) {
      if (!silent) {
        handlePayGOError(error, 'Erro no teste de conexão');
      }
      return false;
    }
  }, [config.provider]);

  // Process payment
  const processPayment = useCallback(async (transaction: PayGOTransaction): Promise<PayGOPaymentResult> => {
    let ready = isInitialized;
    if (!ready && isConfigValid) {
      ready = await initialize({ silent: true });
    }

    if (!ready) {
      throw new Error(
        'PayGO não está pronto. No tablet: instale o app PayGo Integrado, abra-o e conclua a configuração do estabelecimento.'
      );
    }

    const native = Capacitor.isNativePlatform();
    if (!isConnected && !native) {
      throw new Error(
        'PayGO sem conexão. Verifique se o PayGo Integrado está ativo e o pinpad USB está conectado.'
      );
    }

    setIsProcessing(true);
    setLastError(null);

    try {
      const result = await PayGO.processPayment({
        paymentType: transaction.paymentType,
        amount: transaction.amount,
        orderId: transaction.orderId,
        provider: config.provider || 'paygo',
      });

      const stRaw = result.status;
      const st = typeof stRaw === 'string' ? stRaw.toLowerCase() : '';
      const failed = result.success === false || st === 'denied' || st === 'error';
      const cardApproved =
        !failed && (st === 'approved' || (result.success === true && !st));

      if (cardApproved) {
        toast.success(`Pagamento aprovado: ${formatCurrency(result.amount || transaction.amount)}`);
      } else {
        toast.error(`Pagamento falhou: ${result.message || 'Negado'}`);
      }

      return {
        success: cardApproved,
        paymentType: result.paymentType || transaction.paymentType,
        amount: result.amount || transaction.amount,
        orderId: result.orderId || transaction.orderId,
        transactionId: result.transactionId,
        timestamp: Date.now(),
        message: result.message,
        status: (cardApproved ? 'approved' : st === 'denied' ? 'denied' : (result.status || 'error')) as
          | 'approved'
          | 'denied'
          | 'pending'
          | 'error',
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
  }, [isInitialized, isConnected, isConfigValid, initialize]);

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
      const result = await PayGO.detectPinpad({ provider: (config.provider as 'paygo' | 'cielo') || 'paygo' });
      
      if (result.detected) {
        toast.success(
          result.deviceName
            ? `Pinpad: ${result.deviceName}`
            : result.message || 'Pinpad / PayGO disponível'
        );
      } else {
        toast.warning(result.message || 'Pinpad não detectado — verifique PayGo Integrado e USB');
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
  }, [config.provider]);

  // Auto-initialize on mount
  useEffect(() => {
    if (isConfigValid) {
      void initialize({ silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfigValid, isCieloProvider, hasCieloCredentials]);

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