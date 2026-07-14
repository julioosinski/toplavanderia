import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { type Machine } from "@/hooks/useMachines";
import { getMachineTypeMeta } from "@/lib/machineDisplayTypes";
import { useOperatorReleasePermission } from "@/hooks/useOperatorReleasePermission";

interface MachineStatusCardProps {
  machine: Machine;
  onClick?: () => void;
}

export const MachineStatusCard = ({ machine, onClick }: MachineStatusCardProps) => {
  const { isOperator: isOperatorOnly } = useOperatorReleasePermission();
  const isRunning = machine.status === "running";
  const typeMeta = getMachineTypeMeta(machine.type);
  const IconComponent = typeMeta.icon;

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!isRunning) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [isRunning]);

  const displayRemaining = useMemo(() => {
    if (isRunning && machine.runningSinceAt) {
      const now = Date.now() + tick * 0;
      return Math.max(
        0,
        Math.round(
          machine.duration -
            (now - new Date(machine.runningSinceAt).getTime()) / 60000
        )
      );
    }
    return machine.timeRemaining ?? 0;
  }, [isRunning, machine.runningSinceAt, machine.duration, machine.timeRemaining, tick]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-green-500";
      case "running":
        return "bg-blue-500 animate-pulse";
      case "offline":
        return "bg-red-500";
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
      case "offline":
        return "Offline";
      default:
        return "Desconhecido";
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-green-100 text-green-700";
      case "running":
        return "bg-blue-100 text-blue-700";
      case "offline":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const isAvailable = machine.status === "available";
  const displayStatus =
    machine.type === "coffee"
      ? machine.espReachable
        ? "available"
        : "offline"
      : machine.status;
  const durationLabel =
    machine.type === "coffee"
      ? "Cardápio no totem"
      : machine.duration > 0
        ? `${machine.duration}min`
        : "—";
  const priceLabel =
    machine.type === "coffee" && machine.price <= 0
      ? "Preços no cardápio"
      : `R$ ${machine.price?.toFixed(2).replace(".", ",")}`;

  return (
    <Card
      className={`relative overflow-hidden transition-all duration-300 cursor-pointer bg-card hover:shadow-lg hover:scale-105 border ${typeMeta.cardBorder} hover:border-primary/40 ${
        displayStatus === 'offline' ? 'opacity-60' : ''
      } shadow-md rounded-lg h-full flex flex-col`}
      onClick={() => onClick?.()}
    >
      <div className="absolute top-2 right-2 z-10">
        <div className={`w-3 h-3 rounded-full ${getStatusColor(displayStatus)} shadow border-2 border-background`} />
      </div>

      <CardHeader className="text-center p-3 sm:p-4 pb-2 flex-shrink-0">
        <div
          className={`w-10 h-10 sm:w-12 sm:h-12 ${typeMeta.iconBg} rounded-full flex items-center justify-center mx-auto mb-2 shadow`}
        >
          <IconComponent className="text-primary-foreground" size={20} />
        </div>
        <CardTitle className="text-sm font-bold leading-tight">{machine.name}</CardTitle>
        <p className="text-[11px] text-muted-foreground mt-1">{typeMeta.label}</p>
      </CardHeader>

      <CardContent className="flex-1 p-3 sm:p-4 pt-0 flex flex-col justify-between">
        <div className="text-center mb-3">
          {!isOperatorOnly && (
            <div className="flex items-center justify-center space-x-1 mb-1">
              <span className={`text-base font-bold ${typeMeta.accentClass}`}>{priceLabel}</span>
            </div>
          )}
          <p className="text-xs text-muted-foreground flex items-center justify-center">
            <Clock className="mr-1" size={12} />
            {durationLabel}
          </p>
        </div>

        <div className="flex items-center justify-center mb-3">
          <Badge variant="secondary" className={`text-xs px-2 py-1 ${getStatusBadgeColor(displayStatus)}`}>
            {machine.type === "coffee"
              ? machine.espReachable
                ? "Online"
                : "Offline"
              : getStatusText(machine.status)}
          </Badge>
        </div>

        {isRunning && displayRemaining > 0 && machine.duration > 0 && (
          <div className="space-y-2 mb-3">
            <Progress
              value={((machine.duration - displayRemaining) / machine.duration) * 100}
              className="h-2"
            />
            <div className="text-center text-xs text-muted-foreground font-medium">
              {displayRemaining}min restantes
            </div>
          </div>
        )}

        {isAvailable && (
          <Button variant="default" size="sm" className={`w-full text-xs ${typeMeta.iconBg} hover:opacity-90 text-primary-foreground`}>
            Ver Detalhes
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
