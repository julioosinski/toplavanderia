import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { type Machine } from "@/hooks/useMachines";
import { Clock, DollarSign, MapPin, Cpu, Wifi, Play, Zap, AlertTriangle, ShieldOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { forceMachineReleased } from "@/lib/machineEsp32Sync";
import { adminRemoteRelease } from "@/lib/deviceRemoteRelease";
import { reaisToCentavos } from "@/lib/money";
import { supabase } from "@/integrations/supabase/client";
import { getMachineTypeMeta } from "@/lib/machineDisplayTypes";
import { useOperatorReleasePermission } from "@/hooks/useOperatorReleasePermission";

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const classifyReleaseError = (message: string): { title: string; description: string } => {
  const m = message.toLowerCase();
  if (m.includes("limite diário") || m.includes("limite diario")) {
    return { title: "Limite diário atingido", description: message };
  }
  if (m.includes("limite mensal")) {
    return { title: "Limite mensal atingido", description: message };
  }
  if (m.includes("sem autorização") || m.includes("sem autorizacao") || m.includes("sem permissão") || m.includes("sem permissao")) {
    return { title: "Sem autorização para liberar", description: message };
  }
  if (m.includes("esp32")) {
    return { title: "ESP32 não configurado", description: message };
  }
  return { title: "Não foi possível liberar", description: message };
};

interface MachineDetailsDialogProps {
  machine: Machine | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAfterAction?: () => void;
}

export const MachineDetailsDialog = ({
  machine,
  open,
  onOpenChange,
  onAfterAction,
}: MachineDetailsDialogProps) => {
  const { toast } = useToast();
  const [releasing, setReleasing] = useState(false);
  const [startingCycle, setStartingCycle] = useState(false);
  const [coffeeCredits, setCoffeeCredits] = useState("");
  const [releasingCoffee, setReleasingCoffee] = useState(false);
  const permission = useOperatorReleasePermission();

  const coffeeCentavos = reaisToCentavos(coffeeCredits);

  if (!machine) return null;

  // Preflight (operator only) — bloqueios de autorização/limite antes de enviar à RPC
  const nextReleaseCents = machine.type === "coffee"
    ? (coffeeCentavos > 0 ? coffeeCentavos : 0)
    : Math.round((machine.price || 0) * 100);
  const wouldExceedDaily =
    permission.isOperator &&
    permission.dayLimitCents != null &&
    nextReleaseCents > 0 &&
    permission.dayCents + nextReleaseCents > permission.dayLimitCents;
  const wouldExceedMonthly =
    permission.isOperator &&
    permission.monthLimitCents != null &&
    nextReleaseCents > 0 &&
    permission.monthCents + nextReleaseCents > permission.monthLimitCents;
  const operatorBlocked = permission.isOperator && !permission.canRelease;
  const releaseBlocked = operatorBlocked || wouldExceedDaily || wouldExceedMonthly;

  const typeMeta = getMachineTypeMeta(machine.type);
  const IconComponent = typeMeta.icon;
  const durationLabel =
    machine.type === "coffee"
      ? "Cardápio configurado no totem"
      : `${machine.duration} minutos`;
  const priceLabel =
    machine.type === "coffee" && machine.price <= 0
      ? "Preços no cardápio"
      : `R$ ${machine.price.toFixed(2)}`;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available": return "bg-green-100 text-green-700";
      case "running": return "bg-blue-100 text-blue-700";
      case "offline": return "bg-red-100 text-red-700";
      case "maintenance": return "bg-amber-100 text-amber-800";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "available": return "Disponível";
      case "running": return "Em uso";
      case "offline": return "Offline";
      case "maintenance": return "Manutenção";
      default: return "Desconhecido";
    }
  };

  const handleStartManualCycle = async () => {
    if (!confirm("Iniciar ciclo manual nesta máquina? Isso será registrado como liberação manual.")) return;

    setStartingCycle(true);
    try {
      const { error } = await adminRemoteRelease({ machineId: machine.id });
      if (error) throw error;

      toast({
        title: "Ciclo manual iniciado",
        description: `${machine.name} — liberação registrada no relatório.`,
      });

      // Small delay to let the DB update propagate before refreshing
      await new Promise(r => setTimeout(r, 800));
      onAfterAction?.();
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Erro ao iniciar ciclo",
        description: e instanceof Error ? e.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setStartingCycle(false);
    }
  };

  const handleReleaseCoffeeCredits = async () => {
    if (coffeeCentavos <= 0) {
      toast({
        title: "Valor inválido",
        description: "Informe um valor em reais maior que zero (ex.: 8,50).",
        variant: "destructive",
      });
      return;
    }

    setReleasingCoffee(true);
    try {
      const { error } = await adminRemoteRelease({
        machineId: machine.id,
        valorCentavos: coffeeCentavos,
      });
      if (error) throw error;

      toast({
        title: "Crédito enfileirado",
        description: `R$ ${(coffeeCentavos / 100).toFixed(2)} — ESP32 executará em alguns segundos.`,
      });
      setCoffeeCredits("");
      onAfterAction?.();
    } catch (e) {
      toast({
        title: "Falha na liberação",
        description: e instanceof Error ? e.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setReleasingCoffee(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 ${typeMeta.iconBg} rounded-full flex items-center justify-center shadow`}
            >
              <IconComponent className="text-primary-foreground" size={20} />
            </div>
            <div>
              <DialogTitle>{machine.name}</DialogTitle>
              <DialogDescription>
                {typeMeta.label}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Badge className={getStatusColor(
              machine.type === "coffee"
                ? machine.espReachable ? "available" : "offline"
                : machine.status
            )}>
              {machine.type === "coffee"
                ? machine.espReachable ? "ESP Online" : "ESP Offline"
                : getStatusText(machine.status)}
            </Badge>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <DollarSign size={14} />
                <span className="text-xs">Preço</span>
              </div>
              <p className="text-lg font-bold">{priceLabel}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock size={14} />
                <span className="text-xs">Duração</span>
              </div>
              <p className="text-lg font-bold">{durationLabel}</p>
            </div>
          </div>

          {machine.location && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin size={14} />
                <span className="text-xs">Localização</span>
              </div>
              <p className="text-sm">{machine.location}</p>
            </div>
          )}

          {machine.esp32_id && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Cpu size={14} />
                <span className="text-xs">ESP32 ID</span>
              </div>
              <p className="text-sm font-mono">{machine.esp32_id}</p>
            </div>
          )}

          {machine.ip_address && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Wifi size={14} />
                <span className="text-xs">Endereço IP</span>
              </div>
              <p className="text-sm font-mono">{machine.ip_address}</p>
            </div>
          )}

          {machine.status === "running" && machine.timeRemaining && (
            <>
              <Separator />
              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tempo restante:</span>
                  <span className="text-lg font-bold text-blue-600">{machine.timeRemaining} min</span>
                </div>
              </div>
            </>
          )}

          <Separator />

          {machine.type === "coffee" && (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
              <Label htmlFor="coffee-credits-input">Valor a liberar (R$)</Label>
              <Input
                id="coffee-credits-input"
                type="text"
                inputMode="decimal"
                placeholder="Ex.: 8,50"
                value={coffeeCredits}
                onChange={(e) => setCoffeeCredits(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Será registrado na transação e enviado ao moedeiro como{" "}
                {coffeeCentavos > 0 ? `${coffeeCentavos} centavos` : "—"}
              </p>
              <Button
                className="w-full bg-amber-600 hover:bg-amber-700 text-primary-foreground"
                disabled={releasingCoffee || coffeeCentavos <= 0}
                onClick={() => void handleReleaseCoffeeCredits()}
              >
                <Zap size={16} className="mr-1" />
                {releasingCoffee ? "Enfileirando…" : "Liberar créditos"}
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>

            {machine.status === "available" && machine.type !== "coffee" && (
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-primary-foreground"
                disabled={startingCycle}
                onClick={handleStartManualCycle}
              >
                <Play size={16} className="mr-1" />
                {startingCycle ? "Iniciando…" : "Iniciar Ciclo Manual"}
              </Button>
            )}

            {machine.status === "running" && (
              <Button
                variant="destructive"
                className="flex-1"
                disabled={releasing}
                onClick={async () => {
                  if (!confirm("Liberar no totem, marcar como disponível e enviar comando para desligar o relé no ESP32?")) return;
                  setReleasing(true);
                  try {
                    const { error } = await forceMachineReleased({ machineId: machine.id });
                    if (error) throw error;
                    toast({
                      title: "Máquina liberada",
                      description: "Status atualizado, relé desligado e comando enviado ao ESP32.",
                    });
                    onAfterAction?.();
                    onOpenChange(false);
                  } catch (e) {
                    toast({
                      title: "Erro ao liberar",
                      description: e instanceof Error ? e.message : "Tente novamente.",
                      variant: "destructive",
                    });
                  } finally {
                    setReleasing(false);
                  }
                }}
              >
                {releasing ? "Liberando…" : "Parar / liberar"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
