import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  Droplets, 
  Wind, 
  Clock, 
  CreditCard, 
  Wifi, 
  CheckCircle, 
  XCircle,
  Timer,
  Sparkles,
  Euro
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Configuração das máquinas baseada no JSON original
const machines = [
  {
    id: "c1-lav",
    type: "lavadora",
    title: "Conjunto 1 - Lavadora",
    price: 18.00,
    ip: "192.168.0.101",
    duration: 35, // minutos
    status: "available", // available, running, maintenance
    icon: Droplets
  },
  {
    id: "c1-sec", 
    type: "secadora",
    title: "Conjunto 1 - Secadora",
    price: 18.00,
    ip: "192.168.0.101",
    duration: 40,
    status: "running",
    icon: Wind,
    timeRemaining: 15
  },
  {
    id: "c2-lav",
    type: "lavadora", 
    title: "Conjunto 2 - Lavadora",
    price: 18.00,
    ip: "192.168.0.102",
    duration: 35,
    status: "available",
    icon: Droplets
  },
  {
    id: "c2-sec",
    type: "secadora",
    title: "Conjunto 2 - Secadora", 
    price: 18.00,
    ip: "192.168.0.102",
    duration: 40,
    status: "available",
    icon: Wind
  },
  {
    id: "c3-lav",
    type: "lavadora",
    title: "Conjunto 3 - Lavadora",
    price: 18.00,
    ip: "192.168.0.103", 
    duration: 35,
    status: "maintenance",
    icon: Droplets
  },
  {
    id: "c3-sec",
    type: "secadora",
    title: "Conjunto 3 - Secadora",
    price: 18.00,
    ip: "192.168.0.103",
    duration: 40,
    status: "available", 
    icon: Wind
  }
];

const Totem = () => {
  const [selectedMachine, setSelectedMachine] = useState<string | null>(null);
  const [paymentStep, setPaymentStep] = useState<"select" | "payment" | "processing" | "success">("select");
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
      case "available": return "bg-green-500";
      case "running": return "bg-blue-500";
      case "maintenance": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "available": return "Disponível";
      case "running": return "Em uso";
      case "maintenance": return "Manutenção";
      default: return "Offline";
    }
  };

  const handleMachineSelect = (machineId: string) => {
    const machine = machines.find(m => m.id === machineId);
    if (machine?.status !== "available") return;
    
    setSelectedMachine(machineId);
    setPaymentStep("payment");
  };

  const handlePayment = async () => {
    setPaymentStep("processing");
    
    // Simular processamento de pagamento
    setTimeout(() => {
      setPaymentStep("success");
      // Chamar API do ESP32 para ativar a máquina
      activateMachine();
    }, 3000);
  };

  const activateMachine = async () => {
    const machine = machines.find(m => m.id === selectedMachine);
    if (!machine) return;

    try {
      // Chamar endpoint do ESP32
      const endpoint = machine.type === "lavadora" ? "/lavadora" : "/secadora";
      const response = await fetch(`http://${machine.ip}${endpoint}`);
      
      if (response.ok) {
        toast({
          title: "Máquina Ativada!",
          description: `${machine.title} iniciada com sucesso`,
        });
      }
    } catch (error) {
      toast({
        title: "Erro de Conexão",
        description: "Não foi possível conectar com a máquina",
        variant: "destructive"
      });
    }

    // Reset após 5 segundos
    setTimeout(() => {
      setSelectedMachine(null);
      setPaymentStep("select");
    }, 5000);
  };

  const resetTotem = () => {
    setSelectedMachine(null);
    setPaymentStep("select");
  };

  if (paymentStep === "processing") {
    return (
      <div className="min-h-screen bg-gradient-clean flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-glow">
          <CardContent className="pt-6 text-center space-y-6">
            <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto animate-pulse">
              <CreditCard className="text-primary-foreground" size={24} />
            </div>
            <h2 className="text-2xl font-bold">Processando Pagamento</h2>
            <p className="text-muted-foreground">Aguarde enquanto processamos seu pagamento...</p>
            <Progress value={66} className="w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (paymentStep === "success") {
    const machine = machines.find(m => m.id === selectedMachine);
    return (
      <div className="min-h-screen bg-gradient-clean flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-glow">
          <CardContent className="pt-6 text-center space-y-6">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="text-white" size={24} />
            </div>
            <h2 className="text-2xl font-bold text-green-600">Pagamento Aprovado!</h2>
            <div className="space-y-2">
              <p className="font-semibold">{machine?.title}</p>
              <p className="text-muted-foreground">
                Tempo estimado: {machine?.duration} minutos
              </p>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Máquina Iniciada
              </Badge>
            </div>
            <Button onClick={resetTotem} variant="fresh" className="w-full">
              Nova Transação
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (paymentStep === "payment" && selectedMachine) {
    const machine = machines.find(m => m.id === selectedMachine);
    return (
      <div className="min-h-screen bg-gradient-clean flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-glow">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <machine.icon className="text-primary-foreground" size={24} />
            </div>
            <CardTitle className="text-xl">{machine?.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center space-x-2">
                <Euro className="text-primary" size={20} />
                <span className="text-3xl font-bold text-primary">
                  {machine?.price.toFixed(2)}
                </span>
              </div>
              <p className="text-muted-foreground">
                Duração: {machine?.duration} minutos
              </p>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-semibold text-center">Formas de Pagamento</h3>
              <div className="grid gap-3">
                <Button 
                  onClick={handlePayment}
                  variant="fresh" 
                  size="lg" 
                  className="justify-start"
                >
                  <CreditCard className="mr-3" />
                  Cartão de Crédito/Débito
                </Button>
                <Button 
                  onClick={handlePayment}
                  variant="clean" 
                  size="lg" 
                  className="justify-start"
                >
                  <Sparkles className="mr-3" />
                  PIX
                </Button>
              </div>
            </div>

            <Button onClick={resetTotem} variant="outline" className="w-full">
              Cancelar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-clean p-4">
      {/* Header */}
      <div className="container mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center">
              <Sparkles className="text-primary-foreground" size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Top Lavanderia</h1>
              <p className="text-muted-foreground">Sistema Automatizado</p>
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

      {/* Status Geral */}
      <div className="container mx-auto mb-8">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-2">
            <div className="text-2xl font-bold text-green-600">
              {machines.filter(m => m.status === "available").length}
            </div>
            <div className="text-sm text-muted-foreground">Disponíveis</div>
          </div>
          <div className="space-y-2">
            <div className="text-2xl font-bold text-blue-600">
              {machines.filter(m => m.status === "running").length}
            </div>
            <div className="text-sm text-muted-foreground">Em Uso</div>
          </div>
          <div className="space-y-2">
            <div className="text-2xl font-bold text-red-600">
              {machines.filter(m => m.status === "maintenance").length}
            </div>
            <div className="text-sm text-muted-foreground">Manutenção</div>
          </div>
        </div>
      </div>

      {/* Grid de Máquinas */}
      <div className="container mx-auto">
        <h2 className="text-2xl font-bold text-center mb-8">
          Selecione uma Máquina
        </h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {machines.map((machine) => {
            const IconComponent = machine.icon;
            const isAvailable = machine.status === "available";
            
            return (
              <Card 
                key={machine.id}
                className={`relative overflow-hidden transition-all duration-300 cursor-pointer ${
                  isAvailable 
                    ? 'hover:shadow-glow hover:scale-105' 
                    : 'opacity-60 cursor-not-allowed'
                }`}
                onClick={() => handleMachineSelect(machine.id)}
              >
                {/* Status Badge */}
                <div className="absolute top-4 right-4">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(machine.status)}`}></div>
                </div>

                <CardHeader className="text-center">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
                    machine.type === "lavadora" ? "bg-blue-100" : "bg-orange-100"
                  }`}>
                    <IconComponent 
                      className={machine.type === "lavadora" ? "text-blue-600" : "text-orange-600"} 
                      size={32} 
                    />
                  </div>
                  <CardTitle className="text-lg">{machine.title}</CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-2 mb-2">
                      <Euro className="text-primary" size={16} />
                      <span className="text-2xl font-bold text-primary">
                        {machine.price.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <Clock className="inline mr-1" size={14} />
                      {machine.duration} minutos
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <Badge 
                      variant={machine.status === "available" ? "default" : "secondary"}
                      className={
                        machine.status === "available" 
                          ? "bg-green-100 text-green-800" 
                          : machine.status === "running"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-red-100 text-red-800"
                      }
                    >
                      {getStatusText(machine.status)}
                    </Badge>
                    
                    {machine.status === "running" && machine.timeRemaining && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Timer size={14} className="mr-1" />
                        {machine.timeRemaining}min
                      </div>
                    )}
                  </div>

                  {machine.status === "running" && machine.timeRemaining && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Progresso</span>
                        <span>{Math.round(((machine.duration - machine.timeRemaining) / machine.duration) * 100)}%</span>
                      </div>
                      <Progress 
                        value={((machine.duration - machine.timeRemaining) / machine.duration) * 100} 
                        className="h-2"
                      />
                    </div>
                  )}

                  {isAvailable && (
                    <Button variant="fresh" className="w-full">
                      Selecionar
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="container mx-auto mt-12 text-center">
        <div className="flex items-center justify-center space-x-2 text-muted-foreground">
          <Wifi size={16} />
          <span className="text-sm">Sistema Online - Suporte: (11) 9999-9999</span>
        </div>
      </div>
    </div>
  );
};

export default Totem;