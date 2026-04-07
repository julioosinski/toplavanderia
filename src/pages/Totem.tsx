import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { Wifi, Shield, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useKioskSecurity } from "@/hooks/useKioskSecurity";
import { resolvedRelayPin } from "@/lib/machineEsp32Sync";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useMachines, type Machine } from "@/hooks/useMachines";
import { useLaundry } from "@/contexts/LaundryContext";
import { useCapacitorIntegration } from "@/hooks/useCapacitorIntegration";
import { UniversalPaymentConfig } from '@/hooks/useUniversalPayment';
import { usePixPayment } from '@/hooks/usePixPayment';
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
  const [paymentStep, setPaymentStep] = useState<
    "select" | "confirm" | "payment" | "processing" | "activating" | "success" | "error" | "pix_qr"
  >("select");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showConfig, setShowConfig] = useState(false);
  const [transactionData, setTransactionData] = useState<any>(null);
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [adminClickCount, setAdminClickCount] = useState(0);
  const [pixPaymentData, setPixPaymentData] = useState<any>(null);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const pixPollDoneRef = useRef(false);

  // Logo tap gesture for reconfiguration
  const [logoTapCount, setLogoTapCount] = useState(0);
  const [showReconfigureDialog, setShowReconfigureDialog] = useState(false);

  const { mode: deviceMode, isPWA, canProcessPayments } = useDeviceMode();
  const { settings: systemSettings } = useSystemSettings();
  const { toast } = useToast();
  const { currentLaundry, loading: laundryLoading, configureTotemByCNPJ } = useLaundry();
  const { disableSecurity, enableSecurity } = useKioskSecurity();
  const { authenticate: adminAuthenticate, validatePin } = useAdminAccess();
  const { machines, loading, isOffline, updateMachineStatus, rememberRunningAfterPayment, refreshMachines } = useMachines(currentLaundry?.id);
  const refreshMachinesRef = useRef(refreshMachines);
  refreshMachinesRef.current = refreshMachines;
  const { isNative, deviceInfo, isReady, enableKioskMode } = useCapacitorIntegration();

  // Configs
  const [tefConfig, setTefConfig] = useState({
    host: "127.0.0.1",
    port: "4321",
    terminalId: "001",
    timeout: 60000,
    retryAttempts: 3,
    retryDelay: 2000,
  });
  const [paygoConfig, setPaygoConfig] = useState({
    host: 'localhost', port: 8080, automationKey: '', timeout: 30000, retryAttempts: 3
  });

  const universalConfig: UniversalPaymentConfig = useMemo(
    () => ({
      paygo: {
        ...paygoConfig,
        port: Number(paygoConfig.port) || 31735,
        provider: systemSettings?.paygo_provedor || 'paygo',
      },
      tef: {
        host: tefConfig.host,
        port: tefConfig.port,
        terminalId: tefConfig.terminalId,
        timeout: tefConfig.timeout,
        retryAttempts: tefConfig.retryAttempts,
        retryDelay: tefConfig.retryDelay,
      },
      smartPosMode: deviceMode === 'smartpos',
      provider: systemSettings?.paygo_provedor || 'paygo',
    }),
    [paygoConfig, tefConfig, deviceMode, systemSettings?.paygo_provedor]
  );

  const pixHookConfig = useMemo(
    () => ({
      host: paygoConfig.host,
      port: Number(paygoConfig.port) || 31735,
      automationKey: paygoConfig.automationKey,
      timeout: paygoConfig.timeout,
    }),
    [paygoConfig.host, paygoConfig.port, paygoConfig.automationKey, paygoConfig.timeout]
  );

  const { checkPixPaymentStatus } = usePixPayment(pixHookConfig);

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
      const defaultHost = systemSettings.paygo_host || "pos-transac-sb.tpgweb.io";
      let tefHost = defaultHost;
      let tefPort = "8080";
      try {
        const raw = systemSettings.tef_config?.trim();
        if (raw) {
          const j = JSON.parse(raw) as Record<string, unknown>;
          if (typeof j.host === "string" && j.host.trim()) tefHost = j.host.trim();
          if (typeof j.port === "number" && Number.isFinite(j.port)) tefPort = String(j.port);
          else if (typeof j.port === "string" && j.port.trim()) tefPort = j.port.trim();
        }
      } catch {
        /* JSON inválido: manter defaults */
      }
      const terminalId =
        (systemSettings.tef_terminal_id && String(systemSettings.tef_terminal_id).trim()) || "001";

      setTefConfig({
        host: tefHost,
        port: tefPort,
        terminalId,
        timeout: systemSettings.paygo_timeout || 30000,
        retryAttempts: systemSettings.paygo_retry_attempts || 3,
        retryDelay: systemSettings.paygo_retry_delay || 2000,
      });
      setPaygoConfig({
        host: systemSettings.paygo_host || 'pos-transac-sb.tpgweb.io',
        port: systemSettings.paygo_port || 31735,
        automationKey: systemSettings.paygo_automation_key || '',
        timeout: systemSettings.paygo_timeout || 30000,
        retryAttempts: systemSettings.paygo_retry_attempts || 3,
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

  /** Ao voltar à grade, puxar preços/status frescos (útil no tablet com Realtime instável) */
  useEffect(() => {
    if (paymentStep !== "select") return;
    void refreshMachinesRef.current({ background: true });
  }, [paymentStep]);

  /** Manter máquina selecionada alinhada à lista (admin alterou preço no painel) */
  const selectedId = selectedMachine?.id;
  useEffect(() => {
    if (!selectedId) return;
    setSelectedMachine((prev) => {
      if (!prev || prev.id !== selectedId) return prev;
      const fresh = machines.find((m) => m.id === selectedId);
      if (!fresh) return prev;
      if (
        prev.price === fresh.price &&
        prev.duration === fresh.duration &&
        prev.status === fresh.status &&
        prev.timeRemaining === fresh.timeRemaining &&
        prev.runningSinceAt === fresh.runningSinceAt
      ) {
        return prev;
      }
      return fresh;
    });
  }, [machines, selectedId]);

  const activateMachine = useCallback(
    async (paymentMethod: string = 'TEF') => {
      if (!selectedMachine || !currentLaundry) return;
      try {
        const esp32Id = selectedMachine.esp32_id || 'main';
        const relayPin = resolvedRelayPin(selectedMachine.relay_pin);

        await supabase.from('transactions').insert({
          machine_id: selectedMachine.id,
          total_amount: selectedMachine.price,
          duration_minutes: selectedMachine.duration,
          status: 'pending',
          payment_method: paymentMethod,
          laundry_id: currentLaundry.id,
          started_at: new Date().toISOString(),
        }).select().single();

        const { data: espData, error: espErr } = await supabase.functions.invoke('esp32-control', {
          body: {
            esp32_id: esp32Id,
            relay_pin: relayPin,
            action: 'on',
            machine_id: selectedMachine.id,
          },
        });
        if (espErr) throw espErr;
        if (espData && typeof espData === 'object' && 'success' in espData && espData.success === false) {
          const msg = (espData as { error?: string }).error || 'Comando não enfileirado';
          throw new Error(msg);
        }

        rememberRunningAfterPayment(selectedMachine.id, selectedMachine.duration);
        await updateMachineStatus(selectedMachine.id, 'running', { suppressErrorToast: true });
      } catch (error) {
        console.error('Erro ao ativar máquina:', error);
        toast({
          title: 'Atenção',
          description: 'Pagamento aprovado, mas o comando do ESP32 falhou. Verifique esp32_id e fila pending_commands.',
          variant: 'destructive',
        });
      }
    },
    [selectedMachine, currentLaundry, updateMachineStatus, rememberRunningAfterPayment, toast]
  );

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
    pixPollDoneRef.current = false;
    setPixPaymentData({
      ...result,
      amount: selectedMachine?.price,
      orderId: result.orderId ?? result.data?.orderId,
    });
    setPaymentStep('pix_qr');
  };

  useEffect(() => {
    if (paymentStep !== 'pix_qr' || !pixPaymentData?.orderId) return;

    const orderId = String(pixPaymentData.orderId);
    const expiresMs = (Number(pixPaymentData.expiresIn) || 300) * 1000;

    const tick = async () => {
      if (pixPollDoneRef.current) return;
      try {
        const st = await checkPixPaymentStatus(orderId);
        if (st.status === 'paid') {
          pixPollDoneRef.current = true;
          setPaymentStep('activating');
          await activateMachine('PIX');
          setTransactionData({
            paymentMethod: 'PIX',
            orderId,
            transactionId: st.transactionId,
            paidAt: st.paidAt,
          });
          setPaymentStep('success');
        } else if (st.status === 'expired' || st.status === 'cancelled') {
          pixPollDoneRef.current = true;
          toast({
            title: 'PIX',
            description:
              st.status === 'cancelled'
                ? 'Pagamento cancelado.'
                : 'O QR Code PIX expirou. Inicie o pagamento novamente.',
            variant: 'destructive',
          });
          resetTotem();
        }
      } catch (e) {
        console.warn('PIX poll:', e);
      }
    };

    const id = window.setInterval(() => void tick(), 2500);
    void tick();
    const max = window.setTimeout(() => {
      window.clearInterval(id);
      if (!pixPollDoneRef.current) {
        pixPollDoneRef.current = true;
        toast({
          title: 'PIX',
          description: 'Tempo esgotado aguardando o PIX. Tente novamente.',
          variant: 'destructive',
        });
        resetTotem();
      }
    }, expiresMs + 20_000);

    return () => {
      window.clearInterval(id);
      window.clearTimeout(max);
    };
  }, [
    paymentStep,
    pixPaymentData?.orderId,
    pixPaymentData?.expiresIn,
    checkPixPaymentStatus,
    activateMachine,
    resetTotem,
    toast,
  ]);

  // === RENDER ===

  if (showConfig) {
    return (
      <SecureTEFConfig
        config={{
          host: tefConfig.host,
          port: tefConfig.port,
          timeout: tefConfig.timeout,
          retryAttempts: tefConfig.retryAttempts,
          retryDelay: tefConfig.retryDelay,
        }}
        onConfigChange={(c) => setTefConfig((prev) => ({ ...prev, ...c }))}
        onClose={() => setShowConfig(false)}
      />
    );
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
  if (paymentStep === "activating") {
    return <ProcessingScreen variant="activating" onCancel={resetTotem} />;
  }
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
          setPaymentStep('activating');
          await activateMachine(`Universal - ${result.method.toUpperCase()}`);
          setTransactionData(result.data);
          setPaymentStep('success');
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
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      <TotemHeader
        currentTime={currentTime}
        deviceMode={deviceMode}
        isOffline={isOffline}
        laundryName={currentLaundry?.name}
        onLogoTap={handleLogoTap}
        tapCount={logoTapCount}
      />

      {isViewOnly && (
        <div className="px-2 shrink-0">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
            <Shield className="h-3 w-3 flex-shrink-0" />
            Modo Visualização — Pagamentos no totem físico
          </div>
        </div>
      )}

      <TotemMachineGrid machines={machines} deviceMode={deviceMode} isViewOnly={isViewOnly} onSelect={handleMachineSelect} />

      {/* Compact footer */}
      <div className="px-2 py-1 text-center shrink-0">
        <div className="flex items-center justify-center gap-2 text-gray-400 text-[10px]">
          <Wifi size={10} />
          <span className="cursor-pointer select-none" onClick={handleAdminAccess}>
            {currentLaundry?.name || 'Lavanderia'}
          </span>
          {adminClickCount >= 3 && (
            <div className="flex space-x-0.5">
              {Array.from({ length: adminClickCount - 2 }, (_, i) => (
                <div key={i} className="w-1 h-1 rounded-full bg-gray-400 animate-scale-in" />
              ))}
            </div>
          )}
          <Link to="/auth" className="underline-offset-2 hover:underline text-gray-300">
            Equipe
          </Link>
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
