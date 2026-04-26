import { useCallback, useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Calendar, TrendingUp, Download, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLaundry } from "@/hooks/useLaundry";
import { Skeleton } from "@/components/ui/skeleton";

interface Transaction {
  id: string;
  machine_id: string;
  total_amount: number;
  created_at: string;
  payment_method?: string;
  user_id?: string;
  machines: {
    name: string;
    type: string;
  };
  operator_name?: string;
}

interface ReportData {
  date: string;
  sales: number;
  revenue: number;
  machine_name?: string;
}

interface MachineOption {
  id: string;
  name: string;
  type: string;
}

export const LaundryReportsTab = () => {
  const { currentLaundry, isSuperAdmin } = useLaundry();
  const currentLaundryId = currentLaundry?.id;
  const currentLaundryName = currentLaundry?.name;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    machineId: 'all',
    machineType: 'all',
    paymentMethod: 'all',
    reportType: 'daily'
  });
  const { toast } = useToast();

  const loadMachines = useCallback(async () => {
    if (!currentLaundryId) return;
    const { data, error } = await supabase
      .from('machines')
      .select('id, name, type')
      .eq('laundry_id', currentLaundryId)
      .order('name');
    if (!error && data) setMachines(data as MachineOption[]);
  }, [currentLaundryId]);

  const generateReport = useCallback(async () => {
    if (!currentLaundryId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('transactions')
        .select(`id, machine_id, total_amount, created_at, payment_method, user_id, machines!inner(name, type)`)
        .eq('laundry_id', currentLaundryId)
        .gte('created_at', filters.startDate + 'T00:00:00')
        .lte('created_at', filters.endDate + 'T23:59:59')
        .order('created_at', { ascending: false });

      if (filters.machineId !== 'all') {
        query = query.eq('machine_id', filters.machineId);
      }
      if (filters.machineType !== 'all') {
        query = query.eq('machines.type', filters.machineType);
      }
      if (filters.paymentMethod !== 'all') {
        query = query.eq('payment_method', filters.paymentMethod);
      }

      const { data, error } = await query;
      if (error) throw error;

      let enriched = (data || []) as Transaction[];

      // Fetch operator names for manual releases
      const manualUserIds = [...new Set(enriched.filter(t => t.payment_method === 'manual_release' && t.user_id).map(t => t.user_id!))];
      if (manualUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', manualUserIds);
        const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
        enriched = enriched.map(t => ({
          ...t,
          operator_name: t.payment_method === 'manual_release' && t.user_id ? profileMap.get(t.user_id) || undefined : undefined,
        }));
      }

      setTransactions(enriched);

      // Process grouped data
      const groupedData: Record<string, ReportData> = {};
      enriched.forEach(transaction => {
        const date = new Date(transaction.created_at);
        let key: string;
        if (filters.reportType === 'daily') {
          key = date.toLocaleDateString('pt-BR');
        } else if (filters.reportType === 'weekly') {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = `Semana de ${weekStart.toLocaleDateString('pt-BR')}`;
        } else {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }
        if (!groupedData[key]) {
          groupedData[key] = { date: key, sales: 0, revenue: 0, machine_name: filters.machineId !== 'all' ? transaction.machines.name : undefined };
        }
        groupedData[key].sales += 1;
        groupedData[key].revenue += Number(transaction.total_amount);
      });

      const reportArray = Object.values(groupedData).sort((a, b) => {
        if (filters.reportType === 'monthly') return b.date.localeCompare(a.date);
        return new Date(b.date.split('/').reverse().join('-')).getTime() - new Date(a.date.split('/').reverse().join('-')).getTime();
      });
      setReportData(reportArray);
    } catch (error) {
      console.error('Error generating report:', error);
      toast({ title: "Erro", description: "Falha ao gerar relatório", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [currentLaundryId, filters, toast]);

  useEffect(() => {
    if (currentLaundryId) {
      loadMachines();
      generateReport();
    }
  }, [currentLaundryId, generateReport, loadMachines]);

  const exportReport = () => {
    const headers = ['Data', 'Vendas', 'Receita'];
    if (filters.machineId !== 'all') headers.push('Máquina');
    const csvContent = [
      headers.join(','),
      ...reportData.map(row => [row.date, row.sales, `R$ ${row.revenue.toFixed(2)}`, ...(row.machine_name ? [row.machine_name] : [])].join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `relatorio_${currentLaundryName}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getPaymentLabel = (method: string | undefined) => {
    if (!method) return "—";
    if (method === 'manual_release') return 'Liberação Manual';
    if (method === 'pix') return 'PIX';
    if (method === 'credit') return 'Crédito';
    if (method === 'debit') return 'Débito';
    if (method.includes('*')) return `Cartão ${method}`;
    return method;
  };

  const totalSales = reportData.reduce((sum, row) => sum + row.sales, 0);
  const totalRevenue = reportData.reduce((sum, row) => sum + row.revenue, 0);
  const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

  if (!currentLaundry) {
    return (
      <div className="space-y-6">
        <Card><CardContent className="p-6"><p className="text-muted-foreground text-center">Nenhuma lavanderia selecionada</p></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Laundry Header */}
      <Card className="border-primary/20 bg-gradient-to-r from-card to-primary/5">
        <CardContent className="p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <Building2 className="text-primary" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">{currentLaundry.name}</h2>
              <p className="text-sm text-muted-foreground">Relatórios e análises de vendas</p>
            </div>
            <Badge variant="secondary" className="ml-auto">
              {isSuperAdmin ? 'Visão Super Admin' : 'Minha Lavanderia'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="text-primary" />
            <span>Filtros do Relatório</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Data Final</Label>
              <Input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Máquina</Label>
              <Select value={filters.machineId} onValueChange={(v) => setFilters({ ...filters, machineId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {machines.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={filters.machineType} onValueChange={(v) => setFilters({ ...filters, machineType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="lavadora">Lavadora</SelectItem>
                  <SelectItem value="secadora">Secadora</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pagamento</Label>
              <Select value={filters.paymentMethod} onValueChange={(v) => setFilters({ ...filters, paymentMethod: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="manual_release">Lib. Manual</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="credit">Crédito</SelectItem>
                  <SelectItem value="debit">Débito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Agrupamento</Label>
              <Select value={filters.reportType} onValueChange={(v) => setFilters({ ...filters, reportType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diário</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={generateReport} disabled={loading}>{loading ? "Gerando..." : "Gerar Relatório"}</Button>
            <Button onClick={exportReport} variant="outline" disabled={reportData.length === 0}>
              <Download size={16} className="mr-1" />Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            {loading ? <Skeleton className="h-16 w-full" /> : (
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
                  <TrendingUp className="text-green-600" size={24} />
                </div>
                <div><p className="text-sm text-muted-foreground">Total de Vendas</p><p className="text-2xl font-bold">{totalSales}</p></div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            {loading ? <Skeleton className="h-16 w-full" /> : (
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <BarChart3 className="text-primary" size={24} />
                </div>
                <div><p className="text-sm text-muted-foreground">Receita Total</p><p className="text-2xl font-bold">R$ {totalRevenue.toFixed(2)}</p></div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            {loading ? <Skeleton className="h-16 w-full" /> : (
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-purple-500/10 rounded-full flex items-center justify-center">
                  <Calendar className="text-purple-600" size={24} />
                </div>
                <div><p className="text-sm text-muted-foreground">Ticket Médio</p><p className="text-2xl font-bold">R$ {averageTicket.toFixed(2)}</p></div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Report Data */}
      <Card>
        <CardHeader>
          <CardTitle>Relatório Detalhado</CardTitle>
          <CardDescription>
            {filters.reportType === 'daily' && 'Vendas por dia'}
            {filters.reportType === 'weekly' && 'Vendas por semana'}
            {filters.reportType === 'monthly' && 'Vendas por mês'}
            {filters.machineId !== 'all' && ` - ${machines.find(m => m.id === filters.machineId)?.name}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : (
            <div className="space-y-4">
              {reportData.length > 0 ? reportData.map((row, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-8 bg-primary rounded"></div>
                    <div>
                      <p className="font-medium">{row.date}</p>
                      <p className="text-sm text-muted-foreground">
                        {row.sales} venda{row.sales !== 1 ? 's' : ''}{row.machine_name && ` • ${row.machine_name}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">R$ {row.revenue.toFixed(2)}</p>
                    <div className="w-32 h-2 bg-muted rounded overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${Math.min((row.revenue / (totalRevenue || 1)) * 100, 100)}%` }} />
                    </div>
                  </div>
                </div>
              )) : (
                <p className="text-muted-foreground text-center py-8">Nenhum dado encontrado para o período selecionado</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transactions Detail */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhes das Transações</CardTitle>
          <CardDescription>Informações detalhadas sobre pagamentos</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : (
            <div className="space-y-3">
              {transactions.length > 0 ? transactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-6 bg-accent rounded"></div>
                    <div>
                      <p className="font-medium">{transaction.machines.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(transaction.created_at).toLocaleDateString('pt-BR')} às{' '}
                        {new Date(transaction.created_at).toLocaleTimeString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div>
                      {transaction.payment_method === 'manual_release' && (
                        <Badge variant="outline" className="text-xs mb-1 border-amber-500 text-amber-700">
                          Manual{transaction.operator_name ? ` • ${transaction.operator_name}` : ''}
                        </Badge>
                      )}
                      <p className="text-sm text-muted-foreground">{getPaymentLabel(transaction.payment_method)}</p>
                    </div>
                    <p className="font-semibold">R$ {Number(transaction.total_amount).toFixed(2)}</p>
                  </div>
                </div>
              )) : (
                <p className="text-muted-foreground text-center py-8">Nenhuma transação encontrada para o período selecionado</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
