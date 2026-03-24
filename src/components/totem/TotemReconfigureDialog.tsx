import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { XCircle, Eye, EyeOff, Loader2, RefreshCw, Activity } from "lucide-react";
import { nativeStorage } from "@/utils/nativeStorage";
import { useToast } from "@/hooks/use-toast";
import { TotemDiagnostics } from "./TotemDiagnostics";
import type { Machine } from "@/hooks/useMachines";

interface TotemReconfigureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  validatePin: (pin: string) => Promise<boolean>;
  configureTotemByCNPJ: (cnpj: string) => Promise<boolean>;
  currentLaundryName?: string;
  currentLaundryId?: string;
  currentLaundryCnpj?: string;
  machines: Machine[];
  isOffline: boolean;
}

export const TotemReconfigureDialog = ({
  open,
  onOpenChange,
  validatePin,
  configureTotemByCNPJ,
  currentLaundryName,
  currentLaundryId,
  currentLaundryCnpj,
  machines,
  isOffline,
}: TotemReconfigureDialogProps) => {
  const [step, setStep] = useState<'pin' | 'menu' | 'cnpj' | 'diagnostics'>('pin');
  const [pin, setPin] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pinAttempts, setPinAttempts] = useState(0);
  const { toast } = useToast();

  const reset = () => {
    setStep('pin');
    setPin('');
    setCnpj('');
    setError('');
    setShowPin(false);
    setPinAttempts(0);
    setLoading(false);
  };

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open);
    if (!open) reset();
  };

  const handlePinSubmit = async () => {
    setLoading(true);
    const isValid = await validatePin(pin);
    setLoading(false);

    if (isValid) {
      setStep('menu');
      setError('');
      setPin('');
      setPinAttempts(0);
    } else {
      const attempts = pinAttempts + 1;
      setPinAttempts(attempts);
      setPin('');
      if (attempts >= 3) {
        handleOpenChange(false);
        toast({ title: "Acesso bloqueado", description: "Máximo de tentativas atingido.", variant: "destructive" });
      } else {
        setError(`PIN incorreto. Tentativa ${attempts}/3.`);
      }
    }
  };

  const handleCNPJSubmit = async () => {
    const clean = cnpj.replace(/\D/g, '');
    if (clean.length !== 14) {
      setError('CNPJ deve ter 14 dígitos.');
      return;
    }
    setLoading(true);
    setError('');
    await nativeStorage.removeItem('totem_laundry_id');
    const success = await configureTotemByCNPJ(clean);
    setLoading(false);
    if (success) {
      handleOpenChange(false);
      toast({ title: "✅ Totem Reconfigurado", description: "Nova lavanderia carregada com sucesso." });
    } else {
      setError('CNPJ não encontrado ou lavanderia inativa.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>🔧 Reconfiguração do Totem</DialogTitle>
          <DialogDescription>
            {step === 'pin' && 'Digite o PIN de administrador para continuar.'}
            {step === 'menu' && 'Selecione uma opção:'}
            {step === 'cnpj' && `Totem atual: ${currentLaundryName || '—'}. Digite o CNPJ da nova lavanderia.`}
            {step === 'diagnostics' && 'Informações de diagnóstico do totem.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'pin' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reconfig-pin">PIN Administrativo</Label>
              <div className="relative">
                <Input
                  id="reconfig-pin"
                  type={showPin ? 'text' : 'password'}
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => { setPin(e.target.value.slice(0, 8)); setError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
                  inputMode="numeric"
                  className="text-center text-xl tracking-widest pr-10"
                  disabled={loading}
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPin(v => !v)}>
                  {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {error && <p className="text-destructive text-sm flex items-center gap-1"><XCircle size={14} />{error}</p>}
            </div>
            <div className="flex gap-2">
              <button className="flex-1 border border-input rounded-md px-4 py-2 text-sm hover:bg-accent" onClick={() => handleOpenChange(false)}>Cancelar</button>
              <button className="flex-1 bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50" onClick={handlePinSubmit} disabled={pin.length === 0 || loading}>
                {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Confirmar'}
              </button>
            </div>
          </div>
        )}

        {step === 'menu' && (
          <div className="space-y-3">
            <button
              className="w-full flex items-center gap-3 p-3 border border-input rounded-lg hover:bg-accent text-left"
              onClick={() => { setStep('cnpj'); setError(''); }}
            >
              <RefreshCw size={20} className="text-primary flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Reconfigurar CNPJ</p>
                <p className="text-xs text-muted-foreground">Trocar a lavanderia vinculada ao totem</p>
              </div>
            </button>
            <button
              className="w-full flex items-center gap-3 p-3 border border-input rounded-lg hover:bg-accent text-left"
              onClick={() => setStep('diagnostics')}
            >
              <Activity size={20} className="text-primary flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Diagnósticos</p>
                <p className="text-xs text-muted-foreground">Ver status do sistema e informações do dispositivo</p>
              </div>
            </button>
          </div>
        )}

        {step === 'cnpj' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reconfig-cnpj">CNPJ da Nova Lavanderia</Label>
              <Input
                id="reconfig-cnpj"
                placeholder="00000000000000 (14 dígitos)"
                value={cnpj}
                onChange={(e) => { setCnpj(e.target.value.replace(/\D/g, '').slice(0, 14)); setError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleCNPJSubmit()}
                inputMode="numeric"
                className="text-center text-lg tracking-widest font-mono"
                disabled={loading}
              />
              {error && <p className="text-destructive text-sm flex items-center gap-1"><XCircle size={14} />{error}</p>}
            </div>
            <div className="flex gap-2">
              <button className="flex-1 border border-input rounded-md px-4 py-2 text-sm hover:bg-accent" onClick={() => setStep('menu')}>Voltar</button>
              <button
                className="flex-1 bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
                onClick={handleCNPJSubmit}
                disabled={loading || cnpj.replace(/\D/g, '').length !== 14}
              >
                {loading ? <><Loader2 size={16} className="animate-spin" />Buscando...</> : <><RefreshCw size={16} />Reconfigurar</>}
              </button>
            </div>
          </div>
        )}

        {step === 'diagnostics' && (
          <div className="space-y-4">
            <TotemDiagnostics
              laundryName={currentLaundryName}
              laundryId={currentLaundryId}
              laundryCnpj={currentLaundryCnpj}
              machines={machines}
              isOffline={isOffline}
            />
            <button className="w-full border border-input rounded-md px-4 py-2 text-sm hover:bg-accent" onClick={() => setStep('menu')}>Voltar</button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
