import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Settings, 
  Activity, 
  DollarSign, 
  Users, 
  Droplets, 
  Wind, 
  BarChart3,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Power,
  Wrench,
  LogOut
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Machine {
  id: string;
  name: string;
  type: 'washing' | 'drying';
  status: 'available' | 'in_use' | 'maintenance' | 'offline';
  price_per_kg: number;
  capacity_kg: number;
  location?: string;
  temperature?: number;
  last_maintenance?: string;
  total_uses: number;
  total_revenue: number;
  created_at: string;
  updated_at: string;
}

interface Transaction {
  id: string;
  machine_id: string;
  status: string;
  total_amount: number;
  created_at: string;
}

const Admin = () => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    loadData();
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load machines
      const { data: machinesData, error: machinesError } = await supabase
        .from('machines')
        .select('*')
        .order('name');
      
      if (machinesError) throw machinesError;
      
      // Load recent transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (transactionsError) throw transactionsError;
      
      setMachines((machinesData as Machine[]) || []);
      setTransactions((transactionsData as Transaction[]) || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar dados",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available": return "text-green-600 bg-green-100";
      case "in_use": return "text-blue-600 bg-blue-100";
      case "maintenance": return "text-orange-600 bg-orange-100";
      case "offline": return "text-red-600 bg-red-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "available": return CheckCircle;
      case "in_use": return Activity;
      case "maintenance": return Wrench;
      case "offline": return XCircle;
      default: return AlertTriangle;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "available": return "Disponível";
      case "in_use": return "Em Uso";
      case "maintenance": return "Manutenção";
      case "offline": return "Offline";
      default: return "Desconhecido";
    }
  };

  const handleMachineAction = async (machineId: string, action: string) => {
    const machine = machines.find(m => m.id === machineId);
    if (!machine) return;

    try {
      let newStatus = machine.status;
      
      switch (action) {
        case "start":
          newStatus = "in_use";
          break;
        case "stop":
          newStatus = "available";
          break;
        case "maintenance":
          newStatus = "maintenance";
          break;
        case "reset":
          newStatus = "available";
          break;
      }

      const { error } = await supabase
        .from('machines')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', machineId);

      if (error) throw error;

      // Update local state
      setMachines(prev => prev.map(m => 
        m.id === machineId 
          ? { ...m, status: newStatus }
          : m
      ));

      toast({
        title: "Comando Executado",
        description: `Status da ${machine.name} atualizado para ${getStatusText(newStatus)}`,
      });
    } catch (error) {
      console.error('Error updating machine:', error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar máquina",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Carregando dados...</p>
        </div>
      </div>
    );
  }

  const totalRevenue = machines.reduce((sum, m) => sum + Number(m.total_revenue), 0);
  const totalUses = machines.reduce((sum, m) => sum + m.total_uses, 0);
  const activeUsers = machines.filter(m => m.status === "in_use").length;
  const availableMachines = machines.filter(m => m.status === "available").length;

  // Calculate sales data from transactions
  const salesData = transactions.reduce((acc, transaction) => {
    const date = new Date(transaction.created_at).toLocaleDateString('pt-BR');
    if (!acc[date]) {
      acc[date] = { sales: 0, revenue: 0 };
    }
    acc[date].sales += 1;
    acc[date].revenue += Number(transaction.total_amount);
    return acc;
  }, {} as Record<string, { sales: number; revenue: number }>);

  const salesArray = Object.entries(salesData)
    .map(([date, data]) => ({ date, ...data }))
    .slice(0, 7)
    .reverse();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
      {/* Header */}
      <div className="container mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
              <Settings className="text-primary-foreground" size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Painel Administrativo</h1>
              <p className="text-muted-foreground">Top Lavanderia - Sistema de Gestão</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-sm text-muted-foreground">
                {currentTime.toLocaleDateString('pt-BR')}
              </div>
              <div className="text-lg font-semibold">
                {currentTime.toLocaleTimeString('pt-BR')}
              </div>
            </div>
            <Button onClick={signOut} variant="outline" size="sm">
              <LogOut size={16} className="mr-1" />
              Sair
            </Button>
          </div>
        </div>
      </div>

      {/* Dashboard Cards */}
      <div className="container mx-auto mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
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
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Activity className="text-blue-600" size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total de Usos</p>
                  <p className="text-2xl font-bold">{totalUses}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <Users className="text-orange-600" size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Em Uso</p>
                  <p className="text-2xl font-bold">{activeUsers}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="text-purple-600" size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Disponíveis</p>
                  <p className="text-2xl font-bold">{availableMachines}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto">
        <Tabs defaultValue="machines" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="machines">Máquinas</TabsTrigger>
            <TabsTrigger value="analytics">Relatórios</TabsTrigger>
            <TabsTrigger value="maintenance">Manutenção</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
          </TabsList>

          {/* Máquinas Tab */}
          <TabsContent value="machines" className="space-y-6">
            <div className="grid gap-6">
              {machines.map((machine) => {
                const StatusIcon = getStatusIcon(machine.status);
                return (
                  <Card key={machine.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            machine.type === "washing" ? "bg-blue-100" : "bg-orange-100"
                          }`}>
                            {machine.type === "washing" ? (
                              <Droplets className="text-blue-600" size={20} />
                            ) : (
                              <Wind className="text-orange-600" size={20} />
                            )}
                          </div>
                          <div>
                            <CardTitle className="text-lg">{machine.name}</CardTitle>
                            <CardDescription>{machine.location}</CardDescription>
                          </div>
                        </div>
                        <Badge className={getStatusColor(machine.status)}>
                          <StatusIcon size={14} className="mr-1" />
                          {getStatusText(machine.status)}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Total de Usos</p>
                          <p className="text-lg font-semibold">{machine.total_uses}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Receita</p>
                          <p className="text-lg font-semibold">R$ {Number(machine.total_revenue).toFixed(2)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Capacidade</p>
                          <p className="text-lg font-semibold">{machine.capacity_kg}kg</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Preço/kg</p>
                          <p className="text-lg font-semibold">R$ {Number(machine.price_per_kg).toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        {machine.status === "available" && (
                          <Button
                            onClick={() => handleMachineAction(machine.id, "start")}
                            variant="default"
                            size="sm"
                          >
                            <Power size={16} className="mr-1" />
                            Iniciar
                          </Button>
                        )}
                        {machine.status === "in_use" && (
                          <Button
                            onClick={() => handleMachineAction(machine.id, "stop")}
                            variant="destructive"
                            size="sm"
                          >
                            <Power size={16} className="mr-1" />
                            Parar
                          </Button>
                        )}
                        <Button
                          onClick={() => handleMachineAction(machine.id, "maintenance")}
                          variant="outline"
                          size="sm"
                        >
                          <Wrench size={16} className="mr-1" />
                          Manutenção
                        </Button>
                        <Button
                          onClick={() => handleMachineAction(machine.id, "reset")}
                          variant="outline"
                          size="sm"
                        >
                          <RefreshCw size={16} className="mr-1" />
                          Reset
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="text-primary" />
                    <span>Vendas dos Últimos Dias</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {salesArray.length > 0 ? (
                      salesArray.map((day) => (
                        <div key={day.date} className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-2 h-8 bg-primary rounded"></div>
                            <div>
                              <p className="font-medium">{day.date}</p>
                              <p className="text-sm text-muted-foreground">
                                {day.sales} vendas
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">R$ {day.revenue.toFixed(2)}</p>
                            <div className="w-32 h-2 bg-muted rounded overflow-hidden">
                              <div 
                                className="h-full bg-primary"
                                style={{ width: `${Math.min((day.sales / 25) * 100, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-center py-8">
                        Nenhuma venda registrada ainda
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Maintenance Tab */}
          <TabsContent value="maintenance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Agenda de Manutenção</CardTitle>
                <CardDescription>Status de manutenção das máquinas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {machines.map((machine) => {
                    const lastMaintenance = machine.last_maintenance 
                      ? new Date(machine.last_maintenance)
                      : null;
                    const daysSinceMaintenance = lastMaintenance
                      ? Math.floor((Date.now() - lastMaintenance.getTime()) / (1000 * 60 * 60 * 24))
                      : null;
                    const needsMaintenance = daysSinceMaintenance && daysSinceMaintenance > 30;

                    return (
                      <div key={machine.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${
                            needsMaintenance ? 'bg-red-500' : 'bg-green-500'
                          }`}></div>
                          <div>
                            <p className="font-medium">{machine.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {lastMaintenance 
                                ? `Última manutenção: ${lastMaintenance.toLocaleDateString('pt-BR')}`
                                : 'Nunca passou por manutenção'
                              }
                            </p>
                          </div>
                        </div>
                        <Badge variant={needsMaintenance ? "destructive" : "default"}>
                          {needsMaintenance ? "Manutenção Necessária" : "OK"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configurações do Sistema</CardTitle>
                <CardDescription>Ajustes gerais da lavanderia</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="default-price">Preço padrão por kg (R$)</Label>
                    <Input id="default-price" type="number" step="0.01" defaultValue="5.00" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="default-duration">Duração padrão (min)</Label>
                    <Input id="default-duration" type="number" defaultValue="40" />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Modo automático</p>
                      <p className="text-sm text-muted-foreground">
                        Inicia automaticamente quando detecta carga
                      </p>
                    </div>
                    <Switch />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Notificações</p>
                      <p className="text-sm text-muted-foreground">
                        Alertas por email sobre manutenção
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
                
                <Button className="w-full">
                  Salvar Configurações
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;