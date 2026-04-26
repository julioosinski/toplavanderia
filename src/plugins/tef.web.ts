import { WebPlugin } from '@capacitor/core';
import type { TEFPlugin } from './tef';

type TEFTransactionOptions = Parameters<TEFPlugin['processTransaction']>[0];
type TEFTransactionResult = Awaited<ReturnType<TEFPlugin['processTransaction']>>;
type TEFDevicesResult = Awaited<ReturnType<TEFPlugin['findTEFDevices']>>;

export class TEFWeb extends WebPlugin implements TEFPlugin {
  async initialize(options: {
    host: string;
    port: string;
    timeout: number;
  }): Promise<{ success: boolean; message: string; version?: string }> {
    try {
      const response = await fetch(`http://${options.host}:${options.port}/start`, {
        method: 'GET',
        signal: AbortSignal.timeout(options.timeout),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: 'TEF initialized via HTTP',
          version: data.version,
        };
      }

      return {
        success: false,
        message: 'TEF initialization failed',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async checkStatus(): Promise<{
    connected: boolean;
    status: string;
    isOnline: boolean;
    version?: string;
  }> {
    // Web fallback returns mock status
    return {
      connected: false,
      status: 'offline',
      isOnline: false,
    };
  }

  async processTransaction(_options: TEFTransactionOptions): Promise<TEFTransactionResult> {
    throw new Error('TEF transaction not supported on web platform');
  }

  async cancelTransaction(): Promise<{ success: boolean; message: string }> {
    return {
      success: false,
      message: 'Not supported on web',
    };
  }

  async findTEFDevices(): Promise<TEFDevicesResult> {
    return {
      devices: [],
    };
  }
}
