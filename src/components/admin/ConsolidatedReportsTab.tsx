import { useCallback, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, TrendingUp, DollarSign, Activity, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLaundry } from "@/hooks/useLaundry";

interface LaundryStats {
  laundry_id: string;
  laundry_name: string;
  total_revenue: number;
  total_transactions: number;
  total_machines: number;
  active_machines: number;
}

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : "Erro desconhecido";
};

export const ConsolidatedReportsTab = () => {
  const { isSuperAdmin, laundries } = useLaundry();
  const { toast } = useToast();
  const [stats, setStats] = useState<LaundryStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLaundryId, setSelectedLaundryId] = useState<string>("all");
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const loadConsolidatedStats = useCallback(async () => {
    try {
      setLoading(true);
      const laundriesFilter = selectedLaundryId === "all" ? laundries : laundries.filter(l => l.id === selectedLaundryId);

      const statsPromises = laundriesFilter.map(async (laundry) => {
        const { data: machines, error: machinesError } = await supabase
          .from('machines')
          .select('id, status, total_revenue')
          .eq('laundry_id', laundry.id);
        if (machinesError) throw machinesError;

        const txQuery = supabase
          .from('transactions')
          .select('id, total_amount')
          .eq('laundry_id', laundry.id)
          .gte('created_at', startDate + 'T00:00:00')
          .lte('created_at', endDate + 'T23:59:59');

        const { data: transactions, error: transactionsError } = await txQuery;
        if (transactionsError) throw transactionsError;

        const totalRevenue = transactions?.reduce((sum, t) => sum + Number(t.total_amount || 0), 0) || 0;
        const activeMachines = machines?.filter(m => m.status === 'available' || m.status === 'running').length || 0;

        return {
          laundry_id: laundry.id,
          laundry_name: laundry.name,
          total_revenue: totalRevenue,
          total_transactions: transactions?.length || 0,
          total_machines: machines?.length || 0,
          active_machines: activeMachines,
        };
      });

      const results = await Promise.all(statsPromises);
      setStats(results);
    } catch (error: unknown) {
      console.error('Error loading consolidated stats:', error);
      toast({ title: "Erro", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [endDate, laundries, selectedLaundryId, startDate, toast]);

  useEffect(() => {
    if (isSuperAdmin) loadConsolidatedStats();
  }, [isSuperAdmin, loadConsolidatedStats]);

  if (!isSuperAdmin) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Acesso restrito a super administradores</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalRevenue = stats.reduce((sum, s) => sum + s.total_revenue, 0);
  const totalTransactions = stats.reduce((sum, s) => sum + s.total_transactions, 0);
  const totalMachines = stats.reduce((sum, s) => sum + s.total_machines, 0);
  const totalActiveMachines = stats.reduce((sum, s) => sum + s.active_machines, 0);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data Final</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Lavanderia</Label>
              <Select value={selectedLaundryId} onValueChange={setSelectedLaundryId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Lavanderias</SelectItem>
                  {laundries.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center"><DollarSign className="text-green-600" size={24} /></div>
              <div><p className="text-sm text-muted-foreground">Receita no Período</p><p className="text-2xl font-bold">R$ {totalRevenue.toFixed(2)}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center"><Activity className="text-blue-600" size={24} /></div>
              <div><p className="text-sm text-muted-foreground">Transações</p><p className="text-2xl font-bold">{totalTransactions}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center"><Building2 className="text-purple-600" size={24} /></div>
              <div><p className="text-sm text-muted-foreground">Lavanderias</p><p className="text-2xl font-bold">{laundries.length}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center"><TrendingUp className="text-orange-600" size={24} /></div>
              <div><p className="text-sm text-muted-foreground">Máquinas Ativas</p><p className="text-2xl font-bold">{totalActiveMachines}/{totalMachines}</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Performance por Lavanderia</CardTitle>
            <CardDescription>Período: {new Date(startDate).toLocaleDateString('pt-BR')} — {new Date(endDate).toLocaleDateString('pt-BR')}</CardDescription>
          </div>
          <Button onClick={loadConsolidatedStats} variant="outline" size="sm"><RefreshCw className="h-4 w-4 mr-2" />Atualizar</Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8"><RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" /><p className="text-muted-foreground">Carregando...</p></div>
          ) : (
            <div className="space-y-4">
              {stats.sort((a, b) => b.total_revenue - a.total_revenue).map((stat, index) => (
                <div key={stat.laundry_id} className="p-4 border rounded-lg hover:bg-accent/5 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">#{index + 1}</span>
                      </div>
                      <div>
                        <h3 className="font-semibold">{stat.laundry_name}</h3>
                        <p className="text-sm text-muted-foreground">{stat.total_machines} máquinas • {stat.active_machines} ativas</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">R$ {stat.total_revenue.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">{stat.total_transactions} transações</p>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-green-500 to-green-600" style={{ width: `${(stat.total_revenue / Math.max(...stats.map(s => s.total_revenue), 1)) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Efficiency Ranking */}
      <Card>
        <CardHeader>
          <CardTitle>Ranking de Eficiência</CardTitle>
          <CardDescription>Receita média por máquina no período</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.map(s => ({ ...s, efficiency: s.total_machines > 0 ? s.total_revenue / s.total_machines : 0 }))
              .sort((a, b) => b.efficiency - a.efficiency)
              .map((stat, index) => (
                <div key={stat.laundry_id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground">{index + 1}º</span>
                    <span className="font-medium">{stat.laundry_name}</span>
                  </div>
                  <span className="font-bold text-primary">R$ {stat.efficiency.toFixed(2)}/máquina</span>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
