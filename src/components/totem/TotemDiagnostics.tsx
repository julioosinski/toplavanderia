import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Copy, CheckCircle, Wifi, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Machine } from "@/hooks/useMachines";

interface TotemDiagnosticsProps {
  laundryName?: string;
  laundryId?: string;
  laundryCnpj?: string;
  machines: Machine[];
  isOffline: boolean;
}

export const TotemDiagnostics = ({ laundryName, laundryId, laundryCnpj, machines, isOffline }: TotemDiagnosticsProps) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const online = machines.filter(m => m.status !== 'offline').length;
  const running = machines.filter(m => m.status === 'running').length;
  const available = machines.filter(m => m.status === 'available').length;
  const offline = machines.filter(m => m.status === 'offline').length;

  const diagnosticText = [
    `Lavanderia: ${laundryName || 'N/A'}`,
    `CNPJ: ${laundryCnpj || 'N/A'}`,
    `ID: ${laundryId || 'N/A'}`,
    `Conexão: ${isOffline ? 'Offline (cache)' : 'Online'}`,
    `Máquinas: ${machines.length} total | ${available} disponíveis | ${running} em uso | ${offline} offline`,
    `Versão: 2.1.0`,
    `Timestamp: ${new Date().toISOString()}`,
    `User-Agent: ${navigator.userAgent}`,
  ].join('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(diagnosticText);
      setCopied(true);
      toast({ title: "Copiado!", description: "Diagnóstico copiado para a área de transferência." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Erro", description: "Não foi possível copiar.", variant: "destructive" });
    }
  };

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between text-sm py-1 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs text-right max-w-[60%] truncate">{value}</span>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="rounded-lg border p-3 space-y-1">
        <Row label="Lavanderia" value={laundryName || 'N/A'} />
        <Row label="CNPJ" value={laundryCnpj || 'N/A'} />
        <Row label="ID" value={laundryId?.slice(0, 8) + '...' || 'N/A'} />
      </div>

      <div className="rounded-lg border p-3 space-y-1">
        <div className="flex items-center gap-2 mb-2">
          {isOffline ? <WifiOff size={14} className="text-amber-500" /> : <Wifi size={14} className="text-green-500" />}
          <Badge variant={isOffline ? "secondary" : "default"} className="text-xs">
            {isOffline ? 'Offline (cache)' : 'Online'}
          </Badge>
        </div>
        <Row label="Total" value={`${machines.length} máquinas`} />
        <Row label="Disponíveis" value={`${available}`} />
        <Row label="Em uso" value={`${running}`} />
        <Row label="Offline" value={`${offline}`} />
      </div>

      <div className="rounded-lg border p-3 space-y-1">
        <Row label="Versão" value="2.1.0" />
        <Row label="Plataforma" value={navigator.userAgent.includes('Android') ? 'Android' : 'Web'} />
      </div>

      <button
        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-primary/90"
        onClick={handleCopy}
      >
        {copied ? <><CheckCircle size={16} />Copiado!</> : <><Copy size={16} />Copiar Diagnóstico</>}
      </button>
    </div>
  );
};
