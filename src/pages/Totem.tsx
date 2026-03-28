import { useState, useEffect, useCallback } from "react";
import { Wifi, Shield, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useKioskSecurity } from "@/hooks/useKioskSecurity";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useMachines, type Machine } from "@/hooks/useMachines";
import { useLaundry } from "@/contexts/LaundryContext";
import { useCapacitorIntegration } from "@/hooks/useCapacitorIntegration";
import { UniversalPaymentConfig } from '@/hooks/useUniversalPayment';
import { PixQRDisplay } from '@/components/payment/PixQRDisplay';
import { SecureTEFConfig } from "@/components/admin/SecureTEFConfig";
import { AdminPinDialog } from "@/components/admin/AdminPinDialog";
import { supabase } from "@/integrations/supabase/client";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useDeviceMode } from "@/hooks/useDeviceMode";

// Totem sub-components
import { TotemHeader } from "@/components/totem/TotemHeader";
import { TotemMachineGrid } from "@/components/totem/TotemMachineGrid";
import { TotemCNPJSetup } from "@/components/totem/TotemCNPJSetup";
import { TotemReconfigureDialog } from "@/components/totem/TotemReconfigureDialog";
import { ProcessingScreen, ErrorScreen, SuccessScreen, PaymentScreen } from "@/components/totem/TotemPaymentScreens";

const Totem = () => {
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [paymentStep, setPaymentStep] = useState<"select" | "confirm" | "payment" | "processing" | "success" | "error" | "pix_qr">("select");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showConfig, setShowConfig] = useState(false);
  const [transactionData, setTransactionData] = useState<any>(null);
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [adminClickCount, setAdminClickCount] = useState(0);
  const [pixPaymentData, setPixPaymentData] = useState<any>(null);
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  // Logo tap gesture for reconfiguration
  const [logoTapCount, setLogoTapCount] = useState(0);
  const [showReconfigureDialog, setShowReconfigureDialog] = useState(false);

  const { mode: deviceMode, isPWA, canProcessPayments } = useDeviceMode();
  const { settings: systemSettings } = useSystemSettings();
  const { toast } = useToast();
  const { currentLaundry, loading: laundryLoading, configureTotemByCNPJ } = useLaundry();
  const { disableSecurity, enableSecurity } = useKioskSecurity();
  const { authenticate: adminAuthenticate, validatePin } = useAdminAccess();
  const { machines, loading, isOffline, updateMachineStatus } = useMachines(currentLaundry?.id);
  const { isNative, deviceInfo, isReady, enableKioskMode } = useCapacitorIntegration();

  // Configs
  const [tefConfig, setTefConfig] = useState({
    host: "127.0.0.1", port: "4321", timeout: 60000, retryAttempts: 3, retryDelay: 2000
  });
  const [paygoConfig, setPaygoConfig] = useState({
    host: 'localhost', port: 8080, automationKey: '', timeout: 30000, retryAttempts: 3
  });

  const universalConfig: UniversalPaymentConfig = {
    paygo: paygoConfig, tef: tefConfig, smartPosMode: deviceMode === 'smartpos'
  };

  // Loading timeout safety
  useEffect(() => {
    const timer = setTimeout(() => {
      if (laundryLoading && !currentLaundry) setLoadingTimeout(true);
    }, 8000);
    return () => clearTimeout(timer);
  }, [laundryLoading, currentLaundry]);

  // Sempre que houver lavanderia configurada ou loading concluir sem travar,
  // remover estado de timeout para permitir a navegação normal.
  useEffect(() => {
    if (currentLaundry || !laundryLoading) {
      setLoadingTimeout(false);
    }
  }, [currentLaundry, laundryLoading]);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto kiosk mode
  useEffect(() => {
    const timer = setTimeout(() => {
      enableSecurity();
      if (isNative && isReady) enableKioskMode();
    }, 2000);
    return () => clearTimeout(timer);
  }, [enableSecurity, isNative, isReady, enableKioskMode]);

  // Device info toast
  useEffect(() => {
    if (isNative && deviceInfo) {
      toast({ title: "Modo Tablet Ativo", description: `Executando em ${deviceInfo.platform} - ${deviceInfo.model}` });
    }
  }, [isNative, deviceInfo, toast]);

  // Sync system settings
  useEffect(() => {
    if (systemSettings) {
      setTefConfig({
        host: systemSettings.paygo_host || "pos-transac-sb.tpgweb.io",
        port: systemSettings.tef_terminal_id || "102251",
        timeout: systemSettings.paygo_timeout || 30000,
        retryAttempts: systemSettings.paygo_retry_attempts || 3,
        retryDelay: systemSettings.paygo_retry_delay || 2000
      });
      setPaygoConfig({
        host: systemSettings.paygo_host || 'pos-transac-sb.tpgweb.io',
        port: systemSettings.paygo_port || 31735,
        automationKey: systemSettings.paygo_automation_key || '',
        timeout: systemSettings.paygo_timeout || 30000,
        retryAttempts: systemSettings.paygo_retry_attempts || 3
      });
    }
  }, [systemSettings]);

  const handleMachineSelect = (machineId: string) => {
    if (!canProcessPayments) return;
    const machine = machines.find(m => m.id === machineId);
    if (machine && machine.status === "available") {
      setSelectedMachine(machine);
      setPaymentStep("payment");
    }
  };

  const activateMachine = async (paymentMethod: string = 'TEF') => {
    if (!selectedMachine || !currentLaundry) return;
    try {
      await updateMachineStatus(selectedMachine.id, 'running');
      const { data: txData } = await supabase.from('transactions').insert({
        machine_id: selectedMachine.id,
        total_amount: selectedMachine.price,
        duration_minutes: selectedMachine.duration,
        status: 'pending',
        payment_method: paymentMethod,
        laundry_id: currentLaundry.id,
        started_at: new Date().toISOString(),
      }).select().single();

      if (selectedMachine.esp32_id) {
        try {
          await supabase.functions.invoke('esp32-control', {
            body: {
              esp32_id: selectedMachine.esp32_id,
              relay_pin: selectedMachine.relay_pin || 1,
              action: 'on',
              machine_id: selectedMachine.id,
            }
          });
        } catch (e) {
          console.warn("⚠️ ESP32 communication error:", e);
        }
      }
    } catch (error) {
      console.error("Erro ao ativar máquina:", error);
      toast({ title: "Atenção", description: "Pagamento aprovado, mas houve erro na ativação.", variant: "destructive" });
    }
  };

  const resetTotem = useCallback(() => {
    setSelectedMachine(null);
    setPaymentStep("select");
    setTransactionData(null);
    setPixPaymentData(null);
  }, []);

  // Admin footer gesture (7 clicks)
  const handleAdminAccess = () => {
    const newCount = adminClickCount + 1;
    setAdminClickCount(newCount);
    if (newCount >= 7) { setShowAdminDialog(true); setAdminClickCount(0); }
    setTimeout(() => setAdminClickCount(0), 3000);
  };

  const handleAdminAuthenticate = async (pin: string) => {
    const success = await adminAuthenticate(pin);
    if (success) {
      toast({ title: "Modo Administrativo", description: "Segurança desativada temporariamente" });
      disableSecurity();
      setShowConfig(true);
    }
    return success;
  };

  // Logo tap gesture (7 clicks)
  const handleLogoTap = () => {
    const newCount = logoTapCount + 1;
    setLogoTapCount(newCount);
    if (newCount >= 7) { setShowReconfigureDialog(true); setLogoTapCount(0); }
    setTimeout(() => setLogoTapCount(0), 3000);
  };

  const handlePixQR = (result: any) => {
    setPixPaymentData({ ...result, amount: selectedMachine?.price, orderId: result.data?.orderId });
    setPaymentStep("pix_qr");
  };

  // === RENDER ===

  if (showConfig) {
    return <SecureTEFConfig config={tefConfig} onConfigChange={setTefConfig} onClose={() => setShowConfig(false)} />;
  }

  // CNPJ Setup (no laundry configured or loading timeout)
  if (!currentLaundry && (!laundryLoading || loadingTimeout)) {
    return <TotemCNPJSetup onConfigure={configureTotemByCNPJ} />;
  }

  // Loading: não bloquear pelo system_settings — no totem as configs PayGo/TEF já têm
  // defaults locais; a query de system_settings pode travar (RLS/rede) e deixaria a tela presa.
  if (laundryLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-clean flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="mx-auto animate-spin text-primary" size={48} />
          <h2 className="text-xl font-semibold">Carregando máquinas...</h2>
          <p className="text-muted-foreground">Conectando com o sistema</p>
        </div>
      </div>
    );
  }

  if (!loading && machines.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-clean flex items-center justify-center p-6">
        <div className="text-center space-y-3 max-w-md">
          <h2 className="text-xl font-semibold">Nenhuma máquina encontrada</h2>
          <p className="text-muted-foreground">
            Verifique o vínculo de máquinas da lavanderia configurada ou a conexão com o Supabase.
          </p>
          <button
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground"
            onClick={() => window.location.reload()}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // Payment flow screens
  if (paymentStep === "processing") return <ProcessingScreen onCancel={resetTotem} />;
  if (paymentStep === "error") return <ErrorScreen onRetry={() => setPaymentStep("payment")} onCancel={resetTotem} />;

  if (paymentStep === "pix_qr" && pixPaymentData) {
    return (
      <PixQRDisplay
        qrCode={pixPaymentData.qrCode}
        qrCodeBase64={pixPaymentData.qrCodeBase64}
        pixKey={pixPaymentData.pixKey}
        amount={pixPaymentData.amount}
        timeRemaining={pixPaymentData.expiresIn || 300}
        totalTime={pixPaymentData.expiresIn || 300}
        onCancel={resetTotem}
        onCopyCode={() => console.log("Pix code copied")}
      />
    );
  }

  if (paymentStep === "success") {
    return <SuccessScreen machine={selectedMachine} transactionData={transactionData} onReset={resetTotem} />;
  }

  if (paymentStep === "payment" && selectedMachine) {
    return (
      <PaymentScreen
        machine={selectedMachine}
        config={universalConfig}
        deviceMode={deviceMode}
        onSuccess={async (result) => { 
          await activateMachine(`Universal - ${result.method.toUpperCase()}`); 
          setTransactionData(result.data);
          setPaymentStep("success"); 
        }}
        onError={(err) => { toast({ title: "Erro no Pagamento", description: err, variant: "destructive" }); setPaymentStep('error'); }}
        onCancel={resetTotem}
        onPixQR={handlePixQR}
      />
    );
  }

  const isViewOnly = isPWA;

  // Main screen
  return (
    <div className={`h-screen bg-white flex flex-col ${deviceMode === 'smartpos' ? 'overflow-auto' : 'overflow-hidden'}`}>
      <TotemHeader
        currentTime={currentTime}
        deviceMode={deviceMode}
        isOffline={isOffline}
        laundryName={currentLaundry?.name}
        onLogoTap={handleLogoTap}
        tapCount={logoTapCount}
      />

      {isViewOnly && (
        <div className="container mx-auto px-2 pb-2">
          <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
            <Shield className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-700">Modo Visualização — Pagamentos disponíveis apenas no totem físico (Android)</p>
          </div>
        </div>
      )}

      {!isViewOnly && (
        <div className="container mx-auto px-2 pb-1">
          <p className="text-center text-sm text-muted-foreground">Toque em uma máquina disponível para iniciar</p>
        </div>
      )}

      <TotemMachineGrid machines={machines} deviceMode={deviceMode} isViewOnly={isViewOnly} onSelect={handleMachineSelect} />

      {/* Footer */}
      <div className="container mx-auto px-2 py-2 text-center">
        <div className="flex items-center justify-center space-x-2 text-gray-500">
          <Wifi size={12} />
          <span className="text-xs cursor-pointer select-none" onClick={handleAdminAccess}>
            Sistema Online — {currentLaundry?.name || 'Lavanderia'}
          </span>
          {adminClickCount >= 3 && (
            <div className="flex space-x-0.5 ml-1">
              {Array.from({ length: adminClickCount - 2 }, (_, i) => (
                <div key={i} className="w-1 h-1 rounded-full bg-gray-400 animate-scale-in" />
              ))}
            </div>
          )}
        </div>
      </div>

      <AdminPinDialog open={showAdminDialog} onOpenChange={setShowAdminDialog} onAuthenticate={handleAdminAuthenticate} title="Acesso Administrativo" description="Desativar temporariamente as medidas de segurança do kiosk" />

      <TotemReconfigureDialog
        open={showReconfigureDialog}
        onOpenChange={setShowReconfigureDialog}
        validatePin={validatePin}
        configureTotemByCNPJ={configureTotemByCNPJ}
        currentLaundryName={currentLaundry?.name}
        currentLaundryId={currentLaundry?.id}
        currentLaundryCnpj={currentLaundry?.cnpj}
        machines={machines}
        isOffline={isOffline}
      />
    </div>
  );
};

export default Totem;
