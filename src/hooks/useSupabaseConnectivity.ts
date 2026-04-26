import { useCallback, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : 'Erro desconhecido';
};

export const useSupabaseConnectivity = () => {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);
  const { toast } = useToast();

  const testConnection = useCallback(async () => {
    try {
      setIsLoading(true);
      setLastError(null);

      // Teste simples de conectividade
      const { data, error } = await supabase
        .from('machines')
        .select('id')
        .limit(1);

      if (error) {
        throw error;
      }

      setIsConnected(true);
      console.log('✅ Supabase conectado com sucesso');
      
      return true;
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      console.error('❌ Erro de conectividade Supabase:', error);
      setLastError(errorMessage);
      setIsConnected(false);
      
      toast({
        title: "Erro de Conectividade",
        description: `Não foi possível conectar ao Supabase: ${errorMessage}`,
        variant: "destructive"
      });
      
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const testESP32Status = async () => {
    try {
      const { data, error } = await supabase
        .from('esp32_status')
        .select('esp32_id, is_online, last_heartbeat')
        .limit(5);

      if (error) {
        throw error;
      }

      console.log('📡 Status ESP32:', data);
      return data;
    } catch (error: unknown) {
      console.error('❌ Erro ao buscar status ESP32:', error);
      throw error;
    }
  };

  const testMachines = async () => {
    try {
      const { data, error } = await supabase
        .from('machines')
        .select('id, name, status, esp32_id')
        .limit(5);

      if (error) {
        throw error;
      }

      console.log('🔧 Máquinas:', data);
      return data;
    } catch (error: unknown) {
      console.error('❌ Erro ao buscar máquinas:', error);
      throw error;
    }
  };

  const runFullDiagnostic = async () => {
    console.log('🔍 Iniciando diagnóstico completo do Supabase...');
    
    const results = {
      connection: false,
      machines: false,
      esp32: false,
      errors: [] as string[]
    };

    try {
      // Teste 1: Conectividade básica
      console.log('1️⃣ Testando conectividade básica...');
      results.connection = await testConnection();
      
      if (results.connection) {
        // Teste 2: Máquinas
        console.log('2️⃣ Testando busca de máquinas...');
        try {
          await testMachines();
          results.machines = true;
        } catch (error: unknown) {
          results.errors.push(`Máquinas: ${getErrorMessage(error)}`);
        }

        // Teste 3: ESP32 Status
        console.log('3️⃣ Testando status ESP32...');
        try {
          await testESP32Status();
          results.esp32 = true;
        } catch (error: unknown) {
          results.errors.push(`ESP32: ${getErrorMessage(error)}`);
        }
      }

      console.log('📊 Resultado do diagnóstico:', results);
      
      toast({
        title: "Diagnóstico Completo",
        description: `Conectividade: ${results.connection ? '✅' : '❌'} | Máquinas: ${results.machines ? '✅' : '❌'} | ESP32: ${results.esp32 ? '✅' : '❌'}`,
        variant: results.connection ? "default" : "destructive"
      });

      return results;
    } catch (error: unknown) {
      console.error('❌ Erro no diagnóstico:', error);
      results.errors.push(`Geral: ${getErrorMessage(error)}`);
      return results;
    }
  };

  useEffect(() => {
    testConnection();
  }, [testConnection]);

  return {
    isConnected,
    isLoading,
    lastError,
    testConnection,
    testESP32Status,
    testMachines,
    runFullDiagnostic
  };
};
