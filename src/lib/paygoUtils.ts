import { PayGOConfig, PayGOResponse } from '@/hooks/usePayGOIntegration';

export const DEFAULT_PAYGO_CONFIG: PayGOConfig = {
  host: '127.0.0.1',
  port: 8080,
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
  automationKey: 'default-key',
  cnpjCpf: '',
};

export const validatePayGOConfig = (config: PayGOConfig): string[] => {
  const errors: string[] = [];
  
  if (!config.host?.trim()) {
    errors.push('Host é obrigatório');
  }
  
  if (!config.port || config.port < 1 || config.port > 65535) {
    errors.push('Porta deve estar entre 1 e 65535');
  }
  
  if (!config.timeout || config.timeout < 1000) {
    errors.push('Timeout deve ser pelo menos 1000ms');
  }
  
  if (!config.automationKey?.trim()) {
    errors.push('Chave de automação é obrigatória');
  }
  
  if (!config.cnpjCpf?.trim()) {
    errors.push('CNPJ/CPF é obrigatório');
  } else if (!/^\d{11}$|^\d{14}$/.test(config.cnpjCpf.replace(/\D/g, ''))) {
    errors.push('CNPJ/CPF deve ter 11 ou 14 dígitos');
  }
  
  return errors;
};

export const formatPayGOAmount = (amount: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount);
};

export const parsePayGOResponse = (response: any): PayGOResponse => {
  return {
    success: response.success === true,
    resultCode: response.resultCode || 0,
    resultMessage: response.resultMessage || '',
    receiptCustomer: response.receiptCustomer,
    receiptMerchant: response.receiptMerchant,
    transactionId: response.transactionId,
    authorizationCode: response.authorizationCode,
    nsu: response.nsu,
    errorMessage: response.errorMessage,
  };
};

export const getPayGOErrorMessage = (resultCode: number): string => {
  const errorMessages: Record<number, string> = {
    0: 'Transação aprovada',
    1: 'Transação negada',
    2: 'Cartão inválido',
    3: 'Senha incorreta',
    4: 'Transação cancelada pelo usuário',
    5: 'Timeout na transação',
    6: 'Erro de comunicação',
    7: 'Terminal não inicializado',
    8: 'Valor inválido',
    9: 'Erro interno do sistema',
    10: 'Cartão vencido',
    11: 'Saldo insuficiente',
    12: 'Operação não permitida',
    13: 'Terminal bloqueado',
    14: 'Falha na conexão',
    15: 'Transação duplicada',
  };
  
  return errorMessages[resultCode] || `Erro desconhecido (código: ${resultCode})`;
};

export const formatCnpjCpf = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  
  if (numbers.length <= 11) {
    // CPF format: 000.000.000-00
    return numbers
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  } else {
    // CNPJ format: 00.000.000/0000-00
    return numbers
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  }
};

export const isValidCnpjCpf = (value: string): boolean => {
  const numbers = value.replace(/\D/g, '');
  return /^\d{11}$|^\d{14}$/.test(numbers);
};

export const getPayGOStatusColor = (status: 'healthy' | 'degraded' | 'unhealthy'): string => {
  switch (status) {
    case 'healthy':
      return 'text-green-600 bg-green-100';
    case 'degraded':
      return 'text-yellow-600 bg-yellow-100';
    case 'unhealthy':
      return 'text-red-600 bg-red-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
};

export const getPayGOStatusText = (status: 'healthy' | 'degraded' | 'unhealthy'): string => {
  switch (status) {
    case 'healthy':
      return 'Saudável';
    case 'degraded':
      return 'Degradado';
    case 'unhealthy':
      return 'Instável';
    default:
      return 'Desconhecido';
  }
};