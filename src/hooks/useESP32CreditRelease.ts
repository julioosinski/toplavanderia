import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface CreditReleaseParams {
  transactionId: string;
  amount: number;
  esp32Id?: string;
  machineId?: string;
}

export const useESP32CreditRelease = () => {
  const [isReleasing, setIsReleasing] = useState(false);
  const { toast } = useToast();

  const releaseCredit = async ({ transactionId, amount, esp32Id, machineId }: CreditReleaseParams) => {
    setIsReleasing(true);
    
    try {
      let targetESP32Id = esp32Id || 'main';
      
      // Se machineId for fornecido, buscar o ESP32 correto para esta máquina
      if (machineId && !esp32Id) {
        const { data: machine, error: machineError } = await supabase
          .from('machines')
          .select('esp32_id')
          .eq('id', machineId)
          .single();
          
        if (!machineError && machine?.esp32_id) {
          targetESP32Id = machine.esp32_id;
        }
      }

      const { data, error } = await supabase.functions.invoke('esp32-credit-release', {
        body: {
          transactionId,
          amount,
          esp32Id: targetESP32Id
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Crédito Liberado",
          description: `R$ ${amount.toFixed(2)} liberado com sucesso`,
        });
        return data;
      } else {
        throw new Error(data.message || 'Falha na liberação de crédito');
      }
    } catch (error) {
      console.error('Error releasing credit:', error);
      toast({
        title: "Erro na Liberação",
        description: error instanceof Error ? error.message : 'Falha ao liberar crédito',
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsReleasing(false);
    }
  };

  return {
    releaseCredit,
    isReleasing
  };
};