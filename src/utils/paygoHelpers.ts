import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';

export const handlePayGOError = (error: unknown, context: string): string => {
  const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
  console.error(`${context}:`, error);
  toast.error(`${context}: ${errorMessage}`);
  return errorMessage;
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

export const validatePayGOConfig = (config: {
  host: string;
  port: number;
  automationKey: string;
}): boolean => {
  // No Android/iOS o plugin usa InterfaceAutomacao + PayGo Integrado (USB).
  // Host/porta/chave HTTP do painel não são obrigatórios — exigir isso bloqueava o totem.
  if (Capacitor.isNativePlatform()) {
    return true;
  }

  if (!config.host || config.host.trim() === '') {
    toast.error('Host do PayGO não configurado');
    return false;
  }

  if (!config.port || config.port <= 0) {
    toast.error('Porta do PayGO inválida');
    return false;
  }

  if (!config.automationKey || config.automationKey.trim() === '') {
    toast.error('Chave de automação do PayGO não configurada');
    return false;
  }

  return true;
};
