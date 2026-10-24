import type { Tables } from "@/integrations/supabase/types";

export type TotemHeartbeatRow = Tables<"totem_heartbeats">;

/** O APK envia a cada 60 s; 10 min sem sinal = totem parado, sem internet ou desligado. */
export const TOTEM_HEARTBEAT_STALE_MS = 10 * 60 * 1000;

/** Totens que não enviam sinal há mais de 7 dias são considerados desativados (some do painel). */
export const TOTEM_HEARTBEAT_RETIRED_MS = 7 * 24 * 60 * 60 * 1000;

export type TotemHealth = "online" | "app_offline" | "stale";

export interface TotemStatus extends TotemHeartbeatRow {
  health: TotemHealth;
  silentForMs: number;
}

/**
 * Classifica o totem:
 * - stale: sem sinal há mais de TOTEM_HEARTBEAT_STALE_MS (não vende);
 * - app_offline: o sinal chegou, mas o app estava marcado offline (corrige-se no envio seguinte);
 * - online: normal.
 */
export const toTotemStatus = (row: TotemHeartbeatRow, nowMs: number): TotemStatus => {
  const silentForMs = Math.max(0, nowMs - new Date(row.last_seen_at).getTime());
  let health: TotemHealth = "online";
  if (silentForMs > TOTEM_HEARTBEAT_STALE_MS) health = "stale";
  else if (row.network_online === false) health = "app_offline";
  return { ...row, health, silentForMs };
};

export const isTotemActive = (row: TotemHeartbeatRow, nowMs: number): boolean =>
  nowMs - new Date(row.last_seen_at).getTime() <= TOTEM_HEARTBEAT_RETIRED_MS;

/** "há 3 min", "há 2 h 05 min" */
export const formatSilentFor = (ms: number): string => {
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 1) return "agora";
  if (totalMin < 60) return `há ${totalMin} min`;
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours < 24) return `há ${hours} h ${String(minutes).padStart(2, "0")} min`;
  return `há ${Math.floor(hours / 24)} d`;
};
