import { useEffect, useState } from "react";
import { useLaundry } from "@/contexts/LaundryContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, WashingMachine, Receipt, TrendingUp, Activity } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Stats {
  totalRevenue: number;
  activeMachines: number;
  totalMachines: number;
  todayTransactions: number;
  monthRevenue: number;
  occupancyRate: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--muted))', 'hsl(var(--secondary))'];

export default function Dashboard() {
  const { currentLaundry } = useLaundry();
  const [stats, setStats] = useState<Stats>({
    totalRevenue: 0,
    activeMachines: 0,
    totalMachines: 0,
    todayTransactions: 0,
    monthRevenue: 0,
    occupancyRate: 0,
  });
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [machineData, setMachineData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentLaundry) {
      loadDashboardData();
    }
  }, [currentLaundry]);

  const loadDashboardData = async () => {
    if (!currentLaundry) return;

    setLoading(true);

    // Load machines
    const { data: machines } = await supabase
      .from("machines")
      .select("*")
      .eq("laundry_id", currentLaundry.id);

    const activeMachines = machines?.filter((m) => m.status === "available").length || 0;
    const totalMachines = machines?.length || 0;

    // Load transactions
    const { data: transactions } = await supabase
      .from("transactions")
      .select("*")
      .eq("laundry_id", currentLaundry.id)
      .order("created_at", { ascending: false });

    const today = new Date().toISOString().split("T")[0];
    const todayTransactions = transactions?.filter((t) => 
      t.created_at.startsWith(today)
    ).length || 0;

    const totalRevenue = transactions?.reduce((sum, t) => sum + (t.total_amount || 0), 0) || 0;

    // Month revenue
    const currentMonth = new Date().getMonth();
    const monthRevenue = transactions?.filter((t) => {
      const transactionMonth = new Date(t.created_at).getMonth();
      return transactionMonth === currentMonth;
    }).reduce((sum, t) => sum + (t.total_amount || 0), 0) || 0;

    // Revenue by day (last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date.toISOString().split("T")[0];
    });

    const revenueByDay = last7Days.map((date) => {
      const dayRevenue = transactions?.filter((t) => 
        t.created_at.startsWith(date)
      ).reduce((sum, t) => sum + (t.total_amount || 0), 0) || 0;

      return {
        date: new Date(date).toLocaleDateString("pt-BR", { month: "short", day: "numeric" }),
        receita: dayRevenue,
      };
    });

    // Machine usage
    const machineUsage = machines?.map((m) => ({
      name: m.name || m.id.slice(0, 8),
      uso: transactions?.filter((t) => t.machine_id === m.id).length || 0,
    })) || [];

    setStats({
      totalRevenue,
      activeMachines,
      totalMachines,
      todayTransactions,
      monthRevenue,
      occupancyRate: totalMachines > 0 ? (activeMachines / totalMachines) * 100 : 0,
    });

    setRevenueData(revenueByDay);
    setMachineData(machineUsage);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-24 bg-muted" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do seu negócio</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {stats.totalRevenue.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              +{stats.monthRevenue.toFixed(2)} este mês
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Máquinas Ativas</CardTitle>
            <WashingMachine className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.activeMachines}/{stats.totalMachines}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.occupancyRate.toFixed(1)}% de ocupação
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transações Hoje</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayTransactions}</div>
            <p className="text-xs text-muted-foreground">
              Transações realizadas
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+12.5%</div>
            <p className="text-xs text-muted-foreground">
              vs. mês anterior
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Receita (7 dias)</CardTitle>
            <CardDescription>Evolução diária da receita</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Area 
                  type="monotone" 
                  dataKey="receita" 
                  stroke="hsl(var(--primary))" 
                  fillOpacity={1} 
                  fill="url(#colorReceita)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Uso por Máquina</CardTitle>
            <CardDescription>Número de transações por máquina</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={machineData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="uso" fill="hsl(var(--accent))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
