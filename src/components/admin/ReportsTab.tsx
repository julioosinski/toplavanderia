import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Calendar, TrendingUp, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Transaction {
  id: string;
  machine_id: string;
  total_amount: number;
  created_at: string;
  machines: {
    name: string;
  };
}

interface ReportData {
  date: string;
  sales: number;
  revenue: number;
  machine_name?: string;
}

export const ReportsTab = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    machineId: 'all',
    reportType: 'daily'
  });
  const { toast } = useToast();

  useEffect(() => {
    loadMachines();
    generateReport();
  }, []);

  const loadMachines = async () => {
    const { data, error } = await supabase
      .from('machines')
      .select('id, name')
      .order('name');
    
    if (!error && data) {
      setMachines(data);
    }
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('transactions')
        .select(`
          id,
          machine_id,
          total_amount,
          created_at,
          machines!inner(name)
        `)
        .gte('created_at', filters.startDate + 'T00:00:00')
        .lte('created_at', filters.endDate + 'T23:59:59')
        .order('created_at', { ascending: false });

      if (filters.machineId !== 'all') {
        query = query.eq('machine_id', filters.machineId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const transactions = data as Transaction[];
      setTransactions(transactions);

      // Process data based on report type
      const groupedData: Record<string, ReportData> = {};

      transactions.forEach(transaction => {
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
          groupedData[key] = {
            date: key,
            sales: 0,
            revenue: 0,
            machine_name: filters.machineId !== 'all' ? transaction.machines.name : undefined
          };
        }

        groupedData[key].sales += 1;
        groupedData[key].revenue += Number(transaction.total_amount);
      });

      const reportArray = Object.values(groupedData).sort((a, b) => {
        if (filters.reportType === 'monthly') {
          return b.date.localeCompare(a.date);
        }
        return new Date(b.date.split('/').reverse().join('-')).getTime() - 
               new Date(a.date.split('/').reverse().join('-')).getTime();
      });

      setReportData(reportArray);
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Erro",
        description: "Falha ao gerar relatório",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    const headers = ['Data', 'Vendas', 'Receita'];
    if (filters.machineId !== 'all') {
      headers.push('Máquina');
    }

    const csvContent = [
      headers.join(','),
      ...reportData.map(row => [
        row.date,
        row.sales,
        `R$ ${row.revenue.toFixed(2)}`,
        ...(row.machine_name ? [row.machine_name] : [])
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalSales = reportData.reduce((sum, row) => sum + row.sales, 0);
  const totalRevenue = reportData.reduce((sum, row) => sum + row.revenue, 0);
  const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="text-primary" />
            <span>Filtros do Relatório</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Data Inicial</Label>
              <Input
                id="startDate"
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Data Final</Label>
              <Input
                id="endDate"
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="machine">Máquina</Label>
              <Select 
                value={filters.machineId} 
                onValueChange={(value) => setFilters({ ...filters, machineId: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as máquinas</SelectItem>
                  {machines.map(machine => (
                    <SelectItem key={machine.id} value={machine.id}>
                      {machine.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reportType">Tipo de Relatório</Label>
              <Select 
                value={filters.reportType} 
                onValueChange={(value) => setFilters({ ...filters, reportType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diário</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={generateReport} disabled={loading}>
              {loading ? "Gerando..." : "Gerar Relatório"}
            </Button>
            <Button onClick={exportReport} variant="outline" disabled={reportData.length === 0}>
              <Download size={16} className="mr-1" />
              Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <TrendingUp className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Vendas</p>
                <p className="text-2xl font-bold">{totalSales}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <BarChart3 className="text-blue-600" size={24} />
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
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Calendar className="text-purple-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ticket Médio</p>
                <p className="text-2xl font-bold">R$ {averageTicket.toFixed(2)}</p>
              </div>
            </div>
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
          <div className="space-y-4">
            {reportData.length > 0 ? (
              reportData.map((row, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-8 bg-primary rounded"></div>
                    <div>
                      <p className="font-medium">{row.date}</p>
                      <p className="text-sm text-muted-foreground">
                        {row.sales} venda{row.sales !== 1 ? 's' : ''}
                        {row.machine_name && ` • ${row.machine_name}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">R$ {row.revenue.toFixed(2)}</p>
                    <div className="w-32 h-2 bg-muted rounded overflow-hidden">
                      <div 
                        className="h-full bg-primary"
                        style={{ width: `${Math.min((row.revenue / (totalRevenue || 1)) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Nenhum dado encontrado para o período selecionado
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};