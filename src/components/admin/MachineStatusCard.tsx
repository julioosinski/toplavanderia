import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Droplets, Wind, Clock } from "lucide-react";
import { type Machine } from "@/hooks/useMachines";

interface MachineStatusCardProps {
  machine: Machine;
  onClick?: () => void;
}

export const MachineStatusCard = ({ machine, onClick }: MachineStatusCardProps) => {
  const IconComponent = machine.type === "lavadora" ? Droplets : Wind;
  const colorScheme = machine.type === "lavadora" ? "blue" : "orange";
  
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
  const borderColor = machine.type === "lavadora" ? "border-blue-200" : "border-orange-200";
  const hoverBorder = machine.type === "lavadora" ? "hover:border-blue-400" : "hover:border-orange-400";

  return (
    <Card
      className={`relative overflow-hidden transition-all duration-300 cursor-pointer bg-card ${
        isAvailable
          ? `hover:shadow-lg hover:scale-105 border ${borderColor} ${hoverBorder}`
          : "opacity-70 cursor-not-allowed border border-muted"
      } shadow-md rounded-lg h-full flex flex-col`}
      onClick={() => isAvailable && onClick?.()}
    >
      {/* Status Badge */}
      <div className="absolute top-2 right-2 z-10">
        <div className={`w-3 h-3 rounded-full ${getStatusColor(machine.status)} shadow border-2 border-background`} />
      </div>

      <CardHeader className="text-center p-4 pb-2 flex-shrink-0">
        <div
          className={`w-12 h-12 bg-gradient-to-br ${
            colorScheme === "blue"
              ? "from-blue-500 to-blue-600"
              : "from-orange-500 to-orange-600"
          } rounded-full flex items-center justify-center mx-auto mb-2 shadow`}
        >
          <IconComponent className="text-primary-foreground" size={20} />
        </div>
        <CardTitle className="text-sm font-bold leading-tight">{machine.name}</CardTitle>
      </CardHeader>

      <CardContent className="flex-1 p-4 pt-0 flex flex-col justify-between">
        <div className="text-center mb-3">
          <div className="flex items-center justify-center space-x-1 mb-1">
            <span className={`text-base font-bold ${colorScheme === "blue" ? "text-blue-600" : "text-orange-600"}`}>
              R$ {machine.price?.toFixed(2).replace(".", ",")}
            </span>
          </div>
          <p className="text-xs text-muted-foreground flex items-center justify-center">
            <Clock className="mr-1" size={12} />
            {machine.duration}min
          </p>
        </div>

        <div className="flex items-center justify-center mb-3">
          <Badge variant="secondary" className={`text-xs px-2 py-1 ${getStatusBadgeColor(machine.status)}`}>
            {getStatusText(machine.status)}
          </Badge>
        </div>

        {machine.status === "running" && machine.timeRemaining && (
          <div className="space-y-2 mb-3">
            <Progress
              value={((machine.duration - machine.timeRemaining) / machine.duration) * 100}
              className="h-2"
            />
            <div className="text-center text-xs text-muted-foreground">
              {machine.timeRemaining}min restantes
            </div>
          </div>
        )}

        {isAvailable && (
          <Button
            variant="default"
            size="sm"
            className={`w-full text-xs ${
              colorScheme === "blue"
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-orange-600 hover:bg-orange-700"
            } text-primary-foreground`}
          >
            Ver Detalhes
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
