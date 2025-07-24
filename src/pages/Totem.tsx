import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Droplets, Wind, Clock, CreditCard, Wifi, CheckCircle, XCircle, Timer, Sparkles, DollarSign, Shield, Maximize, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useKioskSecurity } from "@/hooks/useKioskSecurity";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useMachines, type Machine } from "@/hooks/useMachines";
import { useTEFIntegration } from "@/hooks/useTEFIntegration";
import { EnhancedPayGOAdmin } from '@/components/admin/EnhancedPayGOAdmin';
import { usePayGOIntegration, PayGOConfig } from '@/hooks/usePayGOIntegration';
import { DEFAULT_PAYGO_CONFIG } from '@/lib/paygoUtils';
import { SecureTEFConfig } from "@/components/admin/SecureTEFConfig";
import { AdminPinDialog } from "@/components/admin/AdminPinDialog";
import { supabase } from "@/integrations/supabase/client";

// Configuração do TEF Elgin com melhorias
const TEF_CONFIG = {
  host: "127.0.0.1",
  port: "4321",
  timeout: 60000, // Timeout de 60 segundos
  retryAttempts: 3, // Número de tentativas
  retryDelay: 2000 // Delay entre tentativas (2s)
};
const Totem = () => {
  const [selectedMachine, setSelectedMachine] = useState<string | null>(null);
  const [paymentStep, setPaymentStep] = useState<"select" | "payment" | "processing" | "success" | "error">("select");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [tefConfig, setTefConfig] = useState(TEF_CONFIG);
  const [paygoConfig, setPaygoConfig] = useState<PayGOConfig>({ ...DEFAULT_PAYGO_CONFIG, cnpjCpf: '12.345.678/0001-00' });
  const [paymentSystem, setPaymentSystem] = useState<'TEF' | 'PAYGO'>('PAYGO');
  const [showConfig, setShowConfig] = useState(false);
  const [transactionData, setTransactionData] = useState<any>(null);
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [adminClickCount, setAdminClickCount] = useState(0);
  const {
    toast
  } = useToast();
  const {
    isFullscreen,
    securityEnabled,
    enableSecurity,
    disableSecurity
  } = useKioskSecurity();
  const {
    authenticate: adminAuthenticate
  } = useAdminAccess();
  const {
    machines,
    loading,
    error,
    updateMachineStatus
  } = useMachines();
  
  const {
    status: tefStatus,
    isProcessing: tefProcessing,
    processTEFPayment,
    cancelTransaction: cancelTEFTransaction,
    testConnection: testTEFConnection
  } = useTEFIntegration(tefConfig);

  const {
    status: paygoStatus,
    isProcessing: paygoProcessing,
    processPayGOPayment,
    cancelTransaction: cancelPayGOTransaction,
    testConnection: testPayGOConnection
  } = usePayGOIntegration(paygoConfig);
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Ativar modo kiosk automaticamente ao carregar
  useEffect(() => {
    const timer = setTimeout(() => {
      enableSecurity();
    }, 2000); // 2 segundos após carregar

    return () => clearTimeout(timer);
  }, [enableSecurity]);
  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-green-500";
      case "running":
        return "bg-blue-500";
      case "maintenance":
        return "bg-red-500";
      case "offline":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };
  const getStatusText = (status: string) => {
    switch (status) {
      case "available":
        return "Disponível";
      case "running":
        return "Em uso";
      case "maintenance":
        return "Manutenção";
      case "offline":
        return "Offline";
      default:
        return "Desconhecido";
    }
  };
  const handleMachineSelect = (machineId: string) => {
    const machine = machines.find(m => m.id === machineId);
    if (machine?.status !== "available") return;
    setSelectedMachine(machineId);
    setPaymentStep("payment");
  };

  // Gerar número do cupom fiscal
  const generateReceiptNumber = () => {
    return Date.now().toString().slice(-6);
  };

  // Função principal de pagamento via TEF com melhorias
  const handleTEFPayment = async () => {
    const machine = machines.find(m => m.id === selectedMachine);
    if (!machine) return;
    
    setPaymentStep("processing");
    setPaymentSystem('TEF');
    
    try {
      // Preparar dados da transação
      const amount = machine.price * 100; // Converter para centavos
      const transactionParams = {
        transacao: "venda",
        valor: amount.toString(),
        cupomFiscal: generateReceiptNumber(),
        dataHora: new Date().toISOString().slice(0, 19).replace('T', ' '),
        estabelecimento: "Top Lavanderia",
        terminal: "001"
      };

      console.log("Iniciando transação TEF:", transactionParams);

      // Usar o hook melhorado para processar pagamento
      const result = await processTEFPayment(transactionParams);

      if (result && result.retorno === "0") {
        // Transação aprovada
        setTransactionData(result);
        setPaymentStep("success");

        // Ativar a máquina após pagamento aprovado
        await activateMachine('TEF');
        toast({
          title: "Pagamento Aprovado!",
          description: `Transação realizada com sucesso. NSU: ${result.nsu || 'N/A'}`,
          variant: "default"
        });
      } else if (result) {
        // Transação negada
        setPaymentStep("error");
        toast({
          title: "Pagamento Negado",
          description: result.mensagem || "Transação não foi aprovada",
          variant: "destructive"
        });
      } else {
        // Falha total na comunicação
        setPaymentStep("error");
      }
    } catch (error) {
      console.error("Erro crítico na transação TEF:", error);
      setPaymentStep("error");
      toast({
        title: "Erro Crítico",
        description: "Falha grave no sistema de pagamento. Contacte o suporte.",
        variant: "destructive"
      });
    }
  };

  // Função principal de pagamento via PayGO
  const handlePayGOPayment = async () => {
    const machine = machines.find(m => m.id === selectedMachine);
    if (!machine) return;
    
    setPaymentStep("processing");
    setPaymentSystem('PAYGO');
    
    try {
      // Preparar dados da transação PayGO
      const transactionData = {
        amount: machine.price, // PayGO usa valor em reais
        paymentType: 'CREDIT' as const,
        orderId: generateReceiptNumber()
      };

      console.log("Iniciando transação PayGO:", transactionData);

      // Usar o hook do PayGO para processar pagamento
      const result = await processPayGOPayment(transactionData);

      if (result && result.success) {
        // Transação aprovada
        setTransactionData(result);
        setPaymentStep("success");

        // Ativar a máquina após pagamento aprovado
        await activateMachine('PAYGO');
        toast({
          title: "Pagamento Aprovado!",
          description: `Transação realizada com sucesso. NSU: ${result.nsu || 'N/A'}`,
          variant: "default"
        });
      } else {
        // Transação negada
        setPaymentStep("error");
        toast({
          title: "Pagamento Negado",
          description: result?.resultMessage || "Transação não foi aprovada",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Erro crítico na transação PayGO:", error);
      setPaymentStep("error");
      toast({
        title: "Erro Crítico",
        description: "Falha grave no sistema de pagamento. Contacte o suporte.",
        variant: "destructive"
      });
    }
  };
  const activateMachine = async (paymentMethod: string = 'TEF') => {
    const machine = machines.find(m => m.id === selectedMachine);
    if (!machine) return;
    try {
      // Atualizar status da máquina para "running"
      await updateMachineStatus(machine.id, 'running');

      // Criar transação no banco
      const {
        error: transactionError
      } = await supabase.from('transactions').insert({
        machine_id: machine.id,
        total_amount: machine.price, // Usar o preço já calculado da interface Machine
        duration_minutes: machine.duration,
        status: 'completed',
        payment_method: paymentMethod,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      });
      if (transactionError) {
        console.error('Erro ao criar transação:', transactionError);
      }

      // Chamar endpoint do ESP32 se tiver IP (mock implementation)
      try {
        // Simular chamada para ESP32 - na implementação real seria uma chamada HTTP
        console.log(`Ativando máquina ${machine.name} via ESP32 ${machine.esp32_id}`);
        // await fetch(`http://esp32-host:port/activate/${machine.relay_pin}`)
      } catch (error) {
        console.warn("Erro na comunicação com ESP32, mas máquina foi ativada no sistema:", error);
      }
    } catch (error) {
      console.error("Erro ao ativar máquina:", error);
      toast({
        title: "Atenção",
        description: "Pagamento aprovado, mas houve erro na ativação da máquina. Contacte o suporte.",
        variant: "destructive"
      });
    }
  };
  const resetTotem = () => {
    setSelectedMachine(null);
    setPaymentStep("select");
    setTransactionData(null);
  };

  // Função para acesso administrativo oculto
  const handleAdminAccess = () => {
    const newCount = adminClickCount + 1;
    setAdminClickCount(newCount);
    if (newCount >= 7) {
      // 7 cliques rápidos para ativar
      setShowAdminDialog(true);
      setAdminClickCount(0);
    }

    // Reset contador após 3 segundos
    setTimeout(() => {
      setAdminClickCount(0);
    }, 3000);
  };
  const handleAdminAuthenticate = (pin: string) => {
    const success = adminAuthenticate(pin);
    if (success) {
      toast({
        title: "Modo Administrativo",
        description: "Segurança desativada temporariamente",
        variant: "default"
      });
      disableSecurity();
      setShowConfig(true);
    }
    return success;
  };

  // Tela de configuração TEF segura
  if (showConfig) {
    return <SecureTEFConfig config={tefConfig} onConfigChange={setTefConfig} onClose={() => setShowConfig(false)} />;
  }

  // Mostrar loading enquanto carrega máquinas
  if (loading) {
    return <div className="min-h-screen bg-gradient-clean flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="mx-auto animate-spin text-primary" size={48} />
          <h2 className="text-xl font-semibold">Carregando máquinas...</h2>
          <p className="text-muted-foreground">Conectando com o sistema</p>
        </div>
      </div>;
  }

  // Tela de processamento
  if (paymentStep === "processing") {
    return <div className="min-h-screen bg-gradient-clean flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-glow">
          <CardContent className="pt-6 text-center space-y-6">
            <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto animate-pulse">
              <CreditCard className="text-primary-foreground" size={24} />
            </div>
            <h2 className="text-2xl font-bold">Processando Pagamento</h2>
            <p className="text-muted-foreground">
              Passe ou insira o cartão na maquininha...<br />
              Aguarde a conclusão da transação.
            </p>
            <Progress value={50} className="w-full" />
            <div className="flex space-x-2">
              <Button 
                onClick={paymentSystem === 'TEF' ? cancelTEFTransaction : cancelPayGOTransaction} 
                variant="outline" 
                className="flex-1"
              >
                Cancelar {paymentSystem}
              </Button>
              <Button onClick={resetTotem} variant="destructive" className="flex-1">
                Cancelar Tudo
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>;
  }

  // Tela de erro
  if (paymentStep === "error") {
    return <div className="min-h-screen bg-gradient-clean flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-glow">
          <CardContent className="pt-6 text-center space-y-6">
            <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto">
              <XCircle className="text-white" size={24} />
            </div>
            <h2 className="text-2xl font-bold text-red-600">Pagamento Negado</h2>
            <p className="text-muted-foreground">
              A transação não foi aprovada. Tente novamente ou use outro cartão.
            </p>
            <div className="flex space-x-2">
              <Button onClick={() => setPaymentStep("payment")} variant="fresh" className="flex-1">
                Tentar Novamente
              </Button>
              <Button onClick={resetTotem} variant="outline" className="flex-1">
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>;
  }

  // Tela de sucesso
  if (paymentStep === "success") {
    const machine = machines.find(m => m.id === selectedMachine);
    return <div className="min-h-screen bg-gradient-clean flex items-center justify-center p-4">
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
              {transactionData && <div className="text-sm space-y-1 border-t pt-4">
                  <p><strong>NSU:</strong> {transactionData.nsu || 'N/A'}</p>
                  <p><strong>Autorização:</strong> {transactionData.autorizacao || 'N/A'}</p>
                  <p><strong>Cartão:</strong> **** **** **** {transactionData.ultimosDigitos || '****'}</p>
                </div>}
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Máquina Iniciada
              </Badge>
            </div>
            <Button onClick={resetTotem} variant="fresh" className="w-full">
              Nova Transação
            </Button>
          </CardContent>
        </Card>
      </div>;
  }

  // Tela de seleção de pagamento
  if (paymentStep === "payment" && selectedMachine) {
    const machine = machines.find(m => m.id === selectedMachine);
    return <div className="min-h-screen bg-gradient-clean flex items-center justify-center p-4">
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
                <DollarSign className="text-primary" size={20} />
                <span className="text-3xl font-bold text-primary">
                  R$ {machine?.price.toFixed(2).replace('.', ',')}
                </span>
              </div>
              <p className="text-muted-foreground">
                Duração: {machine?.duration} minutos
              </p>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-semibold text-center">Forma de Pagamento</h3>
              
              {/* PayGO Payment Option */}
              <Button 
                onClick={handlePayGOPayment} 
                variant="fresh" 
                size="lg" 
                className="w-full justify-start"
                disabled={!paygoStatus.online}
              >
                <CreditCard className="mr-3" />
                Cartão PayGO {paygoStatus.online ? '' : '(Offline)'}
              </Button>
              
              {/* TEF Payment Option */}
              <Button 
                onClick={handleTEFPayment} 
                variant="outline" 
                size="lg" 
                className="w-full justify-start"
                disabled={!tefStatus.isOnline}
              >
                <CreditCard className="mr-3" />
                Cartão TEF {tefStatus.isOnline ? '' : '(Offline)'}
              </Button>
              
              <p className="text-xs text-muted-foreground text-center">
                Passe ou insira seu cartão na maquininha para efetuar o pagamento
              </p>
            </div>

            <Button onClick={resetTotem} variant="outline" className="w-full">
              Cancelar
            </Button>
          </CardContent>
        </Card>
      </div>;
  }

  // Tela principal
  return <div className="min-h-screen bg-gradient-clean p-4">
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
          <div className="flex items-center space-x-4">
            {/* Indicador de Segurança */}
            <div className="flex items-center space-x-2">
              {/* Indicador TEF */}
              <div className={`flex items-center space-x-1 rounded-lg px-2 py-1 ${
                tefStatus.isOnline 
                  ? 'text-green-600 bg-green-50' 
                  : 'text-red-600 bg-red-50'
              }`}>
                <CreditCard size={14} />
                <span className="text-xs font-medium">
                  TEF {tefStatus.isOnline ? 'Online' : 'Offline'}
                </span>
              </div>

              {/* Indicador PayGO */}
              <div className={`flex items-center space-x-1 rounded-lg px-2 py-1 ${
                paygoStatus.online 
                  ? 'text-green-600 bg-green-50' 
                  : 'text-red-600 bg-red-50'
              }`}>
                <CreditCard size={14} />
                <span className="text-xs font-medium">
                  PayGO {paygoStatus.online ? 'Online' : 'Offline'}
                </span>
              </div>

              {securityEnabled ? <div className="flex items-center space-x-1 text-green-600 bg-green-50 rounded-lg px-2 py-1">
                  <Shield size={14} />
                  <span className="text-xs font-medium">Seguro</span>
                </div> : <div className="flex items-center space-x-1 text-orange-600 bg-orange-50 rounded-lg px-2 py-1">
                  <Shield size={14} />
                  <span className="text-xs font-medium">Desbloqueado</span>
                </div>}
              
              {!isFullscreen && <div className="flex items-center space-x-1 text-blue-600 bg-blue-50 rounded-lg px-2 py-1">
                  <Maximize size={14} />
                  <span className="text-xs font-medium">Janela</span>
                </div>}
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
        {/* Lavadoras */}
        <div className="mb-12">
          <div className="flex items-center justify-center mb-8 space-x-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Droplets className="text-blue-600" size={24} />
            </div>
            <h2 className="text-2xl font-bold text-center">
              Lavadoras
            </h2>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {machines.filter(machine => machine.type === "lavadora").map(machine => {
            const IconComponent = machine.icon;
            const isAvailable = machine.status === "available";
            return <Card key={machine.id} className={`relative overflow-hidden transition-all duration-300 cursor-pointer ${isAvailable ? 'hover:shadow-glow hover:scale-105' : 'opacity-60 cursor-not-allowed'}`} onClick={() => handleMachineSelect(machine.id)}>
                  {/* Status Badge */}
                  <div className="absolute top-4 right-4">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(machine.status)}`}></div>
                  </div>

                  <CardHeader className="text-center">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <IconComponent className="text-blue-600" size={32} />
                    </div>
                    <CardTitle className="text-lg">{machine.title}</CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-2 mb-2">
                        <DollarSign className="text-primary" size={16} />
                        <span className="text-2xl font-bold text-primary">
                          R$ {machine.price.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        <Clock className="inline mr-1" size={14} />
                        {machine.duration} minutos
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <Badge variant={machine.status === "available" ? "default" : "secondary"} className={machine.status === "available" ? "bg-green-100 text-green-800" : machine.status === "running" ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-800"}>
                        {getStatusText(machine.status)}
                      </Badge>
                      
                      {machine.status === "running" && machine.timeRemaining && <div className="flex items-center text-sm text-muted-foreground">
                          <Timer size={14} className="mr-1" />
                          {machine.timeRemaining}min
                        </div>}
                    </div>

                    {machine.status === "running" && machine.timeRemaining && <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Progresso</span>
                          <span>{Math.round((machine.duration - machine.timeRemaining) / machine.duration * 100)}%</span>
                        </div>
                        <Progress value={(machine.duration - machine.timeRemaining) / machine.duration * 100} className="h-2" />
                      </div>}

                    {isAvailable && <Button variant="fresh" className="w-full">
                        Selecionar
                      </Button>}
                  </CardContent>
                </Card>;
          })}
          </div>
        </div>

        {/* Secadoras */}
        <div>
          <div className="flex items-center justify-center mb-8 space-x-3">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <Wind className="text-orange-600" size={24} />
            </div>
            <h2 className="text-2xl font-bold text-center">
              Secadoras
            </h2>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {machines.filter(machine => machine.type === "secadora").map(machine => {
            const IconComponent = machine.icon;
            const isAvailable = machine.status === "available";
            return <Card key={machine.id} className={`relative overflow-hidden transition-all duration-300 cursor-pointer ${isAvailable ? 'hover:shadow-glow hover:scale-105' : 'opacity-60 cursor-not-allowed'}`} onClick={() => handleMachineSelect(machine.id)}>
                  {/* Status Badge */}
                  <div className="absolute top-4 right-4">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(machine.status)}`}></div>
                  </div>

                  <CardHeader className="text-center">
                    <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <IconComponent className="text-orange-600" size={32} />
                    </div>
                    <CardTitle className="text-lg">{machine.title}</CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-2 mb-2">
                        <DollarSign className="text-primary" size={16} />
                        <span className="text-2xl font-bold text-primary">
                          R$ {machine.price.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        <Clock className="inline mr-1" size={14} />
                        {machine.duration} minutos
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <Badge variant={machine.status === "available" ? "default" : "secondary"} className={machine.status === "available" ? "bg-green-100 text-green-800" : machine.status === "running" ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-800"}>
                        {getStatusText(machine.status)}
                      </Badge>
                      
                      {machine.status === "running" && machine.timeRemaining && <div className="flex items-center text-sm text-muted-foreground">
                          <Timer size={14} className="mr-1" />
                          {machine.timeRemaining}min
                        </div>}
                    </div>

                    {machine.status === "running" && machine.timeRemaining && <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Progresso</span>
                          <span>{Math.round((machine.duration - machine.timeRemaining) / machine.duration * 100)}%</span>
                        </div>
                        <Progress value={(machine.duration - machine.timeRemaining) / machine.duration * 100} className="h-2" />
                      </div>}

                    {isAvailable && <Button variant="fresh" className="w-full">
                        Selecionar
                      </Button>}
                  </CardContent>
                </Card>;
          })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="container mx-auto mt-12 text-center">
        <div className="flex items-center justify-center space-x-2 text-muted-foreground">
          <Wifi size={16} />
          <span className="text-sm cursor-pointer select-none" onClick={handleAdminAccess}>
            Sistema Online - Suporte: (11) 9999-9999
          </span>
        </div>
      </div>

      {/* Admin Access Dialog */}
      <AdminPinDialog open={showAdminDialog} onOpenChange={setShowAdminDialog} onAuthenticate={handleAdminAuthenticate} title="Acesso Administrativo" description="Desativar temporariamente as medidas de segurança do kiosk" />
    </div>;
};
export default Totem;