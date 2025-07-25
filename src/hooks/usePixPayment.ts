import { useState, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

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
          'X-Automation-Key': paygoConfig.automationKey,
        },
        body: JSON.stringify({
          amount: Math.round(paymentData.amount * 100), // Convert to cents
          orderId: paymentData.orderId,
          expiresIn: 300, // 5 minutes default
        }),
        signal: AbortSignal.timeout(paygoConfig.timeout),
      });

      const result = await response.json();
      
      if (result.success && result.qrCode) {
        const pixData: PixPaymentData = {
          ...paymentData,
          qrCode: result.qrCode,
          qrCodeBase64: result.qrCodeBase64,
          pixKey: result.pixKey,
          expiresIn: result.expiresIn || 300,
        };
        
        setCurrentPayment(pixData);
        setTimeRemaining(pixData.expiresIn!);
        
        return {
          success: true,
          qrCode: result.qrCode,
          qrCodeBase64: result.qrCodeBase64,
          pixKey: result.pixKey,
          transactionId: result.transactionId,
          expiresIn: result.expiresIn,
        };
      }
      
      return {
        success: false,
        errorMessage: result.message || 'Falha ao gerar QR Code Pix',
      };
    } catch (error) {
      console.error('Erro ao gerar Pix QR:', error);
      return {
        success: false,
        errorMessage: 'Erro de comunicação com PayGO',
      };
    } finally {
      setIsGeneratingQR(false);
    }
  }, [paygoConfig, toast]);

  const checkPixPaymentStatus = useCallback(async (orderId: string): Promise<PixPaymentStatus> => {
    try {
      const response = await fetch(`http://${paygoConfig.host}:${paygoConfig.port}/pix/status/${orderId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Automation-Key': paygoConfig.automationKey,
        },
        signal: AbortSignal.timeout(paygoConfig.timeout),
      });

      const result = await response.json();
      
      return {
        status: result.status || 'pending',
        transactionId: result.transactionId,
        paidAt: result.paidAt,
        amount: result.amount,
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