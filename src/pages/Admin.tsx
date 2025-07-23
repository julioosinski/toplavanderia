import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { 
  Settings, 
  Activity, 
  DollarSign, 
  Users, 
  Droplets, 
  Wind, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Power,
  Wrench,
  LogOut,
  Trash2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MachineDialog } from "@/components/admin/MachineDialog";
import { ReportsTab } from "@/components/admin/ReportsTab";
import { MaintenanceTab } from "@/components/admin/MaintenanceTab";
import { SettingsTab } from "@/components/admin/SettingsTab";

interface Machine {
  id: string;
  name: string;
  type: 'washing' | 'drying';
  status: 'available' | 'in_use' | 'maintenance' | 'offline';
  price_per_kg: number;
  capacity_kg: number;
  cycle_time_minutes?: number;
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

  const handleDeleteMachine = async (machineId: string) => {
    try {
      const { error } = await supabase
        .from('machines')
        .delete()
        .eq('id', machineId);

      if (error) throw error;

      setMachines(prev => prev.filter(m => m.id !== machineId));

      toast({
        title: "Máquina excluída",
        description: "A máquina foi removida com sucesso",
      });
    } catch (error) {
      console.error('Error deleting machine:', error);
      toast({
        title: "Erro",
        description: "Falha ao excluir máquina",
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
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Gerenciar Máquinas</h2>
              <MachineDialog onSuccess={loadData} />
            </div>
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
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Tempo Ciclo</p>
                          <p className="text-lg font-semibold">{machine.cycle_time_minutes || 40}min</p>
                        </div>
                      </div>

                      <div className="flex space-x-2 flex-wrap">
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
                        <MachineDialog 
                          machine={machine} 
                          onSuccess={loadData}
                          trigger={
                            <Button variant="outline" size="sm">
                              <Settings size={16} className="mr-1" />
                              Editar
                            </Button>
                          }
                        />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 size={16} className="mr-1" />
                              Excluir
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir a máquina "{machine.name}"? 
                                Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDeleteMachine(machine.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <ReportsTab />
          </TabsContent>

          {/* Maintenance Tab */}
          <TabsContent value="maintenance">
            <MaintenanceTab />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <SettingsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;