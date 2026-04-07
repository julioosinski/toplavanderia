import { useState, useEffect, useCallback, useMemo } from 'react';
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
  /** Mesmo enviado ao PayGO em /pix/status/{orderId} */
  orderId?: string;
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
    /** ID do terminal TEF (campo `terminal` na venda); não confundir com porta HTTP */
    terminalId?: string;
  };
  /** When true, skip TEF/PIX HTTP tests and force PayGO as only method (Smart POS mode) */
  smartPosMode?: boolean;
  /** Payment provider passed through to PayGO native layer: 'paygo' (default) | 'cielo' */
  provider?: string;
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

  // Real integrations — usar callbacks estáveis nas deps (o objeto do hook muda a cada render)
  const paygoIntegration = useRealPayGOIntegration(config.paygo);
  const pixPaygoOpts = useMemo(
    () => ({
      host: config.paygo.host,
      port: config.paygo.port,
      automationKey: config.paygo.automationKey,
      timeout: config.paygo.timeout,
    }),
    [config.paygo.host, config.paygo.port, config.paygo.automationKey, config.paygo.timeout]
  );
  const pixIntegration = usePixPayment(pixPaygoOpts);

  const tefHttpConfig = useMemo(
    () => ({
      host: config.tef.host,
      port: config.tef.port,
      timeout: config.tef.timeout,
      retryAttempts: config.tef.retryAttempts,
      retryDelay: config.tef.retryDelay,
    }),
    [
      config.tef.host,
      config.tef.port,
      config.tef.timeout,
      config.tef.retryAttempts,
      config.tef.retryDelay,
    ]
  );
  const tefIntegration = useTEFIntegration(tefHttpConfig);

  const testPaygoConnection = paygoIntegration.testConnection;
  const processPaygoPayment = paygoIntegration.processPayment;
  const testTefConnection = tefIntegration.testConnection;
  const processTefPayment = tefIntegration.processTEFPayment;
  const generatePixQR = pixIntegration.generatePixQR;

  const defaultMethodsStatus = (): PaymentMethodStatus[] => [
    { method: 'paygo', available: false, connected: false, priority: 1 },
    { method: 'tef', available: false, connected: false, priority: 2 },
    { method: 'pix', available: false, connected: false, priority: 3 },
    { method: 'manual', available: true, connected: true, priority: 4 },
  ];

  /** interactive: true = toasts no PayGO/TEF (botão "Testar conexões"). Omitido = silencioso (polling). */
  const testAllMethods = useCallback(
    async (options?: { interactive?: boolean }) => {
      const silent = options?.interactive !== true;
      const provider = (config.provider || config.paygo.provider || 'paygo').toLowerCase();

      // Cielo mode: Smart terminal does checkout itself (no external pinpad/TEF dependency).
      if (provider === 'cielo') {
        try {
          const cieloReady = await testPaygoConnection({ silent });
          setMethodsStatus([
            { method: 'paygo', available: cieloReady, connected: cieloReady, priority: 1, lastTest: new Date(), error: cieloReady ? undefined : 'Cielo não inicializado' },
            { method: 'tef', available: false, connected: false, priority: 2, error: 'TEF desabilitado no modo Cielo' },
            { method: 'pix', available: cieloReady, connected: cieloReady, priority: 3, lastTest: new Date(), error: cieloReady ? undefined : 'PIX via Cielo indisponível' },
            { method: 'manual', available: true, connected: true, priority: 4 },
          ]);
        } catch {
          setMethodsStatus([
            { method: 'paygo', available: false, connected: false, priority: 1, lastTest: new Date(), error: 'Cielo não inicializado' },
            { method: 'tef', available: false, connected: false, priority: 2, error: 'TEF desabilitado no modo Cielo' },
            { method: 'pix', available: false, connected: false, priority: 3, lastTest: new Date(), error: 'PIX via Cielo indisponível' },
            { method: 'manual', available: true, connected: true, priority: 4 },
          ]);
        }
        return;
      }

      if (config.smartPosMode) {
        setMethodsStatus([
          { method: 'paygo', available: true, connected: true, priority: 1, lastTest: new Date() },
          { method: 'tef', available: false, connected: false, priority: 2 },
          { method: 'pix', available: true, connected: true, priority: 3, lastTest: new Date() },
          { method: 'manual', available: true, connected: true, priority: 4 },
        ]);
        return;
      }

      const newStatus = defaultMethodsStatus();

      try {
        const paygoAvailable = await testPaygoConnection({ silent });
        const idx = newStatus.findIndex((s) => s.method === 'paygo');
        if (idx >= 0) {
          newStatus[idx] = {
            ...newStatus[idx],
            available: paygoAvailable,
            connected: paygoAvailable,
            lastTest: new Date(),
            error: paygoAvailable ? undefined : 'Conexão PayGO falhou',
          };
        }
      } catch (error) {
        const idx = newStatus.findIndex((s) => s.method === 'paygo');
        if (idx >= 0) {
          newStatus[idx] = {
            ...newStatus[idx],
            available: false,
            connected: false,
            lastTest: new Date(),
            error: error instanceof Error ? error.message : 'Erro desconhecido',
          };
        }
      }

      try {
        const tefAvailable = await testTefConnection({ silent });
        const idx = newStatus.findIndex((s) => s.method === 'tef');
        if (idx >= 0) {
          newStatus[idx] = {
            ...newStatus[idx],
            available: tefAvailable,
            connected: tefAvailable,
            lastTest: new Date(),
            error: tefAvailable ? undefined : 'Conexão TEF falhou',
          };
        }
      } catch (error) {
        const idx = newStatus.findIndex((s) => s.method === 'tef');
        if (idx >= 0) {
          newStatus[idx] = {
            ...newStatus[idx],
            available: false,
            connected: false,
            lastTest: new Date(),
            error: error instanceof Error ? error.message : 'Erro desconhecido',
          };
        }
      }

      const paygoStatus = newStatus.find((s) => s.method === 'paygo');
      const pixIdx = newStatus.findIndex((s) => s.method === 'pix');
      if (pixIdx >= 0 && paygoStatus) {
        newStatus[pixIdx] = {
          ...newStatus[pixIdx],
          available: paygoStatus.available,
          connected: paygoStatus.connected,
          lastTest: new Date(),
          error: paygoStatus.available ? undefined : 'PIX depende do PayGO',
        };
      }

      setMethodsStatus(newStatus);
    },
    [config.provider, config.paygo.provider, config.smartPosMode, testPaygoConnection, testTefConnection]
  );

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
      let methodToUse =
        preferredMethod &&
        methodsStatus.find((s) => s.method === preferredMethod && s.available && s.connected)
          ? preferredMethod
          : getBestAvailableMethod();

      // Smart POS: PIX is handled natively by PayGo Integrado (no HTTP endpoint)
      if (config.smartPosMode && transaction.type === 'pix' && methodToUse !== 'paygo') {
        methodToUse = 'paygo';
      }

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
          const result = await processPaygoPayment({
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
          const tefResult = await processTefPayment({
            transacao: 'venda',
            valor: (transaction.amount * 100).toString(),
            cupomFiscal: transaction.orderId || Date.now().toString(),
            dataHora: new Date().toISOString().slice(0, 19).replace('T', ' '),
            estabelecimento: 'Top Lavanderia',
            terminal: (config.tef.terminalId && config.tef.terminalId.trim()) || '001',
          });

          return {
            success: tefResult?.retorno === '0',
            method: 'tef',
            data: tefResult,
            transactionId: tefResult?.nsu
          };
        }

        case 'pix': {
          const orderId = transaction.orderId || `ORDER_${Date.now()}`;
          const pixResult = await generatePixQR({
            amount: transaction.amount,
            orderId,
          });

          return {
            success: pixResult.success,
            method: 'pix',
            data: pixResult,
            transactionId: pixResult.transactionId,
            orderId: pixResult.orderId || orderId,
            qrCode: pixResult.qrCode,
            qrCodeBase64: pixResult.qrCodeBase64,
            pixKey: pixResult.pixKey,
            expiresIn: pixResult.expiresIn,
            error: pixResult.success ? undefined : pixResult.errorMessage,
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
  }, [
    methodsStatus,
    getBestAvailableMethod,
    processPaygoPayment,
    processTefPayment,
    generatePixQR,
    currentMethod,
    toast,
    config.tef.terminalId,
  ]);

  useEffect(() => {
    void testAllMethods();
    const interval = setInterval(() => void testAllMethods(), 30000);
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
