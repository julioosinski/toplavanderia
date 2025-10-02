import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Capacitor } from '@capacitor/core';
import PayGO from '../plugins/paygo';

export interface PayGOConfig {
  host: string;
  port: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  automationKey: string;
  cnpjCpf: string;
}

export interface PayGOTransaction {
  amount: number;
  installments?: number;
  paymentType?: 'CREDIT' | 'DEBIT' | 'PIX';
  orderId?: string;
  pixData?: {
    qrCode?: string;
    qrCodeBase64?: string;
    pixKey?: string;
    expiresIn?: number;
  };
}

export interface PayGOResponse {
  success: boolean;
  resultCode: number;
  resultMessage: string;
  receiptCustomer?: string;
  receiptMerchant?: string;
  transactionId?: string;
  authorizationCode?: string;
  nsu?: string;
  errorMessage?: string;
  // Pix-specific fields
  qrCode?: string;
  qrCodeBase64?: string;
  pixKey?: string;
  expiresIn?: number;
}

export interface PayGOStatus {
  online: boolean;
  version?: string;
  lastCheck: Date;
  consecutiveFailures: number;
  initialized: boolean;
}

export const usePayGOIntegration = (config: PayGOConfig) => {
  const [status, setStatus] = useState<PayGOStatus>({
    online: false,
    lastCheck: new Date(),
    consecutiveFailures: 0,
    initialized: false,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const checkPayGOStatus = useCallback(async (): Promise<boolean> => {
    try {
      // Use native plugin on mobile, fallback to HTTP on web
      if (Capacitor.isNativePlatform()) {
        const result = await PayGO.checkStatus();
        const isOnline = result.connected;
        
        setStatus(prev => ({
          ...prev,
          online: isOnline,
          lastCheck: new Date(),
          consecutiveFailures: isOnline ? 0 : prev.consecutiveFailures + 1,
        }));
        
        return isOnline;
      } else {
        // Fallback to HTTP for web platform
        const response = await fetch(`http://${config.host}:${config.port}/status`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Automation-Key': config.automationKey,
          },
          signal: AbortSignal.timeout(config.timeout),
        });

        const isOnline = response.ok;
        setStatus(prev => ({
          ...prev,
          online: isOnline,
          lastCheck: new Date(),
          consecutiveFailures: isOnline ? 0 : prev.consecutiveFailures + 1,
        }));

        return isOnline;
      }
    } catch (error) {
      console.error('PayGO status check failed:', error);
      setStatus(prev => ({
        ...prev,
        online: false,
        lastCheck: new Date(),
        consecutiveFailures: prev.consecutiveFailures + 1,
      }));
      return false;
    }
  }, [config]);

  const initializePayGO = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`http://${config.host}:${config.port}/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Automation-Key': config.automationKey,
        },
        body: JSON.stringify({
          cnpjCpf: config.cnpjCpf,
        }),
        signal: AbortSignal.timeout(config.timeout),
      });

      const result = await response.json();
      
      if (result.success) {
        setStatus(prev => ({
          ...prev,
          initialized: true,
          version: result.version,
          consecutiveFailures: 0,
        }));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('PayGO initialization failed:', error);
      return false;
    }
  }, [config]);

  const processPayGOPayment = useCallback(async (
    transaction: PayGOTransaction
  ): Promise<PayGOResponse> => {
    setIsProcessing(true);

    try {
      // Use native plugin on mobile, fallback to HTTP on web
      if (Capacitor.isNativePlatform()) {
        const result = await PayGO.processPayment({
          paymentType: (transaction.paymentType?.toLowerCase() || 'credit') as 'credit' | 'debit' | 'pix',
          amount: transaction.amount,
          orderId: transaction.orderId || Date.now().toString(),
        });
        
        setIsProcessing(false);
        
        if (result.success) {
          toast({
            title: "Pagamento aprovado",
            description: `Transação processada com sucesso. ID: ${result.transactionId}`,
          });
        } else {
          toast({
            title: "Pagamento negado",
            description: result.message || "Falha no processamento",
            variant: "destructive",
          });
        }

        return {
          success: result.success,
          resultCode: result.success ? 0 : -1,
          resultMessage: result.message,
          transactionId: result.transactionId,
          nsu: result.transactionId, // Use transactionId as NSU for now
          errorMessage: result.success ? undefined : result.message,
        };
      } else {
        // Fallback to HTTP for web platform
        let retryCount = 0;
        
        while (retryCount <= config.retryAttempts) {
          try {
            const response = await fetch(`http://${config.host}:${config.port}/transaction`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Automation-Key': config.automationKey,
              },
              body: JSON.stringify({
                amount: Math.round(transaction.amount * 100), // Convert to cents
                installments: transaction.installments || 1,
                paymentType: transaction.paymentType || 'CREDIT',
                orderId: transaction.orderId || Date.now().toString(),
              }),
              signal: AbortSignal.timeout(config.timeout),
            });

            const result = await response.json();
            
            setIsProcessing(false);
            
            if (result.success) {
              toast({
                title: "Pagamento aprovado",
                description: `Transação processada com sucesso. NSU: ${result.nsu}`,
              });
            } else {
              toast({
                title: "Pagamento negado",
                description: result.resultMessage || "Falha no processamento",
                variant: "destructive",
              });
            }

            return result;
          } catch (error) {
            retryCount++;
            
            if (retryCount <= config.retryAttempts) {
              await new Promise(resolve => setTimeout(resolve, config.retryDelay));
              continue;
            }
            
            throw error;
          }
        }
        
        throw new Error('Maximum retry attempts reached');
      }
    } catch (error) {
      setIsProcessing(false);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      toast({
        title: "Erro no pagamento",
        description: errorMessage,
        variant: "destructive",
      });

      return {
        success: false,
        resultCode: -1,
        resultMessage: errorMessage,
        errorMessage,
      };
    }
  }, [config, toast]);

  const cancelTransaction = useCallback(async (transactionId?: string): Promise<boolean> => {
    try {
      // Use native plugin on mobile, fallback to HTTP on web
      if (Capacitor.isNativePlatform()) {
        const result = await PayGO.cancelTransaction(transactionId || '');
        setIsProcessing(false);
        return result.success;
      } else {
        // Fallback to HTTP for web platform
        const response = await fetch(`http://${config.host}:${config.port}/cancel`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Automation-Key': config.automationKey,
          },
          signal: AbortSignal.timeout(config.timeout),
        });

        const result = await response.json();
        setIsProcessing(false);
        
        return result.success;
      }
    } catch (error) {
      console.error('PayGO cancel failed:', error);
      setIsProcessing(false);
      return false;
    }
  }, [config]);

  const testConnection = useCallback(async (): Promise<boolean> => {
    try {
      // Use native plugin on mobile, fallback to HTTP on web
      if (Capacitor.isNativePlatform()) {
        const result = await PayGO.checkStatus();
        return result.connected;
      } else {
        // Fallback to HTTP for web platform
        const response = await fetch(`http://${config.host}:${config.port}/ping`, {
          method: 'GET',
          headers: {
            'X-Automation-Key': config.automationKey,
          },
          signal: AbortSignal.timeout(config.timeout),
        });

        return response.ok;
      }
    } catch (error) {
      console.error('PayGO connection test failed:', error);
      return false;
    }
  }, [config]);

  const detectPinpad = useCallback(async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await PayGO.detectPinpad();
        return result;
      } else {
        // Web fallback - cannot detect USB devices
        return {
          detected: false,
          deviceName: "USB detection only available on mobile",
          error: "Web platform cannot access USB devices directly"
        };
      }
    } catch (error) {
      console.error('Pinpad detection failed:', error);
      return {
        detected: false,
        deviceName: "Detection failed",
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }, []);

  const processPixPayment = useCallback(async (
    transaction: PayGOTransaction
  ): Promise<PayGOResponse> => {
    setIsProcessing(true);

    try {
      const response = await fetch(`http://${config.host}:${config.port}/pix/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Automation-Key': config.automationKey,
        },
        body: JSON.stringify({
          amount: Math.round(transaction.amount * 100), // Convert to cents
          orderId: transaction.orderId || Date.now().toString(),
          expiresIn: 300, // 5 minutes
        }),
        signal: AbortSignal.timeout(config.timeout),
      });

      const result = await response.json();
      
      if (result.success) {
        return {
          success: true,
          resultCode: 0,
          resultMessage: "QR Code Pix gerado com sucesso",
          transactionId: result.transactionId,
          qrCode: result.qrCode,
          qrCodeBase64: result.qrCodeBase64,
          pixKey: result.pixKey,
          expiresIn: result.expiresIn,
        };
      } else {
        setIsProcessing(false);
        return {
          success: false,
          resultCode: -1,
          resultMessage: result.message || "Falha ao gerar QR Code Pix",
          errorMessage: result.message,
        };
      }
    } catch (error) {
      setIsProcessing(false);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      return {
        success: false,
        resultCode: -1,
        resultMessage: errorMessage,
        errorMessage,
      };
    }
  }, [config]);

  const checkPixPaymentStatus = useCallback(async (orderId: string): Promise<PayGOResponse> => {
    try {
      const response = await fetch(`http://${config.host}:${config.port}/pix/status/${orderId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Automation-Key': config.automationKey,
        },
        signal: AbortSignal.timeout(config.timeout),
      });

      const result = await response.json();
      
      return {
        success: result.status === 'paid',
        resultCode: result.status === 'paid' ? 0 : 1,
        resultMessage: result.message || `Status: ${result.status}`,
        transactionId: result.transactionId,
        nsu: result.nsu,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      return {
        success: false,
        resultCode: -1,
        resultMessage: errorMessage,
        errorMessage,
      };
    }
  }, [config]);

  return {
    status,
    isProcessing,
    checkPayGOStatus,
    initializePayGO,
    processPayGOPayment,
    processPixPayment,
    checkPixPaymentStatus,
    cancelTransaction,
    testConnection,
    detectPinpad,
  };
};