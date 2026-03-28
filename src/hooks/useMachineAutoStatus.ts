import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  mergeRelayIntoEsp32Status,
  queueEsp32RelayOff,
  resolvedRelayPin,
} from '@/lib/machineEsp32Sync';

/** Margem alinhada ao totem (useMachines) após o fim do ciclo */
const CYCLE_END_GRACE_MINUTES = 2;

/**
 * Libera máquinas cujo ciclo já expirou. Usa a Edge Function `update-machine-status`
 * (service role) — UPDATE direto no cliente costuma falhar por RLS no totem anónimo.
 * Enfileira também `esp32-control` off para o hardware coincidir com o banco.
 */
export const useMachineAutoStatus = () => {
  useEffect(() => {
    const checkMachineTimeouts = async () => {
      try {
        const { data: runningMachines, error } = await supabase
          .from('machines')
          .select('id, updated_at, cycle_time_minutes, esp32_id, relay_pin, laundry_id')
          .eq('status', 'running');

        if (error) {
          console.error('Erro ao buscar máquinas em execução:', error);
          return;
        }

        const now = new Date();
        const machinesToRelease: typeof runningMachines = [];

        runningMachines?.forEach((machine) => {
          if (!machine.updated_at) return;
          const lastUpdate = new Date(machine.updated_at);
          const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
          const cycleTime = machine.cycle_time_minutes || 40;
          if (minutesSinceUpdate >= cycleTime + CYCLE_END_GRACE_MINUTES) {
            machinesToRelease.push(machine);
          }
        });

        for (const machine of machinesToRelease) {
          const { data, error: fnErr } = await supabase.functions.invoke('update-machine-status', {
            body: { machine_id: machine.id, status: 'available' },
          });

          if (fnErr) {
            console.error('[useMachineAutoStatus] update-machine-status:', fnErr);
            continue;
          }
          if (data && typeof data === 'object' && 'success' in data && data.success === false) {
            console.error('[useMachineAutoStatus] update-machine-status:', (data as { error?: string }).error);
            continue;
          }

          if (machine.esp32_id && machine.laundry_id) {
            const pin = resolvedRelayPin(machine.relay_pin);
            const { error: relayErr } = await mergeRelayIntoEsp32Status(
              machine.esp32_id,
              machine.laundry_id,
              pin,
              'off'
            );
            if (relayErr) {
              console.warn('[useMachineAutoStatus] espelho relay_status:', relayErr);
            }
            await queueEsp32RelayOff(machine.esp32_id, pin, machine.id);
          }
        }

        if (machinesToRelease.length > 0) {
          console.log(`[useMachineAutoStatus] ${machinesToRelease.length} máquina(s) liberada(s) (Edge + relé)`);
        }
      } catch (error) {
        console.error('Erro no processo de timeout das máquinas:', error);
      }
    };

    const interval = setInterval(checkMachineTimeouts, 45_000);
    checkMachineTimeouts();

    return () => clearInterval(interval);
  }, []);

  return null;
};
