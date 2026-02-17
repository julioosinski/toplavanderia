import { useState, useEffect, useCallback } from 'react';
import { useRealPayGOIntegration, RealPayGOConfig } from './useRealPayGOIntegration';
import { useTEFIntegration } from './useTEFIntegration';
import { usePixPayment } from './usePixPayment';
import { useToast } from './use-toast';

export type PaymentMethod = 'paygo' | 'tef' | 'pix' | 'manual';
export type PaymentType = 'credit' | 'debit' | 'pix';

export interface UniversalTransaction {
  amount: number;
  type: PaymentType;
  orderId?: string;
  machineId?: string;
}

export interface PaymentMethodStatus {
  method: PaymentMethod;
  available: boolean;
  connected: boolean;
  priority: number;
  lastTest?: Date;
  error?: string;
}

export interface UniversalPaymentResponse {
  success: boolean;
  method: PaymentMethod;
  data?: any;
  error?: string;
  transactionId?: string;
  // PIX-specific
  qrCode?: string;
  qrCodeBase64?: string;
  pixKey?: string;
  expiresIn?: number;
}

export interface UniversalPaymentConfig {
  paygo: RealPayGOConfig;
  tef: {
    host: string;
    port: string;
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
  };
}

export const useUniversalPayment = (config: UniversalPaymentConfig) => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentMethod, setCurrentMethod] = useState<PaymentMethod | null>(null);
  const [methodsStatus, setMethodsStatus] = useState<PaymentMethodStatus[]>([
    { method: 'paygo', available: false, connected: false, priority: 1 },
    { method: 'tef', available: false, connected: false, priority: 2 },
    { method: 'pix', available: false, connected: false, priority: 3 },
    { method: 'manual', available: true, connected: true, priority: 4 }
  ]);

  // Real integrations
  const paygoIntegration = useRealPayGOIntegration(config.paygo);
  const tefIntegration = useTEFIntegration(config.tef);
  const pixIntegration = usePixPayment({
    host: config.paygo.host,
    port: config.paygo.port,
    automationKey: config.paygo.automationKey,
    timeout: config.paygo.timeout,
  });

  // Test all payment methods
  const testAllMethods = useCallback(async () => {
    const newStatus: PaymentMethodStatus[] = [...methodsStatus];

    // Test PayGO
    try {
      const paygoAvailable = await paygoIntegration.testConnection();
      const idx = newStatus.findIndex(s => s.method === 'paygo');
      if (idx >= 0) {
        newStatus[idx] = {
          ...newStatus[idx],
          available: paygoAvailable,
          connected: paygoAvailable,
          lastTest: new Date(),
          error: paygoAvailable ? undefined : 'Conexão PayGO falhou'
        };
      }
    } catch (error) {
      const idx = newStatus.findIndex(s => s.method === 'paygo');
      if (idx >= 0) {
        newStatus[idx] = {
          ...newStatus[idx],
          available: false,
          connected: false,
          lastTest: new Date(),
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        };
      }
    }

    // Test TEF
    try {
      const tefAvailable = await tefIntegration.testConnection();
      const idx = newStatus.findIndex(s => s.method === 'tef');
      if (idx >= 0) {
        newStatus[idx] = {
          ...newStatus[idx],
          available: tefAvailable,
          connected: tefAvailable,
          lastTest: new Date(),
          error: tefAvailable ? undefined : 'Conexão TEF falhou'
        };
      }
    } catch (error) {
      const idx = newStatus.findIndex(s => s.method === 'tef');
      if (idx >= 0) {
        newStatus[idx] = {
          ...newStatus[idx],
          available: false,
          connected: false,
          lastTest: new Date(),
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        };
      }
    }

    // PIX availability mirrors PayGO (same infrastructure)
    const paygoStatus = newStatus.find(s => s.method === 'paygo');
    const pixIdx = newStatus.findIndex(s => s.method === 'pix');
    if (pixIdx >= 0 && paygoStatus) {
      newStatus[pixIdx] = {
        ...newStatus[pixIdx],
        available: paygoStatus.available,
        connected: paygoStatus.connected,
        lastTest: new Date(),
        error: paygoStatus.available ? undefined : 'PIX depende do PayGO'
      };
    }

    setMethodsStatus(newStatus);
  }, [paygoIntegration, tefIntegration, methodsStatus]);

  // Find best available method
  const getBestAvailableMethod = useCallback((): PaymentMethod | null => {
    const available = methodsStatus
      .filter(s => s.available && s.connected)
      .sort((a, b) => a.priority - b.priority);
    return available.length > 0 ? available[0].method : null;
  }, [methodsStatus]);

  // Process payment with automatic fallback
  const processPayment = useCallback(async (
    transaction: UniversalTransaction,
    preferredMethod?: PaymentMethod
  ): Promise<UniversalPaymentResponse> => {
    setIsProcessing(true);

    try {
      const methodToUse = preferredMethod &&
        methodsStatus.find(s => s.method === preferredMethod && s.available)
        ? preferredMethod
        : getBestAvailableMethod();

      if (!methodToUse) {
        return {
          success: false,
          method: 'manual',
          error: 'Nenhum método de pagamento disponível'
        };
      }

      setCurrentMethod(methodToUse);

      switch (methodToUse) {
        case 'paygo': {
          const result = await paygoIntegration.processPayment({
            paymentType: transaction.type as 'credit' | 'debit' | 'pix',
            amount: transaction.amount,
            orderId: transaction.orderId || Date.now().toString()
          });

          return {
            success: result.success,
            method: 'paygo',
            data: result,
            transactionId: result.transactionId
          };
        }

        case 'tef': {
          const tefResult = await tefIntegration.processTEFPayment({
            transacao: 'venda',
            valor: (transaction.amount * 100).toString(),
            cupomFiscal: transaction.orderId || Date.now().toString(),
            dataHora: new Date().toISOString().slice(0, 19).replace('T', ' '),
            estabelecimento: 'Top Lavanderia',
            terminal: '001'
          });

          return {
            success: tefResult?.retorno === '0',
            method: 'tef',
            data: tefResult,
            transactionId: tefResult?.nsu
          };
        }

        case 'pix': {
          const pixResult = await pixIntegration.generatePixQR({
            amount: transaction.amount,
            orderId: transaction.orderId || Date.now().toString()
          });

          return {
            success: pixResult.success,
            method: 'pix',
            data: pixResult,
            transactionId: pixResult.transactionId,
            qrCode: pixResult.qrCode,
            qrCodeBase64: pixResult.qrCodeBase64,
            pixKey: pixResult.pixKey,
            expiresIn: pixResult.expiresIn,
          };
        }

        default:
          return {
            success: false,
            method: 'manual',
            error: 'Método de pagamento não suportado'
          };
      }
    } catch (error) {
      toast({
        title: "Erro no Pagamento",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });

      return {
        success: false,
        method: currentMethod || 'manual',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    } finally {
      setIsProcessing(false);
      setCurrentMethod(null);
    }
  }, [methodsStatus, getBestAvailableMethod, paygoIntegration, tefIntegration, pixIntegration, currentMethod, toast]);

  // Periodic status check
  useEffect(() => {
    testAllMethods();
    const interval = setInterval(testAllMethods, 30000);
    return () => clearInterval(interval);
  }, [testAllMethods]);

  return {
    isProcessing,
    currentMethod,
    methodsStatus,
    processPayment,
    testAllMethods,
    getBestAvailableMethod,
    // Expose sub-integrations for direct access (e.g., PIX polling)
    pixIntegration,
    paygoIntegration,
    tefIntegration
  };
};
