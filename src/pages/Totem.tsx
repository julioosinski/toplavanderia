import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Droplets, Wind, Clock, CreditCard, Wifi, CheckCircle, XCircle, Timer, Sparkles, DollarSign, Shield, Maximize, Loader2, QrCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useKioskSecurity } from "@/hooks/useKioskSecurity";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useMachines, type Machine } from "@/hooks/useMachines";
import { useTEFIntegration } from "@/hooks/useTEFIntegration";
import { useCapacitorIntegration } from "@/hooks/useCapacitorIntegration";
import { EnhancedPayGOAdmin } from '@/components/admin/EnhancedPayGOAdmin';
import { usePayGOIntegration, PayGOConfig } from '@/hooks/usePayGOIntegration';
import { usePixPayment } from '@/hooks/usePixPayment';
import { PixQRDisplay } from '@/components/payment/PixQRDisplay';
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
  const [paymentStep, setPaymentStep] = useState<"select" | "payment" | "processing" | "success" | "error" | "pix_qr">("select");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [tefConfig, setTefConfig] = useState(TEF_CONFIG);
  const [paygoConfig, setPaygoConfig] = useState<PayGOConfig>({ ...DEFAULT_PAYGO_CONFIG, cnpjCpf: '12.345.678/0001-00' });
  const [paymentSystem, setPaymentSystem] = useState<'TEF' | 'PAYGO' | 'PIX'>('PAYGO');
  const [showConfig, setShowConfig] = useState(false);
  const [transactionData, setTransactionData] = useState<any>(null);
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [adminClickCount, setAdminClickCount] = useState(0);
  const [pixPaymentData, setPixPaymentData] = useState<any>(null);
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
    isNative,
    deviceInfo,
    isReady,
    enableKioskMode,
    disableKioskMode
  } = useCapacitorIntegration();
  
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
    processPixPayment,
    checkPixPaymentStatus,
    cancelTransaction: cancelPayGOTransaction,
    testConnection: testPayGOConnection
  } = usePayGOIntegration(paygoConfig);

  const {
    generatePixQR,
    startPixPolling,
    cancelPixPayment,
    currentPayment: pixCurrentPayment,
    isGeneratingQR,
    isPolling: pixPolling,
    timeRemaining: pixTimeRemaining,
    formatTime: formatPixTime,
  } = usePixPayment(paygoConfig);
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
      if (isNative && isReady) {
        enableKioskMode();
      }
    }, 2000); // 2 segundos após carregar

    return () => clearTimeout(timer);
  }, [enableSecurity, isNative, isReady, enableKioskMode]);

  // Mostrar informações do dispositivo no console para debug
  useEffect(() => {
    if (isNative && deviceInfo) {
      console.log('🔧 Dispositivo detectado:', deviceInfo);
      toast({
        title: "Modo Tablet Ativo",
        description: `Executando em ${deviceInfo.platform} - ${deviceInfo.model}`,
        variant: "default"
      });
    }
  }, [isNative, deviceInfo, toast]);
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

  // Função principal de pagamento via Pix
  const handlePixPayment = async () => {
    const machine = machines.find(m => m.id === selectedMachine);
    if (!machine) return;
    
    setPaymentStep("processing");
    setPaymentSystem('PIX');
    
    try {
      // Preparar dados da transação Pix
      const pixData = {
        amount: machine.price,
        orderId: generateReceiptNumber()
      };

      console.log("Iniciando transação Pix:", pixData);

      // Gerar QR Code Pix
      const result = await generatePixQR(pixData);

      if (result.success && result.qrCode) {
        // QR Code gerado com sucesso
        setPixPaymentData({
          ...result,
          amount: machine.price,
          orderId: pixData.orderId,
        });
        setPaymentStep("pix_qr");

        // Iniciar polling para verificar pagamento
        startPixPolling(pixData.orderId, async (status) => {
          if (status.status === 'paid') {
            setTransactionData({
              success: true,
              nsu: status.transactionId,
              transactionId: status.transactionId,
              amount: status.amount,
            });
            setPaymentStep("success");
            await activateMachine('PIX');
            toast({
              title: "Pagamento Pix Confirmado!",
              description: `Transação realizada com sucesso.`,
            });
          } else if (status.status === 'expired') {
            setPaymentStep("error");
            toast({
              title: "QR Code Expirado",
              description: "O tempo limite para pagamento foi atingido.",
              variant: "destructive",
            });
          } else if (status.status === 'cancelled') {
            setPaymentStep("error");
            toast({
              title: "Pagamento Cancelado",
              description: "A transação Pix foi cancelada.",
              variant: "destructive",
            });
          }
        });
      } else {
        // Falha ao gerar QR Code
        setPaymentStep("error");
        toast({
          title: "Erro no Pix",
          description: result.errorMessage || "Falha ao gerar QR Code",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Erro crítico na transação Pix:", error);
      setPaymentStep("error");
      toast({
        title: "Erro Crítico",
        description: "Falha grave no sistema de pagamento Pix. Contacte o suporte.",
        variant: "destructive",
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
    setPixPaymentData(null);
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

  // Tela de QR Code Pix
  if (paymentStep === "pix_qr" && pixPaymentData) {
    const handleCancelPix = async () => {
      try {
        await cancelPixPayment(pixPaymentData.orderId);
        resetTotem();
      } catch (error) {
        console.error("Erro ao cancelar Pix:", error);
        resetTotem();
      }
    };

    const handleCopyCode = () => {
      // Additional feedback for copied code
      console.log("Código Pix copiado:", pixPaymentData.qrCode);
    };

    return (
      <PixQRDisplay
        qrCode={pixPaymentData.qrCode}
        qrCodeBase64={pixPaymentData.qrCodeBase64}
        pixKey={pixPaymentData.pixKey}
        amount={pixPaymentData.amount}
        timeRemaining={pixTimeRemaining}
        totalTime={pixPaymentData.expiresIn || 300}
        onCancel={handleCancelPix}
        onCopyCode={handleCopyCode}
      />
    );
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
                Cartão {paygoStatus.online ? '' : '(Offline)'}
              </Button>

              {/* Pix Payment Option */}
              <Button 
                onClick={handlePixPayment} 
                variant="secondary" 
                size="lg" 
                className="w-full justify-start"
                disabled={!paygoStatus.online}
              >
                <QrCode className="mr-3" />
                Pix {paygoStatus.online ? '' : '(Offline)'}
              </Button>
              
              <p className="text-xs text-muted-foreground text-center">
                Escolha a forma de pagamento: cartão na maquininha ou QR Code Pix
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
  return <div className="min-h-screen bg-blue-600 p-2 md:p-4">{/*Changed background to blue and reduced padding*/}
      {/* Header */}
      <div className="container mx-auto mb-4 md:mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 md:w-12 md:h-12 bg-gradient-primary rounded-full flex items-center justify-center">
              <Sparkles className="text-primary-foreground" size={16} />
            </div>
            <div>
              <h1 className="text-xl md:text-3xl font-bold text-white">Top Lavanderia</h1>
              <p className="text-blue-200 text-sm">Sistema Automatizado</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 md:space-x-4">
            {/* Indicador de Segurança */}
            <div className="flex items-center space-x-1 md:space-x-2">
              {/* Indicador PayGO */}
              <div className={`flex items-center space-x-1 rounded-lg px-1 md:px-2 py-1 ${
                paygoStatus.online 
                  ? 'text-green-600 bg-white' 
                  : 'text-red-600 bg-white'
              }`}>
                <CreditCard size={12} />
                <span className="text-xs font-medium">
                  PayGO {paygoStatus.online ? 'Online' : 'Offline'}
                </span>
              </div>

              {securityEnabled ? <div className="flex items-center space-x-1 text-green-600 bg-white rounded-lg px-1 md:px-2 py-1">
                  <Shield size={12} />
                  <span className="text-xs font-medium">Seguro</span>
                </div> : <div className="flex items-center space-x-1 text-orange-600 bg-white rounded-lg px-1 md:px-2 py-1">
                  <Shield size={12} />
                  <span className="text-xs font-medium">Desbloqueado</span>
                </div>}
            </div>

            <div className="text-right">
              <div className="text-xs text-blue-200">
                {currentTime.toLocaleDateString('pt-BR')}
              </div>
              <div className="text-sm md:text-lg font-semibold text-white">
                {currentTime.toLocaleTimeString('pt-BR')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Geral */}
      <div className="container mx-auto mb-4 md:mb-6">
        <div className="grid grid-cols-3 gap-2 md:gap-4 text-center">
          <div className="space-y-1 bg-white/10 rounded-lg p-2 md:p-3">
            <div className="text-lg md:text-2xl font-bold text-green-400">
              {machines.filter(m => m.status === "available").length}
            </div>
            <div className="text-xs md:text-sm text-blue-200">Disponíveis</div>
          </div>
          <div className="space-y-1 bg-white/10 rounded-lg p-2 md:p-3">
            <div className="text-lg md:text-2xl font-bold text-blue-300">
              {machines.filter(m => m.status === "running").length}
            </div>
            <div className="text-xs md:text-sm text-blue-200">Em Uso</div>
          </div>
          <div className="space-y-1 bg-white/10 rounded-lg p-2 md:p-3">
            <div className="text-lg md:text-2xl font-bold text-red-300">
              {machines.filter(m => m.status === "maintenance").length}
            </div>
            <div className="text-xs md:text-sm text-blue-200">Manutenção</div>
          </div>
        </div>
      </div>

      {/* Grid de Máquinas */}
      <div className="container mx-auto">
        {/* Layout responsivo com altura fixa para totem */}
        <div className="grid grid-rows-2 gap-4 md:gap-6 h-[60vh] md:h-[65vh]">
          
          {/* Lavadoras - Superior */}
          <div className="overflow-hidden">
            <div className="flex items-center justify-center mb-2 md:mb-4 space-x-2">
              <div className="w-6 h-6 md:w-8 md:h-8 bg-blue-300 rounded-full flex items-center justify-center">
                <Droplets className="text-blue-800" size={16} />
              </div>
              <h2 className="text-lg md:text-xl font-bold text-white">
                Lavadoras
              </h2>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 md:gap-3 h-full overflow-y-auto">
              {machines.filter(machine => machine.type === "lavadora").map(machine => {
                const IconComponent = machine.icon;
                const isAvailable = machine.status === "available";
                return <Card key={machine.id} className={`relative overflow-hidden transition-all duration-300 cursor-pointer bg-white/95 hover:bg-white ${isAvailable ? 'hover:shadow-lg hover:scale-105' : 'opacity-60 cursor-not-allowed'} h-fit`} onClick={() => handleMachineSelect(machine.id)}>
                    {/* Status Badge */}
                    <div className="absolute top-2 right-2">
                      <div className={`w-2 h-2 md:w-3 md:h-3 rounded-full ${getStatusColor(machine.status)}`}></div>
                    </div>

                    <CardHeader className="text-center p-2 md:p-4">
                      <div className="w-8 h-8 md:w-12 md:h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-1 md:mb-2">
                        <IconComponent className="text-blue-600" size={16} />
                      </div>
                      <CardTitle className="text-xs md:text-sm">{machine.title}</CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-2 p-2 md:p-4 pt-0">
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-1 mb-1">
                          <span className="text-sm md:text-lg font-bold text-primary">
                            R$ {machine.price.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          <Clock className="inline mr-1" size={10} />
                          {machine.duration}min
                        </p>
                      </div>

                      <div className="flex items-center justify-center">
                        <Badge variant={machine.status === "available" ? "default" : "secondary"} className={`text-xs ${machine.status === "available" ? "bg-green-100 text-green-800" : machine.status === "running" ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-800"}`}>
                          {getStatusText(machine.status)}
                        </Badge>
                      </div>

                      {machine.status === "running" && machine.timeRemaining && (
                        <div className="space-y-1">
                          <Progress value={(machine.duration - machine.timeRemaining) / machine.duration * 100} className="h-1" />
                          <div className="text-center text-xs text-muted-foreground">
                            {machine.timeRemaining}min
                          </div>
                        </div>
                      )}

                      {isAvailable && <Button variant="fresh" size="sm" className="w-full text-xs">
                          Selecionar
                        </Button>}
                    </CardContent>
                  </Card>;
              })}
            </div>
          </div>

          {/* Secadoras - Inferior */}
          <div className="overflow-hidden">
            <div className="flex items-center justify-center mb-2 md:mb-4 space-x-2">
              <div className="w-6 h-6 md:w-8 md:h-8 bg-orange-300 rounded-full flex items-center justify-center">
                <Wind className="text-orange-800" size={16} />
              </div>
              <h2 className="text-lg md:text-xl font-bold text-white">
                Secadoras
              </h2>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 md:gap-3 h-full overflow-y-auto">
              {machines.filter(machine => machine.type === "secadora").map(machine => {
                const IconComponent = machine.icon;
                const isAvailable = machine.status === "available";
                return <Card key={machine.id} className={`relative overflow-hidden transition-all duration-300 cursor-pointer bg-white/95 hover:bg-white ${isAvailable ? 'hover:shadow-lg hover:scale-105' : 'opacity-60 cursor-not-allowed'} h-fit`} onClick={() => handleMachineSelect(machine.id)}>
                    {/* Status Badge */}
                    <div className="absolute top-2 right-2">
                      <div className={`w-2 h-2 md:w-3 md:h-3 rounded-full ${getStatusColor(machine.status)}`}></div>
                    </div>

                    <CardHeader className="text-center p-2 md:p-4">
                      <div className="w-8 h-8 md:w-12 md:h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-1 md:mb-2">
                        <IconComponent className="text-orange-600" size={16} />
                      </div>
                      <CardTitle className="text-xs md:text-sm">{machine.title}</CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-2 p-2 md:p-4 pt-0">
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-1 mb-1">
                          <span className="text-sm md:text-lg font-bold text-primary">
                            R$ {machine.price.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          <Clock className="inline mr-1" size={10} />
                          {machine.duration}min
                        </p>
                      </div>

                      <div className="flex items-center justify-center">
                        <Badge variant={machine.status === "available" ? "default" : "secondary"} className={`text-xs ${machine.status === "available" ? "bg-green-100 text-green-800" : machine.status === "running" ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-800"}`}>
                          {getStatusText(machine.status)}
                        </Badge>
                      </div>

                      {machine.status === "running" && machine.timeRemaining && (
                        <div className="space-y-1">
                          <Progress value={(machine.duration - machine.timeRemaining) / machine.duration * 100} className="h-1" />
                          <div className="text-center text-xs text-muted-foreground">
                            {machine.timeRemaining}min
                          </div>
                        </div>
                      )}

                      {isAvailable && <Button variant="fresh" size="sm" className="w-full text-xs">
                          Selecionar
                        </Button>}
                    </CardContent>
                  </Card>;
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="container mx-auto mt-4 text-center">
        <div className="flex items-center justify-center space-x-2 text-blue-200">
          <Wifi size={14} />
          <span className="text-xs cursor-pointer select-none" onClick={handleAdminAccess}>
            Sistema Online - Suporte: (11) 9999-9999
          </span>
        </div>
      </div>

      {/* Admin Access Dialog */}
      <AdminPinDialog 
        open={showAdminDialog} 
        onOpenChange={setShowAdminDialog} 
        onAuthenticate={handleAdminAuthenticate} 
        title="Acesso Administrativo" 
        description="Desativar temporariamente as medidas de segurança do kiosk" 
      />
    </div>;
};

export default Totem;