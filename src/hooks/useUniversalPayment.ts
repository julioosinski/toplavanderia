import { useState, useEffect, useCallback } from 'react';
import { usePayGOIntegration } from './usePayGOIntegration';
import { useTEFIntegration } from './useTEFIntegration';
import { useBluetoothIntegration } from './useBluetoothIntegration';
import { useToast } from './use-toast';

export type PaymentMethod = 'paygo' | 'tef' | 'bluetooth' | 'manual';
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
}

const DEFAULT_PAYGO_CONFIG = {
  host: 'localhost',
  port: 8080,
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 2000,
  automationKey: '',
  cnpjCpf: ''
};

const DEFAULT_TEF_CONFIG = {
  host: 'localhost',
  port: '8081',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 2000
};

export const useUniversalPayment = () => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentMethod, setCurrentMethod] = useState<PaymentMethod | null>(null);
  const [methodsStatus, setMethodsStatus] = useState<PaymentMethodStatus[]>([
    { method: 'paygo', available: false, connected: false, priority: 1 },
    { method: 'tef', available: false, connected: false, priority: 2 },
    { method: 'bluetooth', available: false, connected: false, priority: 3 },
    { method: 'manual', available: true, connected: true, priority: 4 }
  ]);

  // Hooks dos diferentes métodos
  const paygoIntegration = usePayGOIntegration(DEFAULT_PAYGO_CONFIG);
  const tefIntegration = useTEFIntegration(DEFAULT_TEF_CONFIG);
  const bluetoothIntegration = useBluetoothIntegration();

  // Função para testar conectividade de todos os métodos
  const testAllMethods = useCallback(async () => {
    const newStatus: PaymentMethodStatus[] = [...methodsStatus];

    // Testar PayGO
    try {
      const paygoAvailable = await paygoIntegration.testConnection();
      const paygoIndex = newStatus.findIndex(s => s.method === 'paygo');
      if (paygoIndex >= 0) {
        newStatus[paygoIndex] = {
          ...newStatus[paygoIndex],
          available: paygoAvailable,
          connected: paygoAvailable,
          lastTest: new Date(),
          error: paygoAvailable ? undefined : 'Conexão falhou'
        };
      }
    } catch (error) {
      const paygoIndex = newStatus.findIndex(s => s.method === 'paygo');
      if (paygoIndex >= 0) {
        newStatus[paygoIndex] = {
          ...newStatus[paygoIndex],
          available: false,
          connected: false,
          lastTest: new Date(),
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        };
      }
    }

    // Testar TEF
    try {
      const tefAvailable = await tefIntegration.testConnection();
      const tefIndex = newStatus.findIndex(s => s.method === 'tef');
      if (tefIndex >= 0) {
        newStatus[tefIndex] = {
          ...newStatus[tefIndex],
          available: tefAvailable,
          connected: tefAvailable,
          lastTest: new Date(),
          error: tefAvailable ? undefined : 'Conexão falhou'
        };
      }
    } catch (error) {
      const tefIndex = newStatus.findIndex(s => s.method === 'tef');
      if (tefIndex >= 0) {
        newStatus[tefIndex] = {
          ...newStatus[tefIndex],
          available: false,
          connected: false,
          lastTest: new Date(),
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        };
      }
    }

    // Testar Bluetooth
    try {
      const bluetoothEnabled = await bluetoothIntegration.checkBluetoothEnabled();
      const bluetoothIndex = newStatus.findIndex(s => s.method === 'bluetooth');
      if (bluetoothIndex >= 0) {
        newStatus[bluetoothIndex] = {
          ...newStatus[bluetoothIndex],
          available: bluetoothEnabled && bluetoothIntegration.isNative,
          connected: bluetoothIntegration.isConnected,
          lastTest: new Date(),
          error: bluetoothEnabled ? undefined : 'Bluetooth não disponível'
        };
      }
    } catch (error) {
      const bluetoothIndex = newStatus.findIndex(s => s.method === 'bluetooth');
      if (bluetoothIndex >= 0) {
        newStatus[bluetoothIndex] = {
          ...newStatus[bluetoothIndex],
          available: false,
          connected: false,
          lastTest: new Date(),
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        };
      }
    }

    setMethodsStatus(newStatus);
  }, [paygoIntegration, tefIntegration, bluetoothIntegration, methodsStatus]);

  // Encontrar o melhor método disponível
  const getBestAvailableMethod = useCallback((): PaymentMethod | null => {
    const availableMethods = methodsStatus
      .filter(status => status.available && status.connected)
      .sort((a, b) => a.priority - b.priority);
    
    return availableMethods.length > 0 ? availableMethods[0].method : null;
  }, [methodsStatus]);

  // Processar pagamento com fallback automático
  const processPayment = useCallback(async (
    transaction: UniversalTransaction,
    preferredMethod?: PaymentMethod
  ): Promise<UniversalPaymentResponse> => {
    setIsProcessing(true);
    
    try {
      // Determinar método a usar
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

      // Processar pagamento com o método escolhido
      switch (methodToUse) {
        case 'paygo':
          try {
            const paygoResponse = await paygoIntegration.processPayGOPayment({
              amount: transaction.amount,
              paymentType: transaction.type.toUpperCase() as "CREDIT" | "DEBIT" | "PIX",
              orderId: transaction.orderId
            });
            
            return {
              success: paygoResponse.success,
              method: 'paygo',
              data: paygoResponse,
              transactionId: paygoResponse.transactionId
            };
          } catch (error) {
            // Fallback para próximo método
            const nextMethod = getBestAvailableMethod();
            if (nextMethod && nextMethod !== 'paygo') {
              return processPayment(transaction, nextMethod);
            }
            throw error;
          }

        case 'tef':
          try {
            const tefResponse = await tefIntegration.processTEFPayment({
              transacao: 'venda',
              valor: transaction.amount.toString(),
              cupomFiscal: transaction.orderId || Date.now().toString(),
              dataHora: new Date().toISOString().slice(0, 19).replace('T', ' '),
              estabelecimento: 'Top Lavanderia',
              terminal: '001'
            });
            
            return {
              success: tefResponse.retorno === '0',
              method: 'tef',
              data: tefResponse,
              transactionId: tefResponse.nsu
            };
          } catch (error) {
            // Fallback para próximo método
            const nextMethod = getBestAvailableMethod();
            if (nextMethod && nextMethod !== 'tef') {
              return processPayment(transaction, nextMethod);
            }
            throw error;
          }

        case 'bluetooth':
          try {
            const bluetoothResponse = await bluetoothIntegration.processPayment({
              amount: transaction.amount,
              type: transaction.type,
              orderId: transaction.orderId
            });
            
            return {
              success: bluetoothResponse.success,
              method: 'bluetooth',
              data: bluetoothResponse.data,
              transactionId: bluetoothResponse.transactionId
            };
          } catch (error) {
            // Fallback para próximo método
            const nextMethod = getBestAvailableMethod();
            if (nextMethod && nextMethod !== 'bluetooth') {
              return processPayment(transaction, nextMethod);
            }
            throw error;
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
  }, [methodsStatus, getBestAvailableMethod, paygoIntegration, tefIntegration, bluetoothIntegration, currentMethod, toast]);

  // Testar métodos periodicamente
  useEffect(() => {
    testAllMethods();
    const interval = setInterval(testAllMethods, 30000); // Testar a cada 30s
    return () => clearInterval(interval);
  }, [testAllMethods]);

  return {
    // Estado
    isProcessing,
    currentMethod,
    methodsStatus,
    
    // Funções
    processPayment,
    testAllMethods,
    getBestAvailableMethod,
    
    // Integrações individuais
    paygoIntegration,
    tefIntegration,
    bluetoothIntegration
  };
};