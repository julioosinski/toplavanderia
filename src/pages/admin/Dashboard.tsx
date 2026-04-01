import { useEffect, useState, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Receipt, Activity, CheckCircle, AlertTriangle } from "lucide-react";
import { useLaundry } from "@/contexts/LaundryContext";
import { supabase } from "@/integrations/supabase/client";
import { computeMachineStatus, type Esp32StatusRow } from "@/lib/machineEsp32Sync";
import { LaundryDashboardSelector } from "@/components/admin/LaundryDashboardSelector";
import { MachineStatusGrid } from "@/components/admin/MachineStatusGrid";
import { ConsolidatedMachineStatus } from "@/components/admin/ConsolidatedMachineStatus";
import { useMachines } from "@/hooks/useMachines";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { currentLaundry, isSuperAdmin, laundries, isViewingAllLaundries } = useLaundry();
  const isViewingAll = isSuperAdmin && isViewingAllLaundries;
  const laundryIdForMachines = isViewingAll ? undefined : currentLaundry?.id;
  const { machines, loading: machinesLoading, refreshMachines } = useMachines(laundryIdForMachines);

  // Revenue/transaction stats — fetched independently at a slower cadence
  const [revenueStats, setRevenueStats] = useState({ totalRevenue: 0, monthlyRevenue: 0, todayTransactions: 0 });
  const [revenueLoading, setRevenueLoading] = useState(true);
  const initialLoadDone = useRef(false);

  const [machinesByLaundry, setMachinesByLaundry] = useState<Record<string, { laundryName: string; machines: any[] }>>({});

  // Machine stats derived reactively from useMachines — updates in ≤5s
  const machineStats = useMemo(() => ({
    totalMachines: machines.length,
    activeMachines: machines.filter(m => m.status === 'available').length,
    offlineMachines: machines.filter(m => m.status === 'offline').length,
    maintenanceMachines: machines.filter(m => m.status === 'maintenance').length,
  }), [machines]);

  const loadRevenueData = async () => {
    if (!currentLaundry && !isViewingAll) return;
    try {
      // Only show skeleton on first load
      if (!initialLoadDone.current) setRevenueLoading(true);

      const transactionsQuery = supabase.from('transactions').select('*');
      const machinesQuery = supabase.from('machines').select('total_revenue');
      if (!isViewingAll && currentLaundry) {
        transactionsQuery.eq('laundry_id', currentLaundry.id);
        machinesQuery.eq('laundry_id', currentLaundry.id);
      }
      const [{ data: transactionsData }, { data: machinesData }] = await Promise.all([
        transactionsQuery,
        machinesQuery,
      ]);

      const today = new Date(); today.setHours(0, 0, 0, 0);
      const todayTransactions = transactionsData?.filter(t => new Date(t.created_at) >= today).length || 0;
      const totalRevenue = machinesData?.reduce((sum, m) => sum + (Number(m.total_revenue) || 0), 0) || 0;

      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const monthlyRevenue = transactionsData?.filter(t => {
        const date = new Date(t.created_at);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      }).reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0) || 0;

      setRevenueStats({ totalRevenue, monthlyRevenue, todayTransactions });
      initialLoadDone.current = true;
    } catch (error) {
      console.error("Erro ao carregar dados de receita:", error);
    } finally {
      setRevenueLoading(false);
    }
  };

  const loadConsolidatedMachines = async () => {
    if (!isViewingAll) return;
    const groupedMachines: Record<string, { laundryName: string; machines: any[] }> = {};

    // Fetch all ESP32 status once
    const { data: allEsp32 } = await supabase
      .from('esp32_status')
      .select('esp32_id, ip_address, is_online, relay_status, last_heartbeat, signal_strength, network_status, laundry_id');
    const esp32ByLaundry = new Map<string, Esp32StatusRow[]>();
    (allEsp32 || []).forEach((e: any) => {
      const arr = esp32ByLaundry.get(e.laundry_id) || [];
      arr.push(e);
      esp32ByLaundry.set(e.laundry_id, arr);
    });

    for (const laundry of laundries) {
      const { data: laundryMachines } = await supabase
        .from('machines').select('*').eq('laundry_id', laundry.id);
      if (laundryMachines && laundryMachines.length > 0) {
        const esp32List = esp32ByLaundry.get(laundry.id) || [];
        const esp32Map = new Map(esp32List.map(e => [e.esp32_id, e]));
        const enriched = laundryMachines.map((m: any) => {
          const esp32 = esp32Map.get(m.esp32_id || '') as Esp32StatusRow | undefined;
          const computed = computeMachineStatus(m, esp32);
          return { ...m, status: computed.status };
        });
        groupedMachines[laundry.id] = { laundryName: laundry.name, machines: enriched };
      }
    }
    setMachinesByLaundry(groupedMachines);
  };

  useEffect(() => {
    loadRevenueData();
    if (isViewingAll) loadConsolidatedMachines();
    const interval = setInterval(() => {
      loadRevenueData();
      if (isViewingAll) loadConsolidatedMachines();
    }, 15000);
    return () => clearInterval(interval);
  }, [currentLaundry, isViewingAll, isSuperAdmin, laundries]);

  if (revenueLoading && !initialLoadDone.current) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-muted rounded" />)}
        </div>
      </div>
    );
  }

  const hasAlerts = machineStats.offlineMachines > 0 || machineStats.maintenanceMachines > 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral da lavanderia</p>
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

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <DollarSign className="text-primary" size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Receita Total</p>
                <p className="text-2xl font-bold">R$ {revenueStats.totalRevenue.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Receipt className="text-primary" size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Receita Mensal</p>
                <p className="text-2xl font-bold">R$ {revenueStats.monthlyRevenue.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Activity className="text-primary" size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Transações Hoje</p>
                <p className="text-2xl font-bold">{revenueStats.todayTransactions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <CheckCircle className="text-primary" size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Disponíveis</p>
                <p className="text-2xl font-bold">{machineStats.activeMachines} / {machineStats.totalMachines}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Machine Status Section */}
      {isViewingAll ? (
        <ConsolidatedMachineStatus
          machinesByLaundry={machinesByLaundry}
          loading={machinesLoading}
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
