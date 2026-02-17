import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLaundry } from "@/contexts/LaundryContext";
import { LaundrySelector } from "@/components/admin/LaundrySelector";
import { LaundryManagement } from "@/components/admin/LaundryManagement";
import { UserManagement } from "@/components/admin/UserManagement";
import { AuditLogsTab } from "@/components/admin/AuditLogsTab";
import { SecurityEventsTab } from "@/components/admin/SecurityEventsTab";
import { ConsolidatedReportsTab } from "@/components/admin/ConsolidatedReportsTab";
import { NotificationsWidget } from "@/components/admin/NotificationsWidget";
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
import ESP32MonitorTab from "@/components/admin/ESP32MonitorTab";
import ESP32FailoverManager from "@/components/admin/ESP32FailoverManager";
import CreditReleaseWidget from "@/components/admin/CreditReleaseWidget";
import { PayGOSetupGuide } from '@/components/payment/PayGOSetupGuide';
import { EnhancedPayGOAdmin } from "@/components/admin/EnhancedPayGOAdmin";
import { DEFAULT_PAYGO_CONFIG } from "@/lib/paygoUtils";
import { useTransactionNFSe } from '@/hooks/useTransactionNFSe';
import { TEFPositivoL4Config } from "@/components/admin/TEFPositivoL4Config";
import { USBDiagnosticsTab } from "@/components/admin/USBDiagnosticsTab";
import { SupabaseDebug } from "@/components/debug/SupabaseDebug";

interface Machine {
  id: string;
  name: string;
  type: 'washing' | 'drying';
  status: 'available' | 'in_use' | 'maintenance' | 'offline';
  price_per_cycle: number;
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
  const { currentLaundry, isSuperAdmin, loading: laundryLoading } = useLaundry();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [paygoConfig, setPaygoConfig] = useState(DEFAULT_PAYGO_CONFIG);
  const [showPaygoAdmin, setShowPaygoAdmin] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Initialize NFSe automation
  useTransactionNFSe();

  useEffect(() => {
    checkAuth();
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!laundryLoading && currentLaundry) {
      loadData();
    }
  }, [currentLaundry, laundryLoading]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    loadData();
  };

  const loadData = async () => {
    if (!currentLaundry) return;

    try {
      setLoading(true);
      
      // Load machines filtradas por lavanderia
      const { data: machinesData, error: machinesError } = await supabase
        .from('machines')
        .select('*')
        .eq('laundry_id', currentLaundry.id)
        .order('name');
      
      if (machinesError) throw machinesError;
      
      // Load recent transactions filtradas por lavanderia
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .eq('laundry_id', currentLaundry.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (transactionsError) throw transactionsError;

      // Load PayGO configuration
      await loadPaygoConfig();
      
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

  const loadPaygoConfig = async () => {
    if (!currentLaundry) return;

    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('paygo_host, paygo_port, paygo_automation_key, paygo_cnpj_cpf, paygo_timeout, paygo_retry_attempts, paygo_retry_delay, paygo_enabled')
        .eq('laundry_id', currentLaundry.id)
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setPaygoConfig({
          host: data.paygo_host || DEFAULT_PAYGO_CONFIG.host,
          port: data.paygo_port || DEFAULT_PAYGO_CONFIG.port,
          automationKey: data.paygo_automation_key || DEFAULT_PAYGO_CONFIG.automationKey,
          cnpjCpf: data.paygo_cnpj_cpf || DEFAULT_PAYGO_CONFIG.cnpjCpf,
          timeout: data.paygo_timeout || DEFAULT_PAYGO_CONFIG.timeout,
          retryAttempts: data.paygo_retry_attempts || DEFAULT_PAYGO_CONFIG.retryAttempts,
          retryDelay: data.paygo_retry_delay || DEFAULT_PAYGO_CONFIG.retryDelay,
        });
      }
    } catch (error) {
      console.error('Error loading PayGO config:', error);
    }
  };

  const savePaygoConfig = async (newConfig: typeof paygoConfig) => {
    if (!currentLaundry) return;

    try {
      // Check if a row exists for this laundry
      const { data: existing } = await supabase
        .from('system_settings')
        .select('id')
        .eq('laundry_id', currentLaundry.id)
        .limit(1)
        .maybeSingle();

      const paygoData = {
        laundry_id: currentLaundry.id,
        paygo_host: newConfig.host,
        paygo_port: newConfig.port,
        paygo_automation_key: newConfig.automationKey,
        paygo_cnpj_cpf: newConfig.cnpjCpf,
        paygo_timeout: newConfig.timeout,
        paygo_retry_attempts: newConfig.retryAttempts,
        paygo_retry_delay: newConfig.retryDelay,
        paygo_enabled: true,
        updated_at: new Date().toISOString(),
      };

      let error;
      if (existing) {
        // Update existing row
        ({ error } = await supabase
          .from('system_settings')
          .update(paygoData)
          .eq('id', existing.id));
      } else {
        // Insert new row
        ({ error } = await supabase
          .from('system_settings')
          .insert(paygoData));
      }

      if (error) throw error;

      setPaygoConfig(newConfig);
      
      toast({
        title: "Configuração Salva",
        description: "Configurações PayGO foram salvas com sucesso",
      });
    } catch (error) {
      console.error('Error saving PayGO config:', error);
      toast({
        title: "Erro",
        description: "Falha ao salvar configurações PayGO",
        variant: "destructive"
      });
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

  if (loading || laundryLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Carregando dados...</p>
        </div>
      </div>
    );
  }

  if (!currentLaundry) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Sem Acesso</CardTitle>
            <CardDescription>
              Você não possui acesso a nenhuma lavanderia. Entre em contato com o administrador.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={signOut} className="w-full">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </CardContent>
        </Card>
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
              <p className="text-muted-foreground">Top Lavanderia - Sistema Multi-Tenant</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <NotificationsWidget />
            <LaundrySelector />
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
          <TabsList className="grid w-full grid-cols-12 lg:grid-cols-15">
            <TabsTrigger value="machines">Máquinas</TabsTrigger>
            <TabsTrigger value="analytics">Relatórios</TabsTrigger>
            {isSuperAdmin && <TabsTrigger value="consolidated">Consolidado</TabsTrigger>}
            <TabsTrigger value="maintenance">Manutenção</TabsTrigger>
            <TabsTrigger value="audit">Auditoria</TabsTrigger>
            <TabsTrigger value="security">Segurança</TabsTrigger>
            <TabsTrigger value="esp32">ESP32</TabsTrigger>
            <TabsTrigger value="failover">Failover</TabsTrigger>
            <TabsTrigger value="paygo">PayGO</TabsTrigger>
            <TabsTrigger value="tef">TEF L4</TabsTrigger>
            <TabsTrigger value="usb">USB</TabsTrigger>
            <TabsTrigger value="debug">Debug</TabsTrigger>
            {isSuperAdmin && <TabsTrigger value="laundries">Lavanderias</TabsTrigger>}
            {isSuperAdmin && <TabsTrigger value="users">Usuários</TabsTrigger>}
            <TabsTrigger value="settings">Config</TabsTrigger>
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
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Preço/ciclo</p>
                          <p className="text-lg font-semibold">R$ {Number(machine.price_per_cycle).toFixed(2)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Tempo Ciclo</p>
                          <p className="text-lg font-semibold">{machine.cycle_time_minutes || 40}min</p>
                        </div>
                      </div>

                      <div className="flex space-x-2 flex-wrap">
                        {machine.status === "available" && (
                          <Button
                            size="sm"
                            onClick={() => handleMachineAction(machine.id, "start")}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Power size={14} className="mr-1" />
                            Iniciar
                          </Button>
                        )}
                        
                        {machine.status === "in_use" && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleMachineAction(machine.id, "stop")}
                          >
                            <Power size={14} className="mr-1" />
                            Parar
                          </Button>
                        )}
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMachineAction(machine.id, "maintenance")}
                        >
                          <Wrench size={14} className="mr-1" />
                          Manutenção
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMachineAction(machine.id, "reset")}
                        >
                          <RefreshCw size={14} className="mr-1" />
                          Reset
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive">
                              <Trash2 size={14} className="mr-1" />
                              Excluir
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir a máquina "{machine.name}"? Esta ação não pode ser desfeita.
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

          {/* Consolidated Reports Tab - Only for Super Admin */}
          {isSuperAdmin && (
            <TabsContent value="consolidated">
              <ConsolidatedReportsTab />
            </TabsContent>
          )}

          {/* Maintenance Tab */}
          <TabsContent value="maintenance">
            <MaintenanceTab />
          </TabsContent>

          {/* Audit Logs Tab */}
          <TabsContent value="audit">
            <AuditLogsTab />
          </TabsContent>

          {/* Security Events Tab */}
          <TabsContent value="security">
            <SecurityEventsTab />
          </TabsContent>

          {/* ESP32 Tab */}
          <TabsContent value="esp32">
            <ESP32MonitorTab />
          </TabsContent>

          {/* Failover Tab */}
          <TabsContent value="failover">
            <ESP32FailoverManager />
          </TabsContent>

          {/* PayGO Tab */}
          <TabsContent value="paygo" className="space-y-6">
            {showPaygoAdmin ? (
              <EnhancedPayGOAdmin
                config={paygoConfig}
                onConfigChange={savePaygoConfig}
                onClose={() => setShowPaygoAdmin(false)}
              />
            ) : (
              <div className="grid gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Sistema PayGO</CardTitle>
                    <CardDescription>
                      Integração com sistema PayGO para processamento de pagamentos
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-4">
                      <h3 className="font-medium text-primary">PayGO - Sistema Integrado</h3>
                      <p className="text-sm text-muted-foreground">
                        Sistema PayGO configurado e pronto para uso. Use o widget de pagamento universal no totem.
                      </p>
                      <div className="bg-success/10 p-4 rounded-lg">
                        <div className="flex items-center gap-2 text-success">
                          <CheckCircle className="h-5 w-5" />
                          <span className="font-medium">Pronto para usar no Totem</span>
                        </div>
                        <p className="text-sm text-success mt-2">
                          Acesse /totem para usar o widget universal de pagamentos
                        </p>
                      </div>
                    </div>
                    <CreditReleaseWidget />
                    <Button
                      onClick={() => setShowPaygoAdmin(true)}
                      className="w-full"
                    >
                      Acessar Painel PayGO
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* TEF L4 Tab */}
          <TabsContent value="tef">
            <TEFPositivoL4Config />
          </TabsContent>

          {/* USB Diagnostics Tab */}
          <TabsContent value="usb">
            <USBDiagnosticsTab />
          </TabsContent>

          {/* Debug Tab */}
          <TabsContent value="debug">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Debug Supabase</h2>
              </div>
              <SupabaseDebug />
            </div>
          </TabsContent>

          {/* Laundries Tab - Only for Super Admin */}
          {isSuperAdmin && (
            <TabsContent value="laundries">
              <LaundryManagement />
            </TabsContent>
          )}

          {/* Users Tab - Only for Super Admin */}
          {isSuperAdmin && (
            <TabsContent value="users">
              <UserManagement />
            </TabsContent>
          )}

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