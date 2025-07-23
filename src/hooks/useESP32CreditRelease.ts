import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface CreditReleaseParams {
  transactionId: string;
  amount: number;
  esp32Id?: string;
}

export const useESP32CreditRelease = () => {
  const [isReleasing, setIsReleasing] = useState(false);
  const { toast } = useToast();

  const releaseCredit = async ({ transactionId, amount, esp32Id }: CreditReleaseParams) => {
    setIsReleasing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('esp32-credit-release', {
        body: {
          transactionId,
          amount,
          esp32Id: esp32Id || 'main'
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