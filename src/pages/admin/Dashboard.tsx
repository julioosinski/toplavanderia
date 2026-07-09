import { useCallback, useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { useLaundry } from "@/hooks/useLaundry";
import { supabase } from "@/integrations/supabase/client";
import { computeMachineStatus, ESP32_ADMIN_HEARTBEAT_STALE_MS, type Esp32StatusRow, type MachineRow } from "@/lib/machineEsp32Sync";
import { getMachineTypeMeta, mapDbMachineType, sortMachinesByDisplayType } from "@/lib/machineDisplayTypes";
import { LaundryDashboardSelector } from "@/components/admin/LaundryDashboardSelector";
import { MachineStatusGrid } from "@/components/admin/MachineStatusGrid";
import { ConsolidatedMachineStatus } from "@/components/admin/ConsolidatedMachineStatus";
import { type Machine, useMachines } from "@/hooks/useMachines";
import { Badge } from "@/components/ui/badge";

interface ConsolidatedMachineRow extends MachineRow {
  name: string;
  type?: string | null;
  laundry_id?: string | null;
  price_per_cycle?: number | string | null;
  cycle_time_minutes?: number | null;
  relay_pin?: number | null;
  esp32_id?: string | null;
  location?: string | null;
}

type Esp32StatusWithLaundry = Esp32StatusRow & {
  laundry_id: string | null;
};

type MachinesByLaundry = Record<string, { laundryName: string; machines: Machine[] }>;

const toDashboardMachine = (
  row: ConsolidatedMachineRow,
  status: Machine["status"],
  esp32?: Esp32StatusRow,
  espReachable?: boolean
): Machine => {
  const type = mapDbMachineType(row.type);
  const typeMeta = getMachineTypeMeta(type);

  return {
    id: row.id,
    name: row.name,
    type,
    title: row.name,
    price: Number(row.price_per_cycle) || (type === "coffee" ? 0 : 18),
    duration: row.cycle_time_minutes || (type === "coffee" ? 0 : 40),
    status,
    icon: typeMeta.icon,
    laundry_id: row.laundry_id || undefined,
    esp32_id: row.esp32_id || undefined,
    relay_pin: row.relay_pin || undefined,
    location: row.location || undefined,
    ip_address: esp32?.ip_address || undefined,
    espReachable,
  };
};

export default function Dashboard() {
  const { currentLaundry, isSuperAdmin, laundries, isViewingAllLaundries } = useLaundry();
  const isViewingAll = isSuperAdmin && isViewingAllLaundries;
  const currentLaundryId = currentLaundry?.id;
  const laundryIdForMachines = isViewingAll ? undefined : currentLaundryId;
  const { machines, loading: machinesLoading, refreshMachines } = useMachines(laundryIdForMachines, { staleMs: ESP32_ADMIN_HEARTBEAT_STALE_MS });

  const [machinesByLaundry, setMachinesByLaundry] = useState<MachinesByLaundry>({});

  const fallbackMachinesByLaundry = useMemo(() => {
    if (!isViewingAll) return {};
    return machines.reduce<MachinesByLaundry>((acc, machine) => {
      if (!machine.laundry_id) return acc;
      const laundryName = laundries.find((laundry) => laundry.id === machine.laundry_id)?.name;
      if (!laundryName) return acc;
      if (!acc[machine.laundry_id]) acc[machine.laundry_id] = { laundryName, machines: [] };
      acc[machine.laundry_id].machines.push(machine);
      return acc;
    }, {});
  }, [isViewingAll, laundries, machines]);

  const displayedMachinesByLaundry = useMemo(
    () => Object.keys(machinesByLaundry).length > 0 ? machinesByLaundry : fallbackMachinesByLaundry,
    [fallbackMachinesByLaundry, machinesByLaundry]
  );

  const machineStats = useMemo(() => ({
    totalMachines: machines.length,
    offlineMachines: machines.filter(m => m.status === 'offline').length,
    maintenanceMachines: machines.filter(m => m.status === 'maintenance').length,
  }), [machines]);

  const loadConsolidatedMachines = useCallback(async () => {
    if (!isViewingAll) return;
    const groupedMachines: MachinesByLaundry = {};

    const { data: allEsp32 } = await supabase
      .from('esp32_status')
      .select('esp32_id, ip_address, is_online, relay_status, last_heartbeat, signal_strength, network_status, laundry_id');
    const esp32ByLaundry = new Map<string, Esp32StatusRow[]>();
    ((allEsp32 || []) as Esp32StatusWithLaundry[]).forEach((e) => {
      if (!e.laundry_id) return;
      const arr = esp32ByLaundry.get(e.laundry_id) || [];
      arr.push(e);
      esp32ByLaundry.set(e.laundry_id, arr);
    });

    const results = await Promise.all(
      laundries.map(async (laundry) => {
        const { data: laundryMachines } = await supabase
          .from('machines').select('*').eq('laundry_id', laundry.id);
        if (!laundryMachines || laundryMachines.length === 0) return null;
        const esp32List = esp32ByLaundry.get(laundry.id) || [];
        const esp32Map = new Map(esp32List.map(e => [e.esp32_id, e]));
        const enriched = sortMachinesByDisplayType(
          (laundryMachines as ConsolidatedMachineRow[]).map((m) => {
            const esp32 = esp32Map.get(m.esp32_id || '');
            const computed = computeMachineStatus(m, esp32, { staleMs: ESP32_ADMIN_HEARTBEAT_STALE_MS });
            return toDashboardMachine(m, computed.status, esp32, computed.espReachable);
          })
        );
        return { laundryId: laundry.id, laundryName: laundry.name, machines: enriched };
      })
    );
    results.forEach((r) => {
      if (r) groupedMachines[r.laundryId] = { laundryName: r.laundryName, machines: r.machines };
    });
    setMachinesByLaundry(groupedMachines);
  }, [isViewingAll, laundries]);

  useEffect(() => {
    void loadConsolidatedMachines();
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void loadConsolidatedMachines();
    }, 30000);

    let machinesCh: ReturnType<typeof supabase.channel> | null = null;
    let esp32Ch: ReturnType<typeof supabase.channel> | null = null;
    if (isViewingAll) {
      machinesCh = supabase
        .channel('dashboard-consolidated-machines')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'machines' }, () => {
          void loadConsolidatedMachines();
        })
        .subscribe();
      esp32Ch = supabase
        .channel('dashboard-consolidated-esp32')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'esp32_status' }, () => {
          void loadConsolidatedMachines();
        })
        .subscribe();
    }

    return () => {
      clearInterval(interval);
      if (machinesCh) supabase.removeChannel(machinesCh);
      if (esp32Ch) supabase.removeChannel(esp32Ch);
    };
  }, [isViewingAll, loadConsolidatedMachines]);

  const hasAlerts = machineStats.offlineMachines > 0 || machineStats.maintenanceMachines > 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Máquinas</h1>
          <p className="text-sm text-muted-foreground">Status e acionamento manual</p>
        </div>
        <LaundryDashboardSelector />
      </div>

      {hasAlerts && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-amber-600 flex-shrink-0" size={20} />
              <div className="flex flex-wrap gap-2">
                {machineStats.offlineMachines > 0 && (
                  <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50">
                    {machineStats.offlineMachines} máquina{machineStats.offlineMachines > 1 ? 's' : ''} offline
                  </Badge>
                )}
                {machineStats.maintenanceMachines > 0 && (
                  <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
                    {machineStats.maintenanceMachines} em manutenção
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isViewingAll ? (
        <ConsolidatedMachineStatus
          machinesByLaundry={displayedMachinesByLaundry}
          loading={machinesLoading && Object.keys(displayedMachinesByLaundry).length === 0}
          onAfterMachineAction={() => { void loadConsolidatedMachines(); }}
        />
      ) : (
        <MachineStatusGrid
          machines={machines}
          loading={machinesLoading}
          onAfterMachineAction={() => { void refreshMachines({ background: true }); }}
        />
      )}
    </div>
  );
}
