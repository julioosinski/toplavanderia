import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  isTotemActive,
  toTotemStatus,
  type TotemHeartbeatRow,
  type TotemStatus,
} from "@/lib/totemHeartbeat";

const POLL_INTERVAL_MS = 30_000;

interface UseTotemHeartbeatsResult {
  totems: TotemStatus[];
  staleCount: number;
  isLoading: boolean;
  hasError: boolean;
}

/**
 * Sinal de vida dos totens. Sem laundryId traz todas as lavanderias visíveis (RLS limita
 * ao escopo do usuário). Atualiza a cada 30 s com a aba visível.
 */
export function useTotemHeartbeats(laundryId?: string): UseTotemHeartbeatsResult {
  const [rows, setRows] = useState<TotemHeartbeatRow[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const load = useCallback(async () => {
    let query = supabase
      .from("totem_heartbeats")
      .select("laundry_id, device_id, app_version, device_model, network_online, current_screen, payment_in_progress, first_seen_at, last_seen_at")
      .order("last_seen_at", { ascending: false });
    if (laundryId) query = query.eq("laundry_id", laundryId);

    const { data, error } = await query;
    setHasError(Boolean(error));
    if (!error) setRows((data ?? []) as TotemHeartbeatRow[]);
    setNowMs(Date.now());
    setIsLoading(false);
  }, [laundryId]);

  useEffect(() => {
    setIsLoading(true);
    void load();
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void load();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const totems = useMemo(
    () => rows.filter((row) => isTotemActive(row, nowMs)).map((row) => toTotemStatus(row, nowMs)),
    [rows, nowMs]
  );
  const staleCount = useMemo(() => totems.filter((t) => t.health === "stale").length, [totems]);

  return { totems, staleCount, isLoading, hasError };
}
