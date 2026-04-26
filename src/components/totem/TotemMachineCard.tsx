import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, Wrench, WifiOff } from "lucide-react";
import type { Machine } from "@/hooks/useMachines";

interface TotemMachineCardProps {
  machine: Machine;
  deviceMode: string;
  isViewOnly: boolean;
  colorScheme: 'blue' | 'orange';
  onSelect: (id: string) => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "available": return "bg-green-500";
    case "running": return "bg-blue-500";
    case "maintenance": return "bg-red-500";
    case "offline": return "bg-gray-500";
    default: return "bg-gray-500";
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case "available": return "Disponível";
    case "running": return "Em uso";
    case "maintenance": return "Manutenção";
    case "offline": return "Offline";
    default: return "—";
  }
};

export const TotemMachineCard = ({ machine, deviceMode, isViewOnly, colorScheme, onSelect }: TotemMachineCardProps) => {
  const isSmart = deviceMode === 'smartpos';
  const IconComponent = machine.icon;
  const isAvailable = machine.status === "available";
  const isRunning = machine.status === "running";
  const isMaintenance = machine.status === "maintenance";
  const hardwareLost = Boolean(machine.hardwareLinkLost && isRunning);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!isRunning || !machine.runningSinceAt) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [isRunning, machine.runningSinceAt]);

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

  const colors = colorScheme === 'blue'
    ? { gradient: 'from-blue-500 to-blue-600', text: 'text-blue-600', border: 'border-blue-300 hover:border-blue-500', btn: 'bg-blue-600' }
    : { gradient: 'from-orange-500 to-orange-600', text: 'text-orange-600', border: 'border-orange-300 hover:border-orange-500', btn: 'bg-orange-600' };

  return (
    <div
      className={`relative rounded-xl border flex flex-col items-center justify-center transition-all duration-200 ${
        isSmart ? 'p-3 min-h-[148px]' : 'p-1.5'
      } ${
        isAvailable && !isViewOnly
          ? `cursor-pointer bg-white hover:shadow-md hover:scale-[1.02] ${colors.border}`
          : isViewOnly
          ? 'cursor-default bg-white border-gray-200'
          : 'cursor-not-allowed bg-gray-50 border-gray-200 opacity-60'
      } h-full min-h-0 overflow-hidden`}
      onClick={() => isAvailable && onSelect(machine.id)}
    >
      {/* Status dot */}
      <div className="absolute top-1 right-1">
        <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(machine.status)} border border-white ${isRunning ? 'animate-pulse' : ''}`} />
      </div>

      {isMaintenance && (
        <div className="absolute top-1 left-1">
          <Wrench size={10} className="text-red-500" />
        </div>
      )}

      {/* Icon */}
      <div className={`${isSmart ? 'w-14 h-14 mb-1' : 'w-8 h-8 mb-0.5'} bg-gradient-to-br ${colors.gradient} rounded-full flex items-center justify-center shrink-0`}>
        <IconComponent className="text-white" size={isSmart ? 26 : 14} />
      </div>

      {/* Name */}
      <p className={`${isSmart ? 'text-sm' : 'text-[11px]'} font-bold text-gray-800 leading-tight text-center truncate w-full`}>
        {machine.title}
      </p>

      {/* Price + Duration */}
      <p className={`${isSmart ? 'text-lg' : 'text-xs'} font-bold ${colors.text} leading-tight`}>
        R$ {machine.price.toFixed(2).replace('.', ',')}
      </p>
      <p className={`${isSmart ? 'text-xs' : 'text-[9px]'} text-gray-500 flex items-center gap-0.5`}>
        <Clock size={isSmart ? 12 : 8} />{machine.duration}min
      </p>

      {/* Status badge */}
      <Badge
        variant="secondary"
        className={`${isSmart ? 'text-[11px] px-2 py-0.5' : 'text-[9px] px-1.5 py-0'} leading-relaxed mt-0.5 ${
          isAvailable ? "bg-green-100 text-green-700"
          : isRunning ? "bg-blue-100 text-blue-700"
          : "bg-red-100 text-red-700"
        }`}
      >
        {getStatusText(machine.status)}
      </Badge>

      {/* Hardware lost */}
      {hardwareLost && (
        <span className="flex items-center gap-0.5 text-[8px] text-amber-700 font-medium mt-0.5">
          <WifiOff className="h-2 w-2 shrink-0" />Sem link
        </span>
      )}

      {/* Running progress */}
      {isRunning && displayRemaining > 0 && (
        <div className="w-full mt-0.5 space-y-0.5">
          <Progress
            value={((machine.duration - displayRemaining) / machine.duration) * 100}
            className="h-1"
          />
          <p className="text-[9px] text-gray-500 text-center">{displayRemaining}min</p>
        </div>
      )}

      {/* CTA */}
      {isAvailable && !isViewOnly && (
        <p className={`${isSmart ? 'text-xs' : 'text-[9px]'} ${colors.text} font-semibold mt-0.5`}>
          Toque para usar
        </p>
      )}
    </div>
  );
};
