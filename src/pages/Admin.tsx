import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Wifi, 
  WifiOff,
  BarChart3,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Power,
  Wrench
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Dados simulados das máquinas
const machinesData = [
  {
    id: "c1-lav",
    name: "Conjunto 1 - Lavadora",
    type: "lavadora",
    ip: "192.168.0.101",
    status: "available",
    totalUses: 47,
    revenue: 846.00,
    lastMaintenance: "2024-01-15",
    currentCycle: null,
    temperature: 45
  },
  {
    id: "c1-sec",
    name: "Conjunto 1 - Secadora", 
    type: "secadora",
    ip: "192.168.0.101",
    status: "running",
    totalUses: 42,
    revenue: 756.00,
    lastMaintenance: "2024-01-12",
    currentCycle: {
      started: "14:30",
      duration: 40,
      remaining: 15
    },
    temperature: 65
  },
  {
    id: "c2-lav",
    name: "Conjunto 2 - Lavadora",
    type: "lavadora", 
    ip: "192.168.0.102",
    status: "available",
    totalUses: 51,
    revenue: 918.00,
    lastMaintenance: "2024-01-10",
    currentCycle: null,
    temperature: 22
  },
  {
    id: "c2-sec",
    name: "Conjunto 2 - Secadora",
    type: "secadora",
    ip: "192.168.0.102", 
    status: "available",
    totalUses: 38,
    revenue: 684.00,
    lastMaintenance: "2024-01-08",
    currentCycle: null,
    temperature: 28
  },
  {
    id: "c3-lav",
    name: "Conjunto 3 - Lavadora",
    type: "lavadora",
    ip: "192.168.0.103",
    status: "maintenance",
    totalUses: 32,
    revenue: 576.00,
    lastMaintenance: "2024-01-20",
    currentCycle: null,
    temperature: 25
  },
  {
    id: "c3-sec",
    name: "Conjunto 3 - Secadora",
    type: "secadora",
    ip: "192.168.0.103",
    status: "offline",
    totalUses: 29,
    revenue: 522.00,
    lastMaintenance: "2024-01-18",
    currentCycle: null,
    temperature: 0
  }
];

// Dados de vendas por dia
const salesData = [
  { date: "2024-01-20", sales: 12, revenue: 216.00 },
  { date: "2024-01-21", sales: 18, revenue: 324.00 },
  { date: "2024-01-22", sales: 15, revenue: 270.00 },
  { date: "2024-01-23", sales: 22, revenue: 396.00 },
  { date: "2024-01-24", sales: 19, revenue: 342.00 },
  { date: "2024-01-25", sales: 25, revenue: 450.00 },
  { date: "2024-01-26", sales: 21, revenue: 378.00 }
];

const Admin = () => {
  const [machines, setMachines] = useState(machinesData);
  const [selectedMachine, setSelectedMachine] = useState<string>("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const { toast } = useToast();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available": return "text-green-600 bg-green-100";
      case "running": return "text-blue-600 bg-blue-100";
      case "maintenance": return "text-orange-600 bg-orange-100";
      case "offline": return "text-red-600 bg-red-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "available": return CheckCircle;
      case "running": return Activity;
      case "maintenance": return Wrench;
      case "offline": return XCircle;
      default: return AlertTriangle;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "available": return "Disponível";
      case "running": return "Em Funcionamento";
      case "maintenance": return "Manutenção";
      case "offline": return "Offline";
      default: return "Desconhecido";
    }
  };

  const handleMachineAction = async (machineId: string, action: string) => {
    const machine = machines.find(m => m.id === machineId);
    if (!machine) return;

    try {
      // Simular chamada para ESP32
      console.log(`Enviando comando ${action} para ${machine.ip}`);
      
      // Atualizar estado local
      setMachines(prev => prev.map(m => 
        m.id === machineId 
          ? { ...m, status: action === "start" ? "running" : action === "stop" ? "available" : action }
          : m
      ));

      toast({
        title: "Comando Enviado",
        description: `${action} executado na ${machine.name}`,
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha na comunicação com a máquina",
        variant: "destructive"
      });
    }
  };

  const totalRevenue = machines.reduce((sum, m) => sum + m.revenue, 0);
  const totalUses = machines.reduce((sum, m) => sum + m.totalUses, 0);
  const activeUsers = machines.filter(m => m.status === "running").length;
  const availableMachines = machines.filter(m => m.status === "available").length;

  return (
    <div className="min-h-screen bg-gradient-clean p-4">
      {/* Header */}
      <div className="container mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center">
              <Settings className="text-primary-foreground" size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Painel Administrativo</h1>
              <p className="text-muted-foreground">Top Lavanderia - Sistema de Gestão</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">
              {currentTime.toLocaleDateString('pt-BR')}
            </div>
            <div className="text-lg font-semibold">
              {currentTime.toLocaleTimeString('pt-BR')}
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Cards */}
      <div className="container mx-auto mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="shadow-card">
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

          <Card className="shadow-card">
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

          <Card className="shadow-card">
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

          <Card className="shadow-card">
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
                  <Card key={machine.id} className="shadow-card">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            machine.type === "lavadora" ? "bg-blue-100" : "bg-orange-100"
                          }`}>
                            {machine.type === "lavadora" ? (
                              <Droplets className="text-blue-600" size={20} />
                            ) : (
                              <Wind className="text-orange-600" size={20} />
                            )}
                          </div>
                          <div>
                            <CardTitle className="text-lg">{machine.name}</CardTitle>
                            <CardDescription>IP: {machine.ip}</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Badge className={getStatusColor(machine.status)}>
                            <StatusIcon size={14} className="mr-1" />
                            {getStatusText(machine.status)}
                          </Badge>
                          {machine.status === "available" || machine.status === "offline" ? (
                            <Wifi className="text-green-500" size={20} />
                          ) : (
                            <WifiOff className="text-red-500" size={20} />
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Total de Usos</p>
                          <p className="text-lg font-semibold">{machine.totalUses}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Receita</p>
                          <p className="text-lg font-semibold">R$ {machine.revenue.toFixed(2)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Temperatura</p>
                          <p className="text-lg font-semibold">{machine.temperature}°C</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Últ. Manutenção</p>
                          <p className="text-lg font-semibold">
                            {new Date(machine.lastMaintenance).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>

                      {machine.currentCycle && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Ciclo em andamento - Iniciado às {machine.currentCycle.started}</span>
                            <span>{machine.currentCycle.remaining} min restantes</span>
                          </div>
                          <Progress 
                            value={((machine.currentCycle.duration - machine.currentCycle.remaining) / machine.currentCycle.duration) * 100}
                            className="h-2"
                          />
                        </div>
                      )}

                      <div className="flex space-x-2">
                        {machine.status === "available" && (
                          <Button
                            onClick={() => handleMachineAction(machine.id, "start")}
                            variant="fresh"
                            size="sm"
                          >
                            <Power size={16} className="mr-1" />
                            Iniciar
                          </Button>
                        )}
                        {machine.status === "running" && (
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
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="text-primary" />
                    <span>Vendas dos Últimos 7 Dias</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {salesData.map((day, index) => (
                      <div key={day.date} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-8 bg-gradient-primary rounded"></div>
                          <div>
                            <p className="font-medium">
                              {new Date(day.date).toLocaleDateString('pt-BR')}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {day.sales} vendas
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">R$ {day.revenue.toFixed(2)}</p>
                          <div className="w-32 h-2 bg-muted rounded overflow-hidden">
                            <div 
                              className="h-full bg-gradient-primary"
                              style={{ width: `${(day.sales / 25) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Maintenance Tab */}
          <TabsContent value="maintenance" className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Agenda de Manutenção</CardTitle>
                <CardDescription>
                  Programe e acompanhe a manutenção das máquinas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {machines.map((machine) => (
                  <div key={machine.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        machine.type === "lavadora" ? "bg-blue-100" : "bg-orange-100"
                      }`}>
                        {machine.type === "lavadora" ? (
                          <Droplets className="text-blue-600" size={16} />
                        ) : (
                          <Wind className="text-orange-600" size={16} />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{machine.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Última: {new Date(machine.lastMaintenance).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={
                        new Date(machine.lastMaintenance) < new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
                          ? "destructive" : "secondary"
                      }>
                        {new Date(machine.lastMaintenance) < new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
                          ? "Atrasada" : "Em dia"}
                      </Badge>
                      <Button variant="outline" size="sm">
                        Agendar
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <div className="grid gap-6">
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>Configurações Gerais</CardTitle>
                  <CardDescription>
                    Configure os parâmetros do sistema
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="price">Preço por kg (R$)</Label>
                        <Input id="price" type="number" defaultValue="18.00" step="0.01" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="duration">Duração padrão (min)</Label>
                        <Input id="duration" type="number" defaultValue="35" />
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-base">Modo Automático</Label>
                          <p className="text-sm text-muted-foreground">
                            Ativar/desativar máquinas automaticamente
                          </p>
                        </div>
                        <Switch defaultChecked />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-base">Notificações Push</Label>
                          <p className="text-sm text-muted-foreground">
                            Receber alertas de status das máquinas
                          </p>
                        </div>
                        <Switch defaultChecked />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-base">Modo Manutenção</Label>
                          <p className="text-sm text-muted-foreground">
                            Bloquear uso de todas as máquinas
                          </p>
                        </div>
                        <Switch />
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t">
                    <Button variant="fresh">
                      Salvar Configurações
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;