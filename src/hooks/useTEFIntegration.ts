import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';

interface TEFConfig {
  host: string;
  port: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

interface TEFTransaction {
  transacao: string;
  valor: string;
  cupomFiscal: string;
  dataHora: string;
  estabelecimento: string;
  terminal: string;
}

interface TEFResponse {
  retorno: string;
  nsu?: string;
  autorizacao?: string;
  ultimosDigitos?: string;
  mensagem?: string;
  rede?: string;
  bandeira?: string;
  tipoCartao?: string;
}

interface TEFStatus {
  isOnline: boolean;
  version?: string;
  lastCheck: Date;
  consecutiveFailures: number;
  isInitialized: boolean;
}

export const useTEFIntegration = (config: TEFConfig) => {
  const [status, setStatus] = useState<TEFStatus>({
    isOnline: false,
    lastCheck: new Date(),
    consecutiveFailures: 0,
    isInitialized: false
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Função para auto-detectar IP da Positivo L4 na rede local
  const findPositivoL4 = useCallback(async (): Promise<string | null> => {
    const commonIPs = ['192.168.1.100', '192.168.0.100', '10.0.0.100'];
    
    for (const ip of commonIPs) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch(`http://${ip}:8080/status`, {
          method: 'GET',
          mode: 'cors',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          // Verificar se é realmente uma Positivo L4
          if (data.model?.includes('L4') || data.device?.includes('Positivo')) {
            return ip;
          }
        }
      } catch (error) {
        // Continue tentando outros IPs
        continue;
      }
    }
    
    return null;
  }, []);

  // Função para verificar status do TEF
  const checkTEFStatus = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`http://${config.host}:${config.port}/status`, {
        method: 'GET',
        mode: 'cors',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setStatus(prev => ({
          isOnline: true,
          version: data.version,
          lastCheck: new Date(),
          consecutiveFailures: 0,
          isInitialized: prev.isInitialized
        }));
        return true;
      }
    } catch (error) {
      console.error('TEF Status Check Failed:', error);
    }

    setStatus(prev => ({
      ...prev,
      isOnline: false,
      lastCheck: new Date(),
      consecutiveFailures: prev.consecutiveFailures + 1
    }));
    return false;
  }, [config.host, config.port]);

  // Função para inicializar TEF com retry
  const initializeTEF = useCallback(async (): Promise<boolean> => {
    let attempts = 0;
    const maxAttempts = config.retryAttempts || 3;

    while (attempts < maxAttempts) {
      try {
        console.log(`TEF Init Attempt ${attempts + 1}/${maxAttempts}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout);

        const response = await fetch(`http://${config.host}:${config.port}/start`, {
          method: 'GET',
          mode: 'cors',
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          setStatus(prev => ({
            ...prev,
            isOnline: true,
            isInitialized: true,
            version: data.version,
            consecutiveFailures: 0
          }));
          
          console.log("TEF Plugin inicializado com sucesso", data);
          return true;
        }
      } catch (error) {
        console.error(`TEF Init Attempt ${attempts + 1} failed:`, error);
        attempts++;
        
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, config.retryDelay || 2000));
        }
      }
    }

    setStatus(prev => ({
      ...prev,
      isOnline: false,
      isInitialized: false,
      consecutiveFailures: prev.consecutiveFailures + 1
    }));

    toast({
      title: "Erro de Inicialização TEF",
      description: `Falha após ${maxAttempts} tentativas. Verifique se o Elgin TEF está funcionando.`,
      variant: "destructive"
    });

    return false;
  }, [config, toast]);

  // Função principal de processamento de pagamento com retry
  const processTEFPayment = useCallback(async (transaction: TEFTransaction): Promise<TEFResponse | null> => {
    setIsProcessing(true);
    let attempts = 0;
    const maxAttempts = config.retryAttempts || 3;

    // Cancelar qualquer transação anterior
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    while (attempts < maxAttempts) {
      try {
        console.log(`TEF Payment Attempt ${attempts + 1}/${maxAttempts}`, transaction);

        // Verificar se TEF está online antes de processar
        if (!status.isOnline || !status.isInitialized) {
          const initialized = await initializeTEF();
          if (!initialized && attempts === maxAttempts - 1) {
            throw new Error("TEF não disponível");
          }
          if (!initialized) {
            attempts++;
            continue;
          }
        }

        abortControllerRef.current = new AbortController();
        const timeoutId = setTimeout(() => {
          abortControllerRef.current?.abort();
        }, config.timeout);

        const response = await fetch(`http://${config.host}:${config.port}/executar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(transaction),
          signal: abortControllerRef.current.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
        }

        const result: TEFResponse = await response.json();
        console.log("TEF Response:", result);

        // Log da transação para auditoria
        console.log(`[TEF_AUDIT] ${new Date().toISOString()}`, {
          transaction,
          response: result,
          attempt: attempts + 1
        });

        setIsProcessing(false);
        return result;

      } catch (error) {
        console.error(`TEF Payment Attempt ${attempts + 1} failed:`, error);
        attempts++;
        
        if (attempts < maxAttempts) {
          toast({
            title: "Tentativa de Pagamento",
            description: `Tentativa ${attempts} falhou. Tentando novamente...`,
            variant: "default"
          });
          await new Promise(resolve => setTimeout(resolve, config.retryDelay || 2000));
        }
      }
    }

    setIsProcessing(false);
    
    toast({
      title: "Erro no Pagamento TEF",
      description: `Falha após ${maxAttempts} tentativas. Tente novamente ou entre em contato com o suporte.`,
      variant: "destructive"
    });

    return null;
  }, [config, status, initializeTEF, toast]);

  // Função para cancelar transação em andamento
  const cancelTransaction = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsProcessing(false);
      
      toast({
        title: "Transação Cancelada",
        description: "A transação TEF foi cancelada pelo usuário",
        variant: "default"
      });
    }
  }, [toast]);

  // Função para testar conectividade
  const testConnection = useCallback(async (): Promise<boolean> => {
    try {
      const isOnline = await checkTEFStatus();
      
      if (isOnline) {
        toast({
          title: "Teste de Conectividade",
          description: "Conexão com TEF estabelecida com sucesso",
          variant: "default"
        });
      } else {
        toast({
          title: "Teste de Conectividade",
          description: "Falha na conexão com TEF",
          variant: "destructive"
        });
      }
      
      return isOnline;
    } catch (error) {
      toast({
        title: "Erro no Teste",
        description: "Erro ao testar conectividade TEF",
        variant: "destructive"
      });
      return false;
    }
  }, [checkTEFStatus, toast]);

  return {
    status,
    isProcessing,
    initializeTEF,
    processTEFPayment,
    cancelTransaction,
    checkTEFStatus,
    testConnection,
    findPositivoL4
  };
};