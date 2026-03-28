import { useState, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { extractPixQrFields, normalizePixPaymentStatus } from '@/lib/paygoPixResponse';

export interface PixPaymentData {
  amount: number;
  orderId: string;
  qrCode?: string;
  qrCodeBase64?: string;
  pixKey?: string;
  expiresIn?: number;
}

export interface PixPaymentResult {
  success: boolean;
  qrCode?: string;
  qrCodeBase64?: string;
  pixKey?: string;
  transactionId?: string;
  orderId?: string;
  expiresIn?: number;
  errorMessage?: string;
}

export interface PixPaymentStatus {
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  transactionId?: string;
  paidAt?: string;
  amount?: number;
}

export const usePixPayment = (paygoConfig: { host: string; port: number; automationKey: string; timeout: number }) => {
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [currentPayment, setCurrentPayment] = useState<PixPaymentData | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const { toast } = useToast();

  const generatePixQR = useCallback(async (paymentData: PixPaymentData): Promise<PixPaymentResult> => {
    setIsGeneratingQR(true);
    
    try {
      const response = await fetch(`http://${paygoConfig.host}:${paygoConfig.port}/pix/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Automation-Key': paygoConfig.automationKey ?? '',
        },
        body: JSON.stringify({
          amount: Math.round(paymentData.amount * 100), // Convert to cents
          orderId: paymentData.orderId,
          expiresIn: 300, // 5 minutes default
        }),
        signal: AbortSignal.timeout(paygoConfig.timeout),
      });

      let result: Record<string, unknown> = {};
      try {
        const text = await response.text();
        if (text) result = JSON.parse(text) as Record<string, unknown>;
      } catch {
        return {
          success: false,
          errorMessage: 'Resposta inválida do servidor PayGO (PIX)',
          orderId: paymentData.orderId,
        };
      }

      if (!response.ok) {
        const msg =
          (typeof result.message === 'string' && result.message) ||
          (typeof result.error === 'string' && result.error) ||
          `HTTP ${response.status}`;
        return { success: false, errorMessage: msg, orderId: paymentData.orderId };
      }

      const fields = extractPixQrFields(result);
      const hasPayload = Boolean(fields.qrCode || fields.qrCodeBase64);
      const explicitFail =
        result.success === false ||
        result.ok === false ||
        String(result.status ?? '').toLowerCase() === 'denied' ||
        String(result.result ?? '').toLowerCase() === 'error';
      const ok = hasPayload && !explicitFail;
      const effectiveOrderId = fields.orderId || paymentData.orderId;

      if (ok) {
        const expiresIn = fields.expiresIn ?? 300;
        const pixData: PixPaymentData = {
          ...paymentData,
          orderId: effectiveOrderId,
          qrCode: fields.qrCode,
          qrCodeBase64: fields.qrCodeBase64,
          pixKey: fields.pixKey,
          expiresIn,
        };

        setCurrentPayment(pixData);
        setTimeRemaining(expiresIn);

        return {
          success: true,
          qrCode: fields.qrCode,
          qrCodeBase64: fields.qrCodeBase64,
          pixKey: fields.pixKey,
          transactionId: fields.transactionId,
          orderId: effectiveOrderId,
          expiresIn,
        };
      }

      return {
        success: false,
        orderId: paymentData.orderId,
        errorMessage:
          (typeof result.message === 'string' && result.message) ||
          (typeof result.error === 'string' && result.error) ||
          'Falha ao gerar QR Code Pix (sem payload EMV ou imagem)',
      };
    } catch (error) {
      console.error('Erro ao gerar Pix QR:', error);
      return {
        success: false,
        orderId: paymentData.orderId,
        errorMessage: 'Erro de comunicação com PayGO',
      };
    } finally {
      setIsGeneratingQR(false);
    }
  }, [paygoConfig, toast]);

  const checkPixPaymentStatus = useCallback(async (orderId: string): Promise<PixPaymentStatus> => {
    try {
      const response = await fetch(
        `http://${paygoConfig.host}:${paygoConfig.port}/pix/status/${encodeURIComponent(orderId)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Automation-Key': paygoConfig.automationKey ?? '',
          },
          signal: AbortSignal.timeout(paygoConfig.timeout),
        }
      );

      let result: Record<string, unknown> = {};
      try {
        const text = await response.text();
        if (text) result = JSON.parse(text) as Record<string, unknown>;
      } catch {
        return { status: 'pending' as const };
      }

      if (!response.ok) {
        return { status: 'pending' as const };
      }

      const dataNested =
        result.data && typeof result.data === 'object' && !Array.isArray(result.data)
          ? (result.data as Record<string, unknown>)
          : null;

      const status = normalizePixPaymentStatus(
        result.status ??
          result.paymentStatus ??
          result.state ??
          dataNested?.status ??
          dataNested?.paymentStatus ??
          dataNested?.state
      );

      return {
        status,
        transactionId:
          (typeof result.transactionId === 'string' && result.transactionId) ||
          (typeof result.transaction_id === 'string' && result.transaction_id) ||
          (dataNested && typeof dataNested.transactionId === 'string' && dataNested.transactionId) ||
          undefined,
        paidAt:
          (typeof result.paidAt === 'string' && result.paidAt) ||
          (typeof result.paid_at === 'string' && result.paid_at) ||
          (dataNested && typeof dataNested.paidAt === 'string' && dataNested.paidAt) ||
          undefined,
        amount: typeof result.amount === 'number' ? result.amount : undefined,
      };
    } catch (error) {
      console.error('Erro ao verificar status Pix:', error);
      return { status: 'pending' };
    }
  }, [paygoConfig]);

  const startPixPolling = useCallback((orderId: string, onPaymentConfirmed: (status: PixPaymentStatus) => void) => {
    setIsPolling(true);
    
    const pollInterval = setInterval(async () => {
      const status = await checkPixPaymentStatus(orderId);
      
      if (status.status === 'paid') {
        setIsPolling(false);
        clearInterval(pollInterval);
        onPaymentConfirmed(status);
        toast({
          title: "Pagamento Pix confirmado!",
          description: "Sua transação foi processada com sucesso.",
        });
      } else if (status.status === 'expired' || status.status === 'cancelled') {
        setIsPolling(false);
        clearInterval(pollInterval);
        onPaymentConfirmed(status);
      }
    }, 2000); // Check every 2 seconds

    // Auto cleanup after timeout
    setTimeout(() => {
      setIsPolling(false);
      clearInterval(pollInterval);
    }, (currentPayment?.expiresIn || 300) * 1000);

    return () => {
      clearInterval(pollInterval);
      setIsPolling(false);
    };
  }, [checkPixPaymentStatus, currentPayment?.expiresIn, toast]);

  const cancelPixPayment = useCallback(async (orderId: string): Promise<boolean> => {
    try {
      const response = await fetch(`http://${paygoConfig.host}:${paygoConfig.port}/pix/cancel/${orderId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Automation-Key': paygoConfig.automationKey,
        },
        signal: AbortSignal.timeout(paygoConfig.timeout),
      });

      const result = await response.json();
      
      if (result.success) {
        setCurrentPayment(null);
        setIsPolling(false);
        setTimeRemaining(0);
      }
      
      return result.success;
    } catch (error) {
      console.error('Erro ao cancelar Pix:', error);
      return false;
    }
  }, [paygoConfig]);

  // Timer countdown effect
  useEffect(() => {
    if (timeRemaining > 0 && currentPayment) {
      const timer = setTimeout(() => {
        setTimeRemaining(prev => prev - 1);
      }, 1000);

      return () => clearTimeout(timer);
    } else if (timeRemaining === 0 && currentPayment) {
      // Payment expired
      setCurrentPayment(null);
      setIsPolling(false);
      toast({
        title: "QR Code Pix expirado",
        description: "O tempo limite para pagamento foi atingido.",
        variant: "destructive",
      });
    }
  }, [timeRemaining, currentPayment, toast]);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return {
    generatePixQR,
    checkPixPaymentStatus,
    startPixPolling,
    cancelPixPayment,
    currentPayment,
    isGeneratingQR,
    isPolling,
    timeRemaining,
    formatTime,
  };
};