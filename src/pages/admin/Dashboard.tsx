import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Receipt, Activity, CheckCircle, AlertTriangle } from "lucide-react";
import { useLaundry } from "@/contexts/LaundryContext";
import { supabase } from "@/integrations/supabase/client";
import { LaundryDashboardSelector } from "@/components/admin/LaundryDashboardSelector";
import { MachineStatusGrid } from "@/components/admin/MachineStatusGrid";
import { ConsolidatedMachineStatus } from "@/components/admin/ConsolidatedMachineStatus";
import { useMachines } from "@/hooks/useMachines";
import { Badge } from "@/components/ui/badge";

interface Stats {
  totalRevenue: number;
  activeMachines: number;
  totalMachines: number;
  todayTransactions: number;
  monthlyRevenue: number;
  offlineMachines: number;
  maintenanceMachines: number;
}

export default function Dashboard() {
  const { currentLaundry, isSuperAdmin, laundries, isViewingAllLaundries } = useLaundry();
  const isViewingAll = isSuperAdmin && isViewingAllLaundries;
  const laundryIdForMachines = isViewingAll ? undefined : currentLaundry?.id;
  const { machines, loading: machinesLoading, refreshMachines } = useMachines(laundryIdForMachines);
  const [stats, setStats] = useState<Stats>({
    totalRevenue: 0, activeMachines: 0, totalMachines: 0,
    todayTransactions: 0, monthlyRevenue: 0, offlineMachines: 0, maintenanceMachines: 0,
  });
  const [loading, setLoading] = useState(true);
  const [machinesByLaundry, setMachinesByLaundry] = useState<Record<string, { laundryName: string; machines: any[] }>>({});

  const loadDashboardData = async () => {
    if (!currentLaundry && !isViewingAll) return;
    try {
      setLoading(true);
      const machinesQuery = supabase.from('machines').select('*');
      const transactionsQuery = supabase.from('transactions').select('*');
      if (!isViewingAll && currentLaundry) {
        machinesQuery.eq('laundry_id', currentLaundry.id);
        transactionsQuery.eq('laundry_id', currentLaundry.id);
      }
      const { data: machinesData } = await machinesQuery;
      const { data: transactionsData } = await transactionsQuery;

      const totalMachines = machinesData?.length || 0;
      const activeMachines = machinesData?.filter(m => m.status === 'available').length || 0;
      const offlineMachines = machinesData?.filter(m => m.status === 'offline').length || 0;
      const maintenanceMachines = machinesData?.filter(m => m.status === 'maintenance').length || 0;

      const today = new Date(); today.setHours(0, 0, 0, 0);
      const todayTransactions = transactionsData?.filter(t => new Date(t.created_at) >= today).length || 0;
      const totalRevenue = machinesData?.reduce((sum, m) => sum + (Number(m.total_revenue) || 0), 0) || 0;

      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const monthlyRevenue = transactionsData?.filter(t => {
        const date = new Date(t.created_at);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      }).reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0) || 0;

      setStats({ totalRevenue, activeMachines, totalMachines, todayTransactions, monthlyRevenue, offlineMachines, maintenanceMachines });
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadConsolidatedMachines = async () => {
    if (!isViewingAll) return;
    const groupedMachines: Record<string, { laundryName: string; machines: any[] }> = {};
    for (const laundry of laundries) {
      const { data: laundryMachines } = await supabase
        .from('machines').select('*').eq('laundry_id', laundry.id);
      if (laundryMachines && laundryMachines.length > 0) {
        groupedMachines[laundry.id] = { laundryName: laundry.name, machines: laundryMachines };
      }
    }
    setMachinesByLaundry(groupedMachines);
  };

  useEffect(() => {
    loadDashboardData();
    if (isViewingAll) loadConsolidatedMachines();
    const interval = setInterval(() => {
      loadDashboardData();
      if (isViewingAll) loadConsolidatedMachines();
    }, 30000);
    return () => clearInterval(interval);
  }, [currentLaundry, isViewingAll, isSuperAdmin, laundries]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-muted rounded" />)}
        </div>
      </div>
    );
  }

  const hasAlerts = stats.offlineMachines > 0 || stats.maintenanceMachines > 0;

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
                {stats.offlineMachines > 0 && (
                  <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50">
                    {stats.offlineMachines} máquina{stats.offlineMachines > 1 ? 's' : ''} offline
                  </Badge>
                )}
                {stats.maintenanceMachines > 0 && (
                  <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
                    {stats.maintenanceMachines} em manutenção
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
                <p className="text-2xl font-bold">R$ {stats.totalRevenue.toFixed(2)}</p>
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
                <p className="text-2xl font-bold">R$ {stats.monthlyRevenue.toFixed(2)}</p>
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
                <p className="text-2xl font-bold">{stats.todayTransactions}</p>
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
                <p className="text-2xl font-bold">{stats.activeMachines} / {stats.totalMachines}</p>
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
