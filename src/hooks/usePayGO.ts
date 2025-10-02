import { useState, useEffect, useCallback } from 'react';
import PayGO, { PayGOStatus, PayGOResult, PaymentOptions, PinpadDetection, PayGOEvent } from '../plugins/paygo';

export interface UsePayGOReturn {
  status: PayGOStatus;
  isProcessing: boolean;
  isInitialized: boolean;
  error: string | null;
  
  // Métodos
  initialize: () => Promise<boolean>;
  checkStatus: () => Promise<void>;
  processPayment: (options: PaymentOptions) => Promise<PayGOResult>;
  cancelPayment: () => Promise<boolean>;
  testPayGo: () => Promise<boolean>;
  detectPinpad: () => Promise<PinpadDetection>;
  
  // Eventos
  onPaymentSuccess?: (result: PayGOResult) => void;
  onPaymentError?: (error: string) => void;
  onPaymentProcessing?: (message: string) => void;
}

export const usePayGO = (): UsePayGOReturn => {
  const [status, setStatus] = useState<PayGOStatus>({
    initialized: false,
    processing: false,
    connected: false,
    status: 'not_initialized'
  });
  
  const [error, setError] = useState<string | null>(null);
  
  // Verificar se está processando
  const isProcessing = status.processing;
  const isInitialized = status.initialized;
  
  // Inicializar PayGo
  const initialize = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      const result = await PayGO.initialize();
      
      if (result.success) {
        setStatus(prev => ({
          ...prev,
          initialized: true,
          status: 'ready'
        }));
        return true;
      } else {
        setError(result.message);
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      return false;
    }
  }, []);
  
  // Verificar status
  const checkStatus = useCallback(async (): Promise<void> => {
    try {
      const currentStatus = await PayGO.checkStatus();
      setStatus(currentStatus);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao verificar status';
      setError(errorMessage);
    }
  }, []);
  
  // Processar pagamento
  const processPayment = useCallback(async (options: PaymentOptions): Promise<PayGOResult> => {
    try {
      setError(null);
      setStatus(prev => ({ ...prev, processing: true, status: 'processing' }));
      
      const result = await PayGO.processPayment(options);
      
      if (!result.success) {
        setError(result.message);
        setStatus(prev => ({ ...prev, processing: false, status: 'ready' }));
      }
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro no pagamento';
      setError(errorMessage);
      setStatus(prev => ({ ...prev, processing: false, status: 'error' }));
      
      return {
        success: false,
        message: errorMessage,
        error: errorMessage
      };
    }
  }, []);
  
  // Cancelar pagamento
  const cancelPayment = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      const result = await PayGO.cancelPayment();
      
      setStatus(prev => ({ ...prev, processing: false, status: 'ready' }));
      return result.success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao cancelar';
      setError(errorMessage);
      return false;
    }
  }, []);
  
  // Testar PayGo
  const testPayGo = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      const result = await PayGO.testPayGo();
      return result.success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro no teste';
      setError(errorMessage);
      return false;
    }
  }, []);
  
  // Detectar pinpad
  const detectPinpad = useCallback(async (): Promise<PinpadDetection> => {
    try {
      setError(null);
      return await PayGO.detectPinpad();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro na detecção';
      setError(errorMessage);
      
      return {
        detected: false,
        message: errorMessage
      };
    }
  }, []);
  
  // Configurar listeners de eventos
  useEffect(() => {
    let paymentSuccessListener: { remove: () => void } | null = null;
    let paymentErrorListener: { remove: () => void } | null = null;
    let paymentProcessingListener: { remove: () => void } | null = null;
    
    const setupListeners = async () => {
      try {
        // Listener para sucesso
        paymentSuccessListener = await PayGO.addListener('paymentSuccess', (event: PayGOEvent) => {
          setStatus(prev => ({ ...prev, processing: false, status: 'ready' }));
          setError(null);
        });
        
        // Listener para erro
        paymentErrorListener = await PayGO.addListener('paymentError', (event: PayGOEvent) => {
          setStatus(prev => ({ ...prev, processing: false, status: 'error' }));
          setError(event.message);
        });
        
        // Listener para processamento
        paymentProcessingListener = await PayGO.addListener('paymentProcessing', (event: PayGOEvent) => {
          // Manter status de processamento
        });
        
      } catch (err) {
        console.error('Erro ao configurar listeners PayGo:', err);
      }
    };
    
    setupListeners();
    
    // Cleanup
    return () => {
      paymentSuccessListener?.remove();
      paymentErrorListener?.remove();
      paymentProcessingListener?.remove();
    };
  }, []);
  
  // Verificar status inicial
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);
  
  return {
    status,
    isProcessing,
    isInitialized,
    error,
    initialize,
    checkStatus,
    processPayment,
    cancelPayment,
    testPayGo,
    detectPinpad
  };
};

