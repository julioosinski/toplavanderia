import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { type Machine } from "@/hooks/useMachines";
import { Droplets, Wind, Clock, DollarSign, MapPin, Cpu, Wifi, Calendar } from "lucide-react";
import { format } from "date-fns";

interface MachineDetailsDialogProps {
  machine: Machine | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MachineDetailsDialog = ({ machine, open, onOpenChange }: MachineDetailsDialogProps) => {
  if (!machine) return null;

  const IconComponent = machine.type === "lavadora" ? Droplets : Wind;

  const getStatusColor = (status: string) => {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 bg-gradient-to-br ${
                machine.type === "lavadora"
                  ? "from-blue-500 to-blue-600"
                  : "from-orange-500 to-orange-600"
              } rounded-full flex items-center justify-center shadow`}
            >
              <IconComponent className="text-primary-foreground" size={20} />
            </div>
            <div>
              <DialogTitle>{machine.name}</DialogTitle>
              <DialogDescription>
                {machine.type === "lavadora" ? "Lavadora" : "Secadora"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Badge className={getStatusColor(machine.status)}>{getStatusText(machine.status)}</Badge>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <DollarSign size={14} />
                <span className="text-xs">Preço</span>
              </div>
              <p className="text-lg font-bold">R$ {machine.price?.toFixed(2).replace(".", ",")}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock size={14} />
                <span className="text-xs">Duração</span>
              </div>
              <p className="text-lg font-bold">{machine.duration} min</p>
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

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            {machine.status === "running" && (
              <Button variant="destructive" className="flex-1">
                Parar Emergência
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
