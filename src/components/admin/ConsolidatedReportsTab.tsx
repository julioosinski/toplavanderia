import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, DollarSign, Activity, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLaundry } from "@/contexts/LaundryContext";

interface LaundryStats {
  laundry_id: string;
  laundry_name: string;
  total_revenue: number;
  total_transactions: number;
  total_machines: number;
  active_machines: number;
}

export const ConsolidatedReportsTab = () => {
  const { isSuperAdmin, laundries } = useLaundry();
  const { toast } = useToast();
  const [stats, setStats] = useState<LaundryStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isSuperAdmin) {
      loadConsolidatedStats();
    }
  }, [isSuperAdmin]);

  const loadConsolidatedStats = async () => {
    try {
      setLoading(true);
      
      const statsPromises = laundries.map(async (laundry) => {
        // Buscar máquinas
        const { data: machines, error: machinesError } = await supabase
          .from('machines')
          .select('id, status, total_revenue')
          .eq('laundry_id', laundry.id);

        if (machinesError) throw machinesError;

        // Buscar transações
        const { data: transactions, error: transactionsError } = await supabase
          .from('transactions')
          .select('id, total_amount')
          .eq('laundry_id', laundry.id);

        if (transactionsError) throw transactionsError;

        const totalRevenue = machines?.reduce((sum, m) => sum + Number(m.total_revenue || 0), 0) || 0;
        const activeMachines = machines?.filter(m => m.status === 'available' || m.status === 'in_use').length || 0;

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
    } catch (error: any) {
      console.error('Error loading consolidated stats:', error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              Acesso restrito a super administradores
            </p>
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
      {/* Estatísticas Consolidadas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <DollarSign className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Receita Total</p>
                <p className="text-2xl font-bold">R$ {totalRevenue.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Activity className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Transações</p>
                <p className="text-2xl font-bold">{totalTransactions}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Building2 className="text-purple-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Lavanderias</p>
                <p className="text-2xl font-bold">{laundries.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <TrendingUp className="text-orange-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Máquinas Ativas</p>
                <p className="text-2xl font-bold">{totalActiveMachines}/{totalMachines}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance por Lavanderia */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Performance por Lavanderia</CardTitle>
            <CardDescription>
              Análise comparativa de todas as unidades
            </CardDescription>
          </div>
          <Button onClick={loadConsolidatedStats} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">Carregando estatísticas...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {stats
                .sort((a, b) => b.total_revenue - a.total_revenue)
                .map((stat, index) => (
                  <div
                    key={stat.laundry_id}
                    className="p-4 border rounded-lg hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">#{index + 1}</span>
                        </div>
                        <div>
                          <h3 className="font-semibold">{stat.laundry_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {stat.total_machines} máquinas • {stat.active_machines} ativas
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-600">
                          R$ {stat.total_revenue.toFixed(2)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {stat.total_transactions} transações
                        </p>
                      </div>
                    </div>
                    
                    {/* Barra de progresso comparativa */}
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-green-600"
                        style={{
                          width: `${(stat.total_revenue / Math.max(...stats.map(s => s.total_revenue))) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ranking de Eficiência */}
      <Card>
        <CardHeader>
          <CardTitle>Ranking de Eficiência</CardTitle>
          <CardDescription>
            Receita média por máquina
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats
              .map(stat => ({
                ...stat,
                efficiency: stat.total_machines > 0 ? stat.total_revenue / stat.total_machines : 0
              }))
              .sort((a, b) => b.efficiency - a.efficiency)
              .map((stat, index) => (
                <div
                  key={stat.laundry_id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground">
                      {index + 1}º
                    </span>
                    <span className="font-medium">{stat.laundry_name}</span>
                  </div>
                  <span className="font-bold text-primary">
                    R$ {stat.efficiency.toFixed(2)}/máquina
                  </span>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
