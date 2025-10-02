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
import { SimplePayGOWidget } from '@/components/payment/SimplePayGOWidget';
import { UniversalPaymentWidget } from '@/components/payment/UniversalPaymentWidget';
import { useRealPayGOIntegration, RealPayGOConfig } from '@/hooks/useRealPayGOIntegration';
import { usePixPayment } from '@/hooks/usePixPayment';
import { PixQRDisplay } from '@/components/payment/PixQRDisplay';
import { DEFAULT_PAYGO_CONFIG } from '@/lib/paygoUtils';
import { SecureTEFConfig } from "@/components/admin/SecureTEFConfig";
import { AdminPinDialog } from "@/components/admin/AdminPinDialog";
import { supabase } from "@/integrations/supabase/client";
import { useSystemSettings } from "@/hooks/useSystemSettings";

const Totem = () => {
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [paymentStep, setPaymentStep] = useState<"select" | "payment" | "processing" | "success" | "error" | "pix_qr">("select");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showConfig, setShowConfig] = useState(false);
  const [transactionData, setTransactionData] = useState<any>(null);
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [adminClickCount, setAdminClickCount] = useState(0);
  const [pixPaymentData, setPixPaymentData] = useState<any>(null);
  
  // Carregar configurações do sistema
  const { data: systemSettings, isLoading: settingsLoading } = useSystemSettings();
  
  // Configurações dinâmicas baseadas no sistema
  const [tefConfig, setTefConfig] = useState({
    host: systemSettings?.esp32_host || "127.0.0.1",
    port: systemSettings?.tef_terminal_id || "4321",
    timeout: 60000,
    retryAttempts: 3,
    retryDelay: 2000
  });
  
  const [paygoConfig, setPaygoConfig] = useState<RealPayGOConfig>({
    host: systemSettings?.paygo_host || 'localhost',
    port: systemSettings?.paygo_port || 8080,
    automationKey: systemSettings?.paygo_automation_key || '',
    timeout: systemSettings?.paygo_timeout || 30000,
    retryAttempts: systemSettings?.paygo_retry_attempts || 3
  });
  const [paymentSystem, setPaymentSystem] = useState<'TEF' | 'PAYGO' | 'PIX'>('PAYGO');
  
  const { toast } = useToast();
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
    isInitialized: paygoInitialized,
    isConnected: paygoConnected,
    isProcessing: paygoProcessing,
    systemStatus: paygoStatus,
    processPayment: processPayGOPayment,
    cancelTransaction: cancelPayGOTransaction,
    testConnection: testPayGOConnection,
    detectPinpad
  } = useRealPayGOIntegration(paygoConfig);

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

  // Atualizar configurações quando systemSettings mudar
  useEffect(() => {
    if (systemSettings) {
      setTefConfig({
        host: systemSettings.esp32_host || "127.0.0.1",
        port: systemSettings.tef_terminal_id || "4321",
        timeout: 60000,
        retryAttempts: 3,
        retryDelay: 2000
      });
      
      setPaygoConfig({
        host: systemSettings.paygo_host || 'localhost',
        port: systemSettings.paygo_port || 8080,
        automationKey: systemSettings.paygo_automation_key || '',
        timeout: systemSettings.paygo_timeout || 30000,
        retryAttempts: systemSettings.paygo_retry_attempts || 3
      });
    }
  }, [systemSettings]);

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
    if (machine && machine.status === "available") {
      setSelectedMachine(machine);
      setPaymentStep("payment");
    }
  };

  const handleUniversalPaymentSuccess = async (result: any) => {
    console.log('Pagamento universal bem-sucedido:', result);
    await activateMachine(`Universal - ${result.method.toUpperCase()}`);
  };

  const handleUniversalPaymentError = (error: string) => {
    console.error('Erro no pagamento universal:', error);
    toast({
      title: "Erro no Pagamento",
      description: error,
      variant: "destructive"
    });
    setPaymentStep('error');
  };

  // Gerar número do cupom fiscal
  const generateReceiptNumber = () => {
    return Date.now().toString().slice(-6);
  };

  // Função principal de pagamento via TEF com melhorias
  const handleTEFPayment = async () => {
    if (!selectedMachine) return;
    
    setPaymentStep("processing");
    setPaymentSystem('TEF');
    
    try {
      // Preparar dados da transação
      const amount = selectedMachine.price * 100; // Converter para centavos
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
    if (!selectedMachine) return;
    
    setPaymentStep("processing");
    setPaymentSystem('PAYGO');
    
    try {
      // Preparar dados da transação PayGO
      const transactionData = {
        amount: selectedMachine.price, // PayGO usa valor em reais
        paymentType: 'credit' as const,
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
    if (!selectedMachine) return;
    
    setPaymentStep("processing");
    setPaymentSystem('PIX');
    
    try {
      // Preparar dados da transação Pix
      const pixData = {
        amount: selectedMachine.price,
        orderId: generateReceiptNumber()
      };

      console.log("Iniciando transação Pix:", pixData);

      // Gerar QR Code Pix
      const result = await generatePixQR(pixData);

      if (result.success && result.qrCode) {
        // QR Code gerado com sucesso
        setPixPaymentData({
          ...result,
          amount: selectedMachine.price,
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
    if (!selectedMachine) return;
    try {
      // Atualizar status da máquina para "running"
      await updateMachineStatus(selectedMachine.id, 'running');

      // Criar transação no banco
      const {
        error: transactionError
      } = await supabase.from('transactions').insert({
        machine_id: selectedMachine.id,
        total_amount: selectedMachine.price, // Usar o preço já calculado da interface Machine
        duration_minutes: selectedMachine.duration,
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
        console.log(`Ativando máquina ${selectedMachine.name} via ESP32 ${selectedMachine.esp32_id}`);
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

  // Mostrar loading enquanto carrega máquinas ou configurações
  if (loading || settingsLoading) {
    return <div className="min-h-screen bg-gradient-clean flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="mx-auto animate-spin text-primary" size={48} />
          <h2 className="text-xl font-semibold">
            {settingsLoading ? "Carregando configurações..." : "Carregando máquinas..."}
          </h2>
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
    return <div className="min-h-screen bg-gradient-clean flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-glow">
          <CardContent className="pt-6 text-center space-y-6">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="text-white" size={24} />
            </div>
            <h2 className="text-2xl font-bold text-green-600">Pagamento Aprovado!</h2>
            <div className="space-y-2">
              <p className="font-semibold">{selectedMachine?.name}</p>
              <p className="text-muted-foreground">
                Tempo estimado: {selectedMachine?.duration} minutos
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
    return <div className="min-h-screen bg-gradient-clean flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-glow">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <selectedMachine.icon className="text-primary-foreground" size={24} />
            </div>
            <CardTitle className="text-xl">{selectedMachine?.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center space-x-2">
                <span className="text-3xl font-bold text-primary">
                  R$ {selectedMachine?.price.toFixed(2).replace('.', ',')}
                </span>
              </div>
              <p className="text-muted-foreground">
                Duração: {selectedMachine?.duration} minutos
              </p>
            </div>

            <Separator />

              <div className="space-y-4">
                <UniversalPaymentWidget
                  amount={selectedMachine?.price || 0}
                  onSuccess={handleUniversalPaymentSuccess}
                  onError={handleUniversalPaymentError}
                  onCancel={resetTotem}
                />
              </div>

            <Button onClick={resetTotem} variant="outline" className="w-full">
              Cancelar
            </Button>
          </CardContent>
        </Card>
      </div>;
  }

  // Tela principal
  return <div className="h-screen bg-white flex flex-col overflow-hidden">
      {/* Header Compacto */}
      <div className="container mx-auto px-2 py-2">
        <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-2 shadow-lg">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <Sparkles className="text-white" size={16} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Top Lavanderia</h1>
              <p className="text-blue-100 text-xs">Sistema Automatizado</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {/* Indicador PayGO */}
            <div className={`flex items-center space-x-1 rounded px-2 py-1 ${
              paygoStatus.online 
                ? 'text-green-700 bg-green-100/90' 
                : 'text-red-700 bg-red-100/90'
            }`}>
              <CreditCard size={12} />
              <span className="text-xs font-medium">
                {paygoStatus.online ? 'Online' : 'Offline'}
              </span>
            </div>

            <div className="text-right text-white">
              <div className="text-sm font-semibold">
                {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="text-xs text-blue-100">
                {currentTime.toLocaleDateString('pt-BR')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de Máquinas - Otimizado para não precisar scroll */}
      <div className="container mx-auto px-2 flex-1 flex flex-col">
        <div className="flex-1 grid grid-rows-2 gap-3">
          
          {/* Lavadoras */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-3 shadow-lg flex flex-col">
            <div className="flex items-center justify-center mb-3 space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
                <Droplets className="text-white" size={16} />
              </div>
              <h2 className="text-xl font-bold text-blue-700">Lavadoras</h2>
            </div>
            
            <div className="flex-1 grid grid-cols-6 gap-3">
              {[...machines.filter(machine => machine.type === "lavadora"), 
                // Adicionar máquinas fallback se não houver suficientes no banco
                ...Array.from({ length: Math.max(0, 3 - machines.filter(m => m.type === "lavadora").length) }, (_, i) => ({
                  id: `lavadora-${i + machines.filter(m => m.type === "lavadora").length + 1}`,
                  name: `Lavadora ${i + machines.filter(m => m.type === "lavadora").length + 1}`,
                  type: 'lavadora' as const,
                  title: `Lavadora ${i + machines.filter(m => m.type === "lavadora").length + 1}`,
                  price: 18.00,
                  duration: 35,
                  status: 'available' as const,
                  icon: Droplets
                }))
              ].slice(0, 6).map(machine => {
                const IconComponent = machine.icon;
                const isAvailable = machine.status === "available";
                return <Card key={machine.id} className={`relative overflow-hidden transition-all duration-300 cursor-pointer bg-white ${isAvailable ? 'hover:shadow-lg hover:scale-105 border border-blue-200 hover:border-blue-400' : 'opacity-70 cursor-not-allowed border border-gray-200'} shadow-md rounded-lg h-full flex flex-col`} onClick={() => handleMachineSelect(machine.id)}>
                    {/* Status Badge */}
                    <div className="absolute top-2 right-2 z-10">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(machine.status)} shadow border border-white`}></div>
                    </div>

                    <CardHeader className="text-center p-2 pb-1 flex-shrink-0">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-1 shadow">
                        <IconComponent className="text-white" size={16} />
                      </div>
                      <CardTitle className="text-xs font-bold text-gray-800 leading-tight">{machine.title}</CardTitle>
                    </CardHeader>

                    <CardContent className="flex-1 p-2 pt-0 flex flex-col justify-between">
                      <div className="text-center mb-2">
                        <div className="flex items-center justify-center space-x-1 mb-1">
                          <span className="text-sm font-bold text-blue-600">
                            R$ {machine.price.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 flex items-center justify-center">
                          <Clock className="mr-1" size={10} />
                          {machine.duration}min
                        </p>
                      </div>

                      <div className="flex items-center justify-center mb-2">
                        <Badge variant={machine.status === "available" ? "default" : "secondary"} className={`text-xs px-2 py-0.5 ${machine.status === "available" ? "bg-green-100 text-green-700" : machine.status === "running" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>
                          {getStatusText(machine.status)}
                        </Badge>
                      </div>

                      {machine.status === "running" && machine.timeRemaining && (
                        <div className="space-y-1 mb-2">
                          <Progress value={(machine.duration - machine.timeRemaining) / machine.duration * 100} className="h-1" />
                          <div className="text-center text-xs text-gray-600">
                            {machine.timeRemaining}min
                          </div>
                        </div>
                      )}

                      {isAvailable && <Button variant="default" size="sm" className="w-full text-xs bg-blue-600 hover:bg-blue-700 text-white h-6">
                          Selecionar
                        </Button>}
                    </CardContent>
                  </Card>;
              })}
            </div>
          </div>

          {/* Secadoras */}
          <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl p-3 shadow-lg flex flex-col">
            <div className="flex items-center justify-center mb-3 space-x-2">
              <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center shadow-lg">
                <Wind className="text-white" size={16} />
              </div>
              <h2 className="text-xl font-bold text-orange-700">Secadoras</h2>
            </div>
            
            <div className="flex-1 grid grid-cols-6 gap-3">
              {[...machines.filter(machine => machine.type === "secadora"),
                // Adicionar máquinas fallback se não houver suficientes no banco
                ...Array.from({ length: Math.max(0, 3 - machines.filter(m => m.type === "secadora").length) }, (_, i) => ({
                  id: `secadora-${i + machines.filter(m => m.type === "secadora").length + 1}`,
                  name: `Secadora ${i + machines.filter(m => m.type === "secadora").length + 1}`,
                  type: 'secadora' as const,
                  title: `Secadora ${i + machines.filter(m => m.type === "secadora").length + 1}`,
                  price: 18.00,
                  duration: 40,
                  status: 'available' as const,
                  icon: Wind
                }))
              ].slice(0, 6).map(machine => {
                const IconComponent = machine.icon;
                const isAvailable = machine.status === "available";
                return <Card key={machine.id} className={`relative overflow-hidden transition-all duration-300 cursor-pointer bg-white ${isAvailable ? 'hover:shadow-lg hover:scale-105 border border-orange-200 hover:border-orange-400' : 'opacity-70 cursor-not-allowed border border-gray-200'} shadow-md rounded-lg h-full flex flex-col`} onClick={() => handleMachineSelect(machine.id)}>
                    {/* Status Badge */}
                    <div className="absolute top-2 right-2 z-10">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(machine.status)} shadow border border-white`}></div>
                    </div>

                    <CardHeader className="text-center p-2 pb-1 flex-shrink-0">
                      <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-1 shadow">
                        <IconComponent className="text-white" size={16} />
                      </div>
                      <CardTitle className="text-xs font-bold text-gray-800 leading-tight">{machine.title}</CardTitle>
                    </CardHeader>

                    <CardContent className="flex-1 p-2 pt-0 flex flex-col justify-between">
                      <div className="text-center mb-2">
                        <div className="flex items-center justify-center space-x-1 mb-1">
                          <span className="text-sm font-bold text-orange-600">
                            R$ {machine.price.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 flex items-center justify-center">
                          <Clock className="mr-1" size={10} />
                          {machine.duration}min
                        </p>
                      </div>

                      <div className="flex items-center justify-center mb-2">
                        <Badge variant={machine.status === "available" ? "default" : "secondary"} className={`text-xs px-2 py-0.5 ${machine.status === "available" ? "bg-green-100 text-green-700" : machine.status === "running" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>
                          {getStatusText(machine.status)}
                        </Badge>
                      </div>

                      {machine.status === "running" && machine.timeRemaining && (
                        <div className="space-y-1 mb-2">
                          <Progress value={(machine.duration - machine.timeRemaining) / machine.duration * 100} className="h-1" />
                          <div className="text-center text-xs text-gray-600">
                            {machine.timeRemaining}min
                          </div>
                        </div>
                      )}

                      {isAvailable && <Button variant="default" size="sm" className="w-full text-xs bg-orange-600 hover:bg-orange-700 text-white h-6">
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
      <div className="container mx-auto px-2 py-2 text-center">
        <div className="flex items-center justify-center space-x-2 text-gray-500">
          <Wifi size={12} />
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