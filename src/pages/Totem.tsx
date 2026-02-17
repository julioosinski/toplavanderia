import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Droplets, Wind, Clock, CreditCard, Wifi, CheckCircle, XCircle, Timer, Sparkles, DollarSign, Shield, Maximize, Loader2, QrCode, Monitor, Smartphone, Settings, Eye, EyeOff, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { nativeStorage } from "@/utils/nativeStorage";
import { useToast } from "@/hooks/use-toast";
import { useKioskSecurity } from "@/hooks/useKioskSecurity";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useMachines, type Machine } from "@/hooks/useMachines";
import { useLaundry } from "@/contexts/LaundryContext";
import { useCapacitorIntegration } from "@/hooks/useCapacitorIntegration";
import { UniversalPaymentWidget } from '@/components/payment/UniversalPaymentWidget';
import { UniversalPaymentConfig } from '@/hooks/useUniversalPayment';
import { PixQRDisplay } from '@/components/payment/PixQRDisplay';
import { SecureTEFConfig } from "@/components/admin/SecureTEFConfig";
import { AdminPinDialog } from "@/components/admin/AdminPinDialog";
import { supabase } from "@/integrations/supabase/client";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useDeviceMode } from "@/hooks/useDeviceMode";
import { ScrollArea } from "@/components/ui/scroll-area";

const Totem = () => {
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [paymentStep, setPaymentStep] = useState<"select" | "payment" | "processing" | "success" | "error" | "pix_qr">("select");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showConfig, setShowConfig] = useState(false);
  const [transactionData, setTransactionData] = useState<any>(null);
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [adminClickCount, setAdminClickCount] = useState(0);
  const [pixPaymentData, setPixPaymentData] = useState<any>(null);
  const [paymentSystem, setPaymentSystem] = useState<string>('PAYGO');

  // Estado para configuração do totem por CNPJ
  const [cnpjInput, setCnpjInput] = useState('');
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjError, setCnpjError] = useState('');

  // Gesto secreto no logo para reconfiguração
  const [logoTapCount, setLogoTapCount] = useState(0);
  const [showReconfigureDialog, setShowReconfigureDialog] = useState(false);
  const [reconfigureStep, setReconfigureStep] = useState<'pin' | 'cnpj'>('pin');
  const [reconfigurePin, setReconfigurePin] = useState('');
  const [reconfigureCnpj, setReconfigureCnpj] = useState('');
  const [reconfigureLoading, setReconfigureLoading] = useState(false);
  const [reconfigureError, setReconfigureError] = useState('');
  const [showReconfigurePin, setShowReconfigurePin] = useState(false);
  const [pinAttempts, setPinAttempts] = useState(0);

  // Timeout de segurança: se loading travar por mais de 8s, exibe tela de configuração
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  
  // Detectar modo do dispositivo
  const { mode: deviceMode, isSmallScreen, isPWA, canProcessPayments } = useDeviceMode();

  // Carregar configurações do sistema
  const { settings: systemSettings, isLoading: settingsLoading } = useSystemSettings();
  
  // Configurações dinâmicas baseadas no sistema
  const [tefConfig, setTefConfig] = useState({
    host: systemSettings?.esp32_host || "127.0.0.1",
    port: systemSettings?.tef_terminal_id || "4321",
    timeout: 60000,
    retryAttempts: 3,
    retryDelay: 2000
  });
  
  const [paygoConfig, setPaygoConfig] = useState({
    host: systemSettings?.paygo_host || 'localhost',
    port: systemSettings?.paygo_port || 8080,
    automationKey: systemSettings?.paygo_automation_key || '',
    timeout: systemSettings?.paygo_timeout || 30000,
    retryAttempts: systemSettings?.paygo_retry_attempts || 3
  });

  // Universal payment config
  const universalConfig: UniversalPaymentConfig = {
    paygo: paygoConfig,
    tef: tefConfig,
    smartPosMode: deviceMode === 'smartpos'
  };
  
  const { toast } = useToast();
  const { currentLaundry, loading: laundryLoading, configureTotemByCNPJ } = useLaundry();
  const {
    isFullscreen,
    securityEnabled,
    enableSecurity,
    disableSecurity
  } = useKioskSecurity();
  const {
    authenticate: adminAuthenticate,
    validatePin
  } = useAdminAccess();
  const {
    machines,
    loading,
    error,
    updateMachineStatus
  } = useMachines(currentLaundry?.id);
  
  const {
    isNative,
    deviceInfo,
    isReady,
    enableKioskMode,
    disableKioskMode
  } = useCapacitorIntegration();
  // Timeout de segurança: se loading travar por mais de 8s, exibe tela de configuração CNPJ
  useEffect(() => {
    const timer = setTimeout(() => {
      if (laundryLoading) {
        console.warn('[Totem] Loading travado por 8s - exibindo tela de configuração CNPJ');
        setLoadingTimeout(true);
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, [laundryLoading]);

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
    if (!canProcessPayments) return; // PWA: view-only
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

  // Handle PIX QR code display from UniversalPaymentWidget
  const handlePixQR = (result: any) => {
    setPixPaymentData({
      ...result,
      amount: selectedMachine?.price,
      orderId: result.data?.orderId,
    });
    setPaymentStep("pix_qr");
    setPaymentSystem('PIX');
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
        laundry_id: currentLaundry.id, // ✅ VINCULADO À LAVANDERIA
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      });
      if (transactionError) {
        console.error('Erro ao criar transação:', transactionError);
      }

      // Ativar máquina fisicamente via ESP32
      if (selectedMachine.esp32_id) {
        try {
          console.log(`🎮 Ativando máquina ${selectedMachine.name} via ESP32 ${selectedMachine.esp32_id}`);
          const { data: esp32Result, error: esp32Error } = await supabase.functions.invoke('esp32-control', {
            body: {
              esp32_id: selectedMachine.esp32_id,
              relay_pin: selectedMachine.relay_pin || 1,
              action: 'on',
              machine_id: selectedMachine.id,
            }
          });
          if (esp32Error) {
            console.warn("⚠️ Erro na comunicação com ESP32:", esp32Error);
          } else {
            console.log("✅ ESP32 respondeu:", esp32Result);
          }
        } catch (error) {
          console.warn("⚠️ Erro na comunicação com ESP32, mas máquina foi ativada no sistema:", error);
        }
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

  // Handler configuração CNPJ
  const handleConfigureCNPJ = async () => {
    const cleanCnpj = cnpjInput.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) {
      setCnpjError('O CNPJ deve ter exatamente 14 dígitos numéricos.');
      return;
    }
    setCnpjError('');
    setCnpjLoading(true);
    const success = await configureTotemByCNPJ(cleanCnpj);
    setCnpjLoading(false);
    if (!success) {
      setCnpjError('CNPJ não encontrado ou lavanderia inativa. Verifique e tente novamente.');
    }
  };

  // Gesto secreto: 7 toques no logo
  const handleLogoTap = () => {
    const newCount = logoTapCount + 1;
    setLogoTapCount(newCount);
    if (newCount >= 7) {
      setShowReconfigureDialog(true);
      setReconfigureStep('pin');
      setReconfigurePin('');
      setReconfigureCnpj('');
      setReconfigureError('');
      setPinAttempts(0);
      setLogoTapCount(0);
    }
    setTimeout(() => setLogoTapCount(0), 3000);
  };

  // Validar PIN na etapa 1
  const handleReconfigurePin = () => {
    const isValid = validatePin(reconfigurePin);
    if (isValid) {
      setReconfigureStep('cnpj');
      setReconfigureError('');
      setReconfigurePin('');
      setPinAttempts(0);
    } else {
      const attempts = pinAttempts + 1;
      setPinAttempts(attempts);
      setReconfigurePin('');
      if (attempts >= 3) {
        setShowReconfigureDialog(false);
        setPinAttempts(0);
        toast({ title: "Acesso bloqueado", description: "Máximo de tentativas atingido.", variant: "destructive" });
      } else {
        setReconfigureError(`PIN incorreto. Tentativa ${attempts}/3.`);
      }
    }
  };

  // Reconfigurar CNPJ na etapa 2
  const handleReconfigureCNPJ = async () => {
    const cleanCnpj = reconfigureCnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) {
      setReconfigureError('CNPJ deve ter 14 dígitos.');
      return;
    }
    setReconfigureLoading(true);
    setReconfigureError('');
    await nativeStorage.removeItem('totem_laundry_id');
    const success = await configureTotemByCNPJ(cleanCnpj);
    setReconfigureLoading(false);
    if (success) {
      setShowReconfigureDialog(false);
      toast({ title: "✅ Totem Reconfigurado", description: "Nova lavanderia carregada com sucesso." });
    } else {
      setReconfigureError('CNPJ não encontrado ou lavanderia inativa.');
    }
  };

  // Tela de configuração TEF segura
  if (showConfig) {
    return <SecureTEFConfig config={tefConfig} onConfigChange={setTefConfig} onClose={() => setShowConfig(false)} />;
  }

  // Tela de configuração inicial do totem (sem lavanderia configurada OU timeout de segurança)
  // IMPORTANTE: esta condição deve vir ANTES do check de loading para garantir
  // que o campo CNPJ apareça mesmo se laundryLoading travar indefinidamente
  if ((!laundryLoading && !currentLaundry) || loadingTimeout) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center space-y-3">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto">
              <Settings className="text-white" size={28} />
            </div>
            <CardTitle className="text-2xl">🧺 Configuração Inicial</CardTitle>
            <p className="text-muted-foreground text-sm">
              Digite o CNPJ da lavanderia para configurar este totem.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">CNPJ da Lavanderia</label>
              <Input
                placeholder="00000000000000 (14 dígitos)"
                value={cnpjInput}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 14);
                  setCnpjInput(val);
                  setCnpjError('');
                }}
                className="text-center text-lg tracking-widest font-mono"
                maxLength={14}
                inputMode="numeric"
                disabled={cnpjLoading}
              />
              {cnpjError && (
                <p className="text-destructive text-sm flex items-center gap-1">
                  <XCircle size={14} />
                  {cnpjError}
                </p>
              )}
            </div>
            <Button
              className="w-full"
              size="lg"
              onClick={handleConfigureCNPJ}
              disabled={cnpjLoading || cnpjInput.replace(/\D/g, '').length !== 14}
            >
              {cnpjLoading ? (
                <><Loader2 className="mr-2 animate-spin" size={18} /> Buscando lavanderia...</>
              ) : (
                '✅ Configurar Totem'
              )}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Exemplo: 43652666000137 (TOP LAVANDERIA SINUELO)
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Mostrar loading enquanto carrega lavanderia, máquinas ou configurações
  if (laundryLoading || loading || settingsLoading) {
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
                onClick={resetTotem} 
                variant="outline" 
                className="flex-1"
              >
                Cancelar Pagamento
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
    const handleCancelPix = () => {
      resetTotem();
    };

    const handleCopyCode = () => {
      console.log("Código Pix copiado:", pixPaymentData.qrCode);
    };

    return (
      <PixQRDisplay
        qrCode={pixPaymentData.qrCode}
        qrCodeBase64={pixPaymentData.qrCodeBase64}
        pixKey={pixPaymentData.pixKey}
        amount={pixPaymentData.amount}
        timeRemaining={pixPaymentData.expiresIn || 300}
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
                  config={universalConfig}
                  onSuccess={handleUniversalPaymentSuccess}
                  onError={handleUniversalPaymentError}
                  onCancel={resetTotem}
                  onPixQR={handlePixQR}
                  compactMode={deviceMode === 'smartpos'}
                />
              </div>

            <Button onClick={resetTotem} variant="outline" className="w-full">
              Cancelar
            </Button>
          </CardContent>
        </Card>
      </div>;
  }

  // Helper: grid classes based on device mode
  const gridCols = deviceMode === 'smartpos' ? 'grid-cols-2' : 'grid-cols-6';
  const isViewOnly = isPWA;

  // Tela principal
  return <div className={`h-screen bg-white flex flex-col ${deviceMode === 'smartpos' ? 'overflow-auto' : 'overflow-hidden'}`}>
      {/* Header Compacto */}
      <div className="container mx-auto px-2 py-2">
        <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-2 shadow-lg">
          <div className="flex items-center space-x-2 select-none" onClick={handleLogoTap}>
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <Sparkles className="text-white" size={16} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Top Lavanderia</h1>
              {deviceMode !== 'smartpos' && (
                <p className="text-blue-100 text-xs">Sistema Automatizado</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {/* Device mode badge */}
            <Badge variant="secondary" className="text-xs bg-white/20 text-white border-0">
              {deviceMode === 'smartpos' ? (
                <><Smartphone className="mr-1 h-3 w-3" />Smart POS</>
              ) : deviceMode === 'totem' ? (
                <><Monitor className="mr-1 h-3 w-3" />Totem</>
              ) : (
                <><Monitor className="mr-1 h-3 w-3" />PWA</>
              )}
            </Badge>

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

      {/* PWA View-Only Banner */}
      {isViewOnly && (
        <div className="container mx-auto px-2 pb-2">
          <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
            <Shield className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              Modo Visualização — Pagamentos disponíveis apenas no totem físico (Android)
            </p>
          </div>
        </div>
      )}

      {/* Grid de Máquinas */}
      <div className="container mx-auto px-2 flex-1 flex flex-col min-h-0">
        <div className={`flex-1 ${deviceMode === 'smartpos' ? 'space-y-3' : 'grid grid-rows-2 gap-3'}`}>
          
          {/* Lavadoras */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-3 shadow-lg flex flex-col">
            <div className="flex items-center justify-center mb-3 space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
                <Droplets className="text-white" size={16} />
              </div>
              <h2 className="text-xl font-bold text-blue-700">Lavadoras</h2>
            </div>
            
            <div className={`flex-1 grid ${gridCols} gap-3`}>
              {machines.filter(machine => machine.type === "lavadora").slice(0, deviceMode === 'smartpos' ? 4 : 6).map(machine => {
                const IconComponent = machine.icon;
                const isAvailable = machine.status === "available";
                return <Card key={machine.id} className={`relative overflow-hidden transition-all duration-300 ${isAvailable && !isViewOnly ? 'cursor-pointer' : isViewOnly ? 'cursor-default' : 'cursor-not-allowed'} bg-white ${isAvailable && !isViewOnly ? 'hover:shadow-lg hover:scale-105 border border-blue-200 hover:border-blue-400' : 'opacity-70 border border-gray-200'} shadow-md rounded-lg h-full flex flex-col`} onClick={() => isAvailable && handleMachineSelect(machine.id)}>
                    {/* Status Badge */}
                    <div className="absolute top-2 right-2 z-10">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(machine.status)} shadow border border-white`}></div>
                    </div>

                    <CardHeader className={`text-center ${deviceMode === 'smartpos' ? 'p-3 pb-2' : 'p-2 pb-1'} flex-shrink-0`}>
                      <div className={`${deviceMode === 'smartpos' ? 'w-12 h-12' : 'w-10 h-10'} bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-1 shadow`}>
                        <IconComponent className="text-white" size={deviceMode === 'smartpos' ? 20 : 16} />
                      </div>
                      <CardTitle className={`${deviceMode === 'smartpos' ? 'text-sm' : 'text-xs'} font-bold text-gray-800 leading-tight`}>{machine.title}</CardTitle>
                    </CardHeader>

                    <CardContent className={`flex-1 ${deviceMode === 'smartpos' ? 'p-3 pt-0' : 'p-2 pt-0'} flex flex-col justify-between`}>
                      <div className="text-center mb-2">
                        <div className="flex items-center justify-center space-x-1 mb-1">
                          <span className={`${deviceMode === 'smartpos' ? 'text-base' : 'text-sm'} font-bold text-blue-600`}>
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

                      {isAvailable && !isViewOnly && <Button variant="default" size="sm" className={`w-full text-xs bg-blue-600 hover:bg-blue-700 text-white ${deviceMode === 'smartpos' ? 'h-10 text-sm' : 'h-6'}`}>
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
            
            <div className={`flex-1 grid ${gridCols} gap-3`}>
              {machines.filter(machine => machine.type === "secadora").slice(0, deviceMode === 'smartpos' ? 4 : 6).map(machine => {
                const IconComponent = machine.icon;
                const isAvailable = machine.status === "available";
                return <Card key={machine.id} className={`relative overflow-hidden transition-all duration-300 ${isAvailable && !isViewOnly ? 'cursor-pointer' : isViewOnly ? 'cursor-default' : 'cursor-not-allowed'} bg-white ${isAvailable && !isViewOnly ? 'hover:shadow-lg hover:scale-105 border border-orange-200 hover:border-orange-400' : 'opacity-70 border border-gray-200'} shadow-md rounded-lg h-full flex flex-col`} onClick={() => isAvailable && handleMachineSelect(machine.id)}>
                    {/* Status Badge */}
                    <div className="absolute top-2 right-2 z-10">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(machine.status)} shadow border border-white`}></div>
                    </div>

                    <CardHeader className={`text-center ${deviceMode === 'smartpos' ? 'p-3 pb-2' : 'p-2 pb-1'} flex-shrink-0`}>
                      <div className={`${deviceMode === 'smartpos' ? 'w-12 h-12' : 'w-10 h-10'} bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-1 shadow`}>
                        <IconComponent className="text-white" size={deviceMode === 'smartpos' ? 20 : 16} />
                      </div>
                      <CardTitle className={`${deviceMode === 'smartpos' ? 'text-sm' : 'text-xs'} font-bold text-gray-800 leading-tight`}>{machine.title}</CardTitle>
                    </CardHeader>

                    <CardContent className={`flex-1 ${deviceMode === 'smartpos' ? 'p-3 pt-0' : 'p-2 pt-0'} flex flex-col justify-between`}>
                      <div className="text-center mb-2">
                        <div className="flex items-center justify-center space-x-1 mb-1">
                          <span className={`${deviceMode === 'smartpos' ? 'text-base' : 'text-sm'} font-bold text-orange-600`}>
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

                      {isAvailable && !isViewOnly && <Button variant="default" size="sm" className={`w-full text-xs bg-orange-600 hover:bg-orange-700 text-white ${deviceMode === 'smartpos' ? 'h-10 text-sm' : 'h-6'}`}>
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

      {/* Reconfiguração Secreta de CNPJ */}
      <Dialog open={showReconfigureDialog} onOpenChange={(open) => {
        setShowReconfigureDialog(open);
        if (!open) { setReconfigurePin(''); setReconfigureCnpj(''); setReconfigureError(''); setPinAttempts(0); setShowReconfigurePin(false); }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>🔧 Reconfiguração do Totem</DialogTitle>
            <DialogDescription>
              {reconfigureStep === 'pin'
                ? 'Digite o PIN de administrador para continuar.'
                : `Totem atual: ${currentLaundry?.name || '—'}. Digite o CNPJ da nova lavanderia.`}
            </DialogDescription>
          </DialogHeader>

          {reconfigureStep === 'pin' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reconfig-pin">PIN Administrativo</Label>
                <div className="relative">
                  <Input
                    id="reconfig-pin"
                    type={showReconfigurePin ? 'text' : 'password'}
                    placeholder="••••"
                    value={reconfigurePin}
                    onChange={(e) => { setReconfigurePin(e.target.value.slice(0, 8)); setReconfigureError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleReconfigurePin()}
                    inputMode="numeric"
                    className="text-center text-xl tracking-widest pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowReconfigurePin(v => !v)}
                  >
                    {showReconfigurePin ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {reconfigureError && <p className="text-destructive text-sm flex items-center gap-1"><XCircle size={14} />{reconfigureError}</p>}
              </div>
              <div className="flex gap-2">
                <button
                  className="flex-1 border border-input rounded-md px-4 py-2 text-sm hover:bg-accent"
                  onClick={() => setShowReconfigureDialog(false)}
                >
                  Cancelar
                </button>
                <button
                  className="flex-1 bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                  onClick={handleReconfigurePin}
                  disabled={reconfigurePin.length === 0}
                >
                  Confirmar
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reconfig-cnpj">CNPJ da Nova Lavanderia</Label>
                <Input
                  id="reconfig-cnpj"
                  placeholder="00000000000000 (14 dígitos)"
                  value={reconfigureCnpj}
                  onChange={(e) => { setReconfigureCnpj(e.target.value.replace(/\D/g, '').slice(0, 14)); setReconfigureError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleReconfigureCNPJ()}
                  inputMode="numeric"
                  className="text-center text-lg tracking-widest font-mono"
                  disabled={reconfigureLoading}
                />
                {reconfigureError && <p className="text-destructive text-sm flex items-center gap-1"><XCircle size={14} />{reconfigureError}</p>}
              </div>
              <button
                className="w-full bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
                onClick={handleReconfigureCNPJ}
                disabled={reconfigureLoading || reconfigureCnpj.replace(/\D/g, '').length !== 14}
              >
                {reconfigureLoading ? <><Loader2 size={16} className="animate-spin" />Buscando...</> : <><RefreshCw size={16} />Reconfigurar Totem</>}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>;
};

export default Totem;