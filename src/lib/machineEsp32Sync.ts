import { supabase } from '@/integrations/supabase/client';

/** Pino físico padrão no firmware TopLav (GPIO 2) quando `relay_pin` não veio do banco */
export const DEFAULT_ESP32_RELAY_PIN = 2;

/**
 * Minutos sem heartbeat após os quais a UI trata o ESP como offline (admin / visão geral).
 */
export const ESP32_HEARTBEAT_STALE_MINUTES = 1;

/**
 * Totem: tempo sem heartbeat para considerar o link com o ESP perdido (mais rápido que o servidor).
 * Firmware envia heartbeat ~30s; 55s ≈ um ciclo perdido.
 */
export const ESP32_TOTEM_HEARTBEAT_STALE_MS = 55_000;

function relayKey(pin: number): string {
  return `relay_${pin}`;
}

export function resolvedRelayPin(pin: number | null | undefined): number {
  return pin != null && Number(pin) > 0 ? Number(pin) : DEFAULT_ESP32_RELAY_PIN;
}

// ---------------------------------------------------------------------------
// Unified status computation — ESP32 is the source of truth
// ---------------------------------------------------------------------------

export interface Esp32StatusRow {
  esp32_id: string;
  is_online?: boolean | null;
  last_heartbeat?: string | null;
  relay_status?: Record<string, unknown> | string | null;
  ip_address?: string | null;
  signal_strength?: number | null;
  network_status?: string | null;
}

export interface MachineRow {
  id: string;
  status: string;
  esp32_id?: string | null;
  relay_pin?: number | null;
  cycle_time_minutes?: number | null;
  updated_at?: string;
  [key: string]: unknown;
}

export interface ComputedStatus {
  /** Final status to display */
  status: 'available' | 'running' | 'maintenance' | 'offline';
  /** True when cycle is active but ESP32 heartbeat is stale */
  hardwareLinkLost: boolean;
  /** Whether the ESP32 is reachable (online + recent heartbeat) */
  espReachable: boolean;
  /** Whether the relay for this machine's pin is ON */
  relayOn: boolean;
}

/**
 * Determines whether a relay is ON for a given pin from the relay_status JSON.
 */
export function isRelayOn(
  relayStatus: Record<string, unknown> | string | null | undefined,
  pin: number
): boolean {
  if (!relayStatus) return false;
  if (typeof relayStatus === 'string') return relayStatus === 'on';

  const key = relayKey(pin);
  const rs = relayStatus as Record<string, unknown>;

  let value: unknown;
  if (rs[key] !== undefined) {
    value = rs[key];
  } else if (rs.status && typeof rs.status === 'object') {
    value = (rs.status as Record<string, unknown>)[key];
  } else if (rs.status !== undefined) {
    value = rs.status;
  }

  return value === 'on' || value === true || value === 1;
}

/**
 * Checks whether an ESP32 heartbeat is recent enough to be considered reachable.
 */
export function isEsp32Reachable(
  esp32: Esp32StatusRow | undefined | null,
  staleMs: number = ESP32_TOTEM_HEARTBEAT_STALE_MS
): boolean {
  if (!esp32) return false;
  if (esp32.is_online === false) return false;
  const lastHb = esp32.last_heartbeat ? new Date(esp32.last_heartbeat) : null;
  if (!lastHb) return false;
  return (Date.now() - lastHb.getTime()) <= staleMs;
}

/**
 * Unified status computation. ESP32 relay is the authority.
 *
 * Priority:
 *  1. DB = maintenance → maintenance (always)
 *  2. No ESP32 configured → use DB status as-is
 *  3. ESP32 offline → offline (unless DB=running with time remaining → running+hardwareLinkLost)
 *  4. ESP32 online + relay ON → running
 *  5. ESP32 online + relay OFF + DB=running + time remaining > 0 → running (pending transition)
 *  6. Otherwise → available
 */
export function computeMachineStatus(
  machine: MachineRow,
  esp32: Esp32StatusRow | undefined | null,
  opts?: { staleMs?: number }
): ComputedStatus {
  const staleMs = opts?.staleMs ?? ESP32_TOTEM_HEARTBEAT_STALE_MS;
  const pin = resolvedRelayPin(machine.relay_pin);

  // 1. Maintenance always wins
  if (machine.status === 'maintenance') {
    return { status: 'maintenance', hardwareLinkLost: false, espReachable: isEsp32Reachable(esp32, staleMs), relayOn: false };
  }

  // 2. No ESP32 configured — fall back to DB
  if (!machine.esp32_id) {
    const s = machine.status === 'running' ? 'running' : machine.status === 'offline' ? 'offline' : 'available';
    return { status: s as ComputedStatus['status'], hardwareLinkLost: false, espReachable: false, relayOn: false };
  }

  const reachable = isEsp32Reachable(esp32, staleMs);
  const relay = isRelayOn(esp32?.relay_status as Record<string, unknown> | string | null, pin);

  // 3. ESP32 offline
  if (!reachable) {
    // If DB says running and there's time left, keep running with hardwareLinkLost flag
    if (machine.status === 'running' && machine.updated_at) {
      const cycleTime = machine.cycle_time_minutes || 40;
      const elapsed = (Date.now() - new Date(machine.updated_at).getTime()) / 60000;
      if (elapsed < cycleTime) {
        return { status: 'running', hardwareLinkLost: true, espReachable: false, relayOn: relay };
      }
    }
    return { status: 'offline', hardwareLinkLost: false, espReachable: false, relayOn: relay };
  }

  // 4. ESP32 online + relay ON → running
  if (relay) {
    return { status: 'running', hardwareLinkLost: false, espReachable: true, relayOn: true };
  }

  // 5. Relay OFF but DB says running with time remaining → running (pending relay off command)
  if (machine.status === 'running' && machine.updated_at) {
    const cycleTime = machine.cycle_time_minutes || 40;
    const elapsed = (Date.now() - new Date(machine.updated_at).getTime()) / 60000;
    if (elapsed < cycleTime) {
      return { status: 'running', hardwareLinkLost: false, espReachable: true, relayOn: false };
    }
  }

  // 6. Available
  return { status: 'available', hardwareLinkLost: false, espReachable: true, relayOn: false };
}

// ---------------------------------------------------------------------------
// Relay sync helpers (unchanged)
// ---------------------------------------------------------------------------

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

  const prev = (row.relay_status as Record<string, string> | null) || {};
  const next: Record<string, string> = { ...prev, [relayKey(relayPin)]: value };

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
    const pin = resolvedRelayPin(m.relay_pin);
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
    const pin = resolvedRelayPin(m.relay_pin);
    const { error: relayErr } = await mergeRelayIntoEsp32Status(m.esp32_id, m.laundry_id, pin, 'off');
    if (relayErr) console.warn('[forceMachineMaintenance] relay_status:', relayErr);
    await queueEsp32RelayOff(m.esp32_id, pin, machineId);
  }

  return { error: null };
}
