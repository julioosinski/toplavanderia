import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface NFSeData {
  companyName: string;
  companyCnpj: string;
  companyEmail: string;
  customerName?: string;
  customerEmail?: string;
  customerDocument?: string;
  serviceDescription: string;
  serviceValue: number;
  transactionId: string;
  machineId: string;
  machineName: string;
  startedAt: string;
  completedAt: string;
  paymentMethod: string;
}

export const useNFSeIntegration = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const sendToZapier = async (webhookUrl: string, nfseData: NFSeData): Promise<boolean> => {
    if (!webhookUrl) {
      toast({
        title: "Erro",
        description: "URL do webhook Zapier não configurada",
        variant: "destructive",
      });
      return false;
    }

    setIsProcessing(true);
    
    try {
      console.log("Enviando dados NFSe para Zapier:", nfseData);

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        mode: "no-cors", // Para lidar com CORS
        body: JSON.stringify({
          ...nfseData,
          timestamp: new Date().toISOString(),
          triggered_from: window.location.origin,
        }),
      });

      // Com no-cors, não conseguimos verificar o status da resposta
      // Mas podemos assumir que foi enviado com sucesso
      toast({
        title: "NFSe Enviada",
        description: "Dados enviados para Zapier. Verifique o histórico do Zap para confirmar o processamento.",
      });

      return true;
    } catch (error) {
      console.error("Erro ao enviar para Zapier:", error);
      toast({
        title: "Erro NFSe",
        description: "Falha ao enviar dados para Zapier. Verifique a URL do webhook.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const testWebhook = async (webhookUrl: string): Promise<boolean> => {
    if (!webhookUrl) {
      toast({
        title: "Erro",
        description: "URL do webhook não informada",
        variant: "destructive",
      });
      return false;
    }

    setIsProcessing(true);

    try {
      const testData = {
        test: true,
        message: "Teste de conexão NFSe",
        timestamp: new Date().toISOString(),
        triggered_from: window.location.origin,
      };

      await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        mode: "no-cors",
        body: JSON.stringify(testData),
      });

      toast({
        title: "Teste Enviado",
        description: "Dados de teste enviados para Zapier. Verifique o histórico do Zap.",
      });

      return true;
    } catch (error) {
      console.error("Erro no teste:", error);
      toast({
        title: "Erro no Teste",
        description: "Falha ao testar webhook. Verifique a URL.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    isProcessing,
    sendToZapier,
    testWebhook,
  };
};