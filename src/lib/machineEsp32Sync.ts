import { supabase } from '@/integrations/supabase/client';

function relayKey(pin: number): string {
  return `relay_${pin}`;
}

/**
 * Atualiza o JSON relay_status no Supabase para o totem refletir o mesmo estado do painel.
 * Não liga/desliga o hardware — use queueEsp32RelayOff / esp32-control para isso.
 */
export async function mergeRelayIntoEsp32Status(
  esp32Id: string,
  laundryId: string,
  relayPin: number,
  value: 'on' | 'off'
): Promise<{ error: Error | null }> {
  const { data: row, error: selErr } = await supabase
    .from('esp32_status')
    .select('relay_status')
    .eq('esp32_id', esp32Id)
    .eq('laundry_id', laundryId)
    .maybeSingle();

  if (selErr) return { error: selErr as Error };
  if (!row) return { error: null };

  const prev = (row.relay_status as Record<string, unknown> | null) || {};
  const next = { ...prev, [relayKey(relayPin)]: value };

  const { error: upErr } = await supabase
    .from('esp32_status')
    .update({ relay_status: next, updated_at: new Date().toISOString() })
    .eq('esp32_id', esp32Id)
    .eq('laundry_id', laundryId);

  return { error: (upErr as Error) ?? null };
}

export async function queueEsp32RelayOff(
  esp32Id: string,
  relayPin: number,
  machineId: string
): Promise<void> {
  try {
    await supabase.functions.invoke('esp32-control', {
      body: {
        esp32_id: esp32Id,
        relay_pin: relayPin,
        action: 'off',
        machine_id: machineId,
      },
    });
  } catch (e) {
    console.warn('[machineEsp32Sync] esp32-control off:', e);
  }
}

/** Libera no totem (available) + espelha relé OFF no banco + enfileira desligar no ESP32 */
export async function forceMachineReleased(params: {
  machineId: string;
  hardwareOff?: boolean;
}): Promise<{ error: Error | null }> {
  const { machineId, hardwareOff = true } = params;

  const { data: m, error: mErr } = await supabase
    .from('machines')
    .select('id, esp32_id, relay_pin, laundry_id')
    .eq('id', machineId)
    .single();

  if (mErr || !m) return { error: (mErr as Error) ?? new Error('Máquina não encontrada') };

  const now = new Date().toISOString();
  const { error: upErr } = await supabase
    .from('machines')
    .update({ status: 'available', updated_at: now })
    .eq('id', machineId);

  if (upErr) return { error: upErr as Error };

  if (m.esp32_id && m.laundry_id) {
    const pin = m.relay_pin ?? 1;
    const { error: relayErr } = await mergeRelayIntoEsp32Status(m.esp32_id, m.laundry_id, pin, 'off');
    if (relayErr) console.warn('[forceMachineReleased] relay_status:', relayErr);
    if (hardwareOff) await queueEsp32RelayOff(m.esp32_id, pin, machineId);
  }

  return { error: null };
}

/** Manutenção no banco + relé OFF espelhado + comando off no hardware */
export async function forceMachineMaintenance(machineId: string): Promise<{ error: Error | null }> {
  const { data: m, error: mErr } = await supabase
    .from('machines')
    .select('id, esp32_id, relay_pin, laundry_id')
    .eq('id', machineId)
    .single();

  if (mErr || !m) return { error: (mErr as Error) ?? new Error('Máquina não encontrada') };

  const { error: upErr } = await supabase
    .from('machines')
    .update({ status: 'maintenance', updated_at: new Date().toISOString() })
    .eq('id', machineId);

  if (upErr) return { error: upErr as Error };

  if (m.esp32_id && m.laundry_id) {
    const pin = m.relay_pin ?? 1;
    const { error: relayErr } = await mergeRelayIntoEsp32Status(m.esp32_id, m.laundry_id, pin, 'off');
    if (relayErr) console.warn('[forceMachineMaintenance] relay_status:', relayErr);
    await queueEsp32RelayOff(m.esp32_id, pin, machineId);
  }

  return { error: null };
}
