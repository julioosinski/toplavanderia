import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useMachineAutoStatus = () => {
  useEffect(() => {
    const checkMachineTimeouts = async () => {
      try {
        // Buscar máquinas que estão "running" há mais tempo que o ciclo
        const { data: runningMachines, error } = await supabase
          .from('machines')
          .select('id, updated_at, cycle_time_minutes')
          .eq('status', 'running');

        if (error) {
          console.error('Erro ao buscar máquinas em execução:', error);
          return;
        }

        const now = new Date();
        const machinesToUpdate: string[] = [];

        runningMachines?.forEach(machine => {
          if (machine.updated_at) {
            const lastUpdate = new Date(machine.updated_at);
            const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
            const cycleTime = machine.cycle_time_minutes || 40;
            
            // Se passou mais tempo que o ciclo + 5 minutos de margem
            if (minutesSinceUpdate > cycleTime + 5) {
              machinesToUpdate.push(machine.id);
            }
          }
        });

        // Atualizar status das máquinas que terminaram o ciclo
        if (machinesToUpdate.length > 0) {
          const { error: updateError } = await supabase
            .from('machines')
            .update({ 
              status: 'available',
              updated_at: now.toISOString()
            })
            .in('id', machinesToUpdate);

          if (updateError) {
            console.error('Erro ao atualizar status das máquinas:', updateError);
          } else {
            console.log(`${machinesToUpdate.length} máquinas atualizadas para "available"`);
          }
        }
      } catch (error) {
        console.error('Erro no processo de timeout das máquinas:', error);
      }
    };

    // Verificar a cada 30 segundos
    const interval = setInterval(checkMachineTimeouts, 30000);

    // Verificar imediatamente
    checkMachineTimeouts();

    return () => clearInterval(interval);
  }, []);

  return null; // Hook apenas para efeito colateral
};