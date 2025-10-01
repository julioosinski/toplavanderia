import { registerPlugin } from '@capacitor/core';

export interface TEFPlugin {
  /**
   * Inicializa a conexão com o TEF
   */
  initialize(options: {
    host: string;
    port: string;
    timeout: number;
  }): Promise<{ success: boolean; message: string; version?: string }>;

  /**
   * Verifica status da conexão TEF
   */
  checkStatus(): Promise<{ 
    connected: boolean; 
    status: string;
    isOnline: boolean;
    version?: string;
  }>;

  /**
   * Processa uma transação TEF
   */
  processTransaction(options: {
    transacao: string;
    valor: string;
    cupomFiscal: string;
    dataHora: string;
    estabelecimento: string;
    terminal: string;
  }): Promise<{
    retorno: string;
    nsu?: string;
    autorizacao?: string;
    ultimosDigitos?: string;
    mensagem?: string;
    rede?: string;
    bandeira?: string;
    tipoCartao?: string;
  }>;

  /**
   * Cancela transação em andamento
   */
  cancelTransaction(): Promise<{ success: boolean; message: string }>;

  /**
   * Detecta dispositivos TEF na rede
   */
  findTEFDevices(): Promise<{
    devices: Array<{
      ip: string;
      name: string;
      model: string;
    }>;
  }>;
}

const TEF = registerPlugin<TEFPlugin>('TEF', {
  web: () => import('./tef.web').then(m => new m.TEFWeb()),
});

export default TEF;
