import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DollarSign, WashingMachine, Receipt, TrendingUp } from "lucide-react";
import { useLaundry } from "@/contexts/LaundryContext";
import { supabase } from "@/integrations/supabase/client";
import { LaundryDashboardSelector } from "@/components/admin/LaundryDashboardSelector";
import { MachineStatusGrid } from "@/components/admin/MachineStatusGrid";
import { ConsolidatedMachineStatus } from "@/components/admin/ConsolidatedMachineStatus";
import { useMachines } from "@/hooks/useMachines";

interface Stats {
  totalRevenue: number;
  activeMachines: number;
  totalMachines: number;
  todayTransactions: number;
  revenueChange: number;
  monthlyRevenue: number;
  occupancyRate: number;
}

export default function Dashboard() {
  const { currentLaundry, isSuperAdmin, laundries } = useLaundry();
  const [stats, setStats] = useState<Stats>({
    totalRevenue: 0,
    activeMachines: 0,
    totalMachines: 0,
    todayTransactions: 0,
    revenueChange: 0,
    monthlyRevenue: 0,
    occupancyRate: 0
  });
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [machineData, setMachineData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [machinesByLaundry, setMachinesByLaundry] = useState<Record<string, { laundryName: string; machines: any[] }>>({});
  
  const { machines, loading: machinesLoading } = useMachines();
  
  const isViewingAll = localStorage.getItem('selectedLaundryId') === 'all' && isSuperAdmin;

  const loadDashboardData = async () => {
    if (!currentLaundry && !isViewingAll) return;

    try {
      setLoading(true);

      // Build query based on view mode
      const machinesQuery = supabase.from('machines').select('*');
      const transactionsQuery = supabase.from('transactions').select('*');
      
      if (!isViewingAll && currentLaundry) {
        machinesQuery.eq('laundry_id', currentLaundry.id);
        transactionsQuery.eq('laundry_id', currentLaundry.id);
      }

      // Buscar máquinas
      const { data: machinesData, error: machinesError } = await machinesQuery;

      if (machinesError) {
        console.error("Erro ao carregar máquinas:", machinesError);
        return;
      }

      // Buscar transações
      const { data: transactionsData, error: transactionsError } = await transactionsQuery;

      if (transactionsError) {
        console.error("Erro ao carregar transações:", transactionsError);
        return;
      }

      // Calcular estatísticas
      const totalMachines = machinesData?.length || 0;
      const activeMachines = machinesData?.filter(m => m.status === 'available').length || 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const todayTransactions = transactionsData?.filter(t => 
        new Date(t.created_at) >= today
      ).length || 0;

      const totalRevenue = transactionsData?.reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0) || 0;

      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const monthlyRevenue = transactionsData?.filter(t => {
        const date = new Date(t.created_at);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      }).reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0) || 0;

      // Receita dos últimos 7 dias
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        d.setHours(0, 0, 0, 0);
        return d;
      });

      const revenueByDay = last7Days.map(date => {
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        
        const dayRevenue = transactionsData?.filter(t => {
          const transDate = new Date(t.created_at);
          return transDate >= date && transDate < nextDay;
        }).reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0) || 0;

        return {
          date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
          receita: dayRevenue
        };
      });

      // Uso por máquina
      const machineUsage = machinesData?.map(machine => ({
        name: machine.name,
        uso: transactionsData?.filter(t => t.machine_id === machine.id).length || 0
      })) || [];

      setStats({
        totalRevenue,
        activeMachines,
        totalMachines,
        todayTransactions,
        monthlyRevenue,
        revenueChange: 12.5, // Calcular real depois
        occupancyRate: totalMachines > 0 ? (activeMachines / totalMachines) * 100 : 0
      });

      setRevenueData(revenueByDay);
      setMachineData(machineUsage);

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  // Load machines by laundry for consolidated view
  const loadConsolidatedMachines = async () => {
    if (!isViewingAll) return;

    const groupedMachines: Record<string, { laundryName: string; machines: any[] }> = {};
    
    for (const laundry of laundries) {
      const { data: laundryMachines } = await supabase
        .from('machines')
        .select('*')
        .eq('laundry_id', laundry.id);

      if (laundryMachines && laundryMachines.length > 0) {
        groupedMachines[laundry.id] = {
          laundryName: laundry.name,
          machines: laundryMachines,
        };
      }
    }

    setMachinesByLaundry(groupedMachines);
  };

  useEffect(() => {
    loadDashboardData();
    if (isViewingAll) {
      loadConsolidatedMachines();
    }
  }, [currentLaundry, isViewingAll]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-muted rounded" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-64 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header com seletor */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Status das Máquinas</h1>
          <p className="text-muted-foreground">
            Visualização em tempo real das máquinas
          </p>
        </div>
        <LaundryDashboardSelector />
      </div>

      {/* Machine Status Section */}
      {isViewingAll ? (
        <ConsolidatedMachineStatus 
          machinesByLaundry={machinesByLaundry}
          loading={machinesLoading}
        />
      ) : (
        <MachineStatusGrid 
          machines={machines} 
          loading={machinesLoading}
        />
      )}
    </div>
  );
}
