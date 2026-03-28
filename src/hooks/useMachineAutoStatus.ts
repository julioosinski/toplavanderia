import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { mergeRelayIntoEsp32Status } from '@/lib/machineEsp32Sync';

export const useMachineAutoStatus = () => {
  useEffect(() => {
    const checkMachineTimeouts = async () => {
      try {
        // Buscar máquinas que estão "running" há mais tempo que o ciclo
        const { data: runningMachines, error } = await supabase
          .from('machines')
          .select('id, updated_at, cycle_time_minutes, esp32_id, relay_pin, laundry_id')
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
            
            // Ciclo configurado + pequena margem (alinhado ao totem)
            if (minutesSinceUpdate >= cycleTime + 2) {
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
            const releasedRows =
              runningMachines?.filter((m) => machinesToUpdate.includes(m.id)) ?? [];
            for (const m of releasedRows) {
              if (m.esp32_id && m.laundry_id) {
                const { error: relayErr } = await mergeRelayIntoEsp32Status(
                  m.esp32_id,
                  m.laundry_id,
                  m.relay_pin ?? 1,
                  'off'
                );
                if (relayErr) {
                  console.warn('[useMachineAutoStatus] espelho relay_status:', relayErr);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Erro no processo de timeout das máquinas:', error);
      }
    };

    // A cada 45s para alinhar liberação ao que o usuário vê no totem
    const interval = setInterval(checkMachineTimeouts, 45000);

    // Verificar imediatamente
    checkMachineTimeouts();

    return () => clearInterval(interval);
  }, []);

  return null; // Hook apenas para efeito colateral
};