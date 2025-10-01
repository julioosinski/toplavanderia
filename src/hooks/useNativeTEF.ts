import { useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import TEF from '@/plugins/tef';
import { toast } from 'sonner';

export interface NativeTEFConfig {
  host: string;
  port: string;
  timeout: number;
  retryAttempts?: number;
}

export interface TEFTransaction {
  transacao: string;
  valor: string;
  cupomFiscal: string;
  dataHora: string;
  estabelecimento: string;
  terminal: string;
}

export interface TEFResponse {
  retorno: string;
  nsu?: string;
  autorizacao?: string;
  ultimosDigitos?: string;
  mensagem?: string;
  rede?: string;
  bandeira?: string;
  tipoCartao?: string;
}

export const useNativeTEF = (config: NativeTEFConfig) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  const initialize = useCallback(async (): Promise<boolean> => {
    if (!isNative) {
      toast.error('TEF nativo disponível apenas em Android');
      return false;
    }

    try {
      const result = await TEF.initialize({
        host: config.host,
        port: config.port,
        timeout: config.timeout
      });

      if (result.success) {
        setIsInitialized(true);
        setIsConnected(true);
        toast.success('TEF inicializado com sucesso');
        return true;
      } else {
        toast.error(`Falha ao inicializar TEF: ${result.message}`);
        return false;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro ao inicializar TEF: ${message}`);
      return false;
    }
  }, [config, isNative]);

  const checkStatus = useCallback(async (): Promise<boolean> => {
    if (!isNative) return false;

    try {
      const result = await TEF.checkStatus();
      setIsConnected(result.connected);
      return result.connected;
    } catch (error) {
      setIsConnected(false);
      return false;
    }
  }, [isNative]);

  const processTransaction = useCallback(async (
    transaction: TEFTransaction
  ): Promise<TEFResponse | null> => {
    if (!isNative || !isInitialized) {
      toast.error('TEF não inicializado');
      return null;
    }

    setIsProcessing(true);

    try {
      const result = await TEF.processTransaction(transaction);
      setIsProcessing(false);

      if (result.retorno === '0') {
        toast.success('Pagamento aprovado via TEF');
      } else {
        toast.error(`Pagamento negado: ${result.mensagem}`);
      }

      return result;
    } catch (error) {
      setIsProcessing(false);
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro no pagamento TEF: ${message}`);
      return null;
    }
  }, [isNative, isInitialized]);

  const cancelTransaction = useCallback(async (): Promise<boolean> => {
    if (!isNative) return false;

    try {
      const result = await TEF.cancelTransaction();
      setIsProcessing(false);
      
      if (result.success) {
        toast.success('Transação TEF cancelada');
      }
      
      return result.success;
    } catch (error) {
      setIsProcessing(false);
      return false;
    }
  }, [isNative]);

  const findDevices = useCallback(async () => {
    if (!isNative) return [];

    try {
      const result = await TEF.findTEFDevices();
      return result.devices;
    } catch (error) {
      console.error('Erro ao buscar dispositivos TEF:', error);
      return [];
    }
  }, [isNative]);

  return {
    isNative,
    isInitialized,
    isConnected,
    isProcessing,
    initialize,
    checkStatus,
    processTransaction,
    cancelTransaction,
    findDevices
  };
};
