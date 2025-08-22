import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useTransactionNFSe = () => {
  const { toast } = useToast();

  useEffect(() => {
    // Subscribe to transaction changes
    const channel = supabase
      .channel('transaction-nfse')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'transactions',
          filter: 'status=eq.completed'
        },
        async (payload) => {
          console.log('Transaction completed, triggering NFSe:', payload);
          
          try {
            // Call the NFSe automation edge function
            const { data, error } = await supabase.functions.invoke('nfse-automation', {
              body: { transactionId: payload.new.id }
            });

            if (error) {
              console.error('NFSe automation error:', error);
              toast({
                title: "Erro NFSe",
                description: "Falha ao processar NFSe automaticamente",
                variant: "destructive",
              });
            } else {
              console.log('NFSe automation success:', data);
              toast({
                title: "NFSe Processada",
                description: "Nota fiscal enviada automaticamente",
              });
            }
          } catch (err) {
            console.error('Error calling NFSe automation:', err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  return null; // This hook doesn't return anything, just handles the automation
};