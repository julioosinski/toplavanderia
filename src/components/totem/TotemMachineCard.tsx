import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Clock } from "lucide-react";
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
    default: return "Desconhecido";
  }
};

export const TotemMachineCard = ({ machine, deviceMode, isViewOnly, colorScheme, onSelect }: TotemMachineCardProps) => {
  const IconComponent = machine.icon;
  const isAvailable = machine.status === "available";
  const colors = colorScheme === 'blue' 
    ? { gradient: 'from-blue-500 to-blue-600', text: 'text-blue-600', border: 'border-blue-200 hover:border-blue-400', btn: 'bg-blue-600 hover:bg-blue-700' }
    : { gradient: 'from-orange-500 to-orange-600', text: 'text-orange-600', border: 'border-orange-200 hover:border-orange-400', btn: 'bg-orange-600 hover:bg-orange-700' };

  return (
    <Card
      className={`relative overflow-hidden transition-all duration-300 ${
        isAvailable && !isViewOnly ? 'cursor-pointer' : isViewOnly ? 'cursor-default' : 'cursor-not-allowed'
      } bg-white ${
        isAvailable && !isViewOnly ? `hover:shadow-lg hover:scale-105 border ${colors.border}` : 'opacity-70 border border-gray-200'
      } shadow-md rounded-lg h-full flex flex-col`}
      onClick={() => isAvailable && onSelect(machine.id)}
    >
      <div className="absolute top-2 right-2 z-10">
        <div className={`w-3 h-3 rounded-full ${getStatusColor(machine.status)} shadow border border-white`} />
      </div>

      <CardHeader className={`text-center ${deviceMode === 'smartpos' ? 'p-3 pb-2' : 'p-2 pb-1'} flex-shrink-0`}>
        <div className={`${deviceMode === 'smartpos' ? 'w-12 h-12' : 'w-10 h-10'} bg-gradient-to-br ${colors.gradient} rounded-full flex items-center justify-center mx-auto mb-1 shadow`}>
          <IconComponent className="text-white" size={deviceMode === 'smartpos' ? 20 : 16} />
        </div>
        <CardTitle className={`${deviceMode === 'smartpos' ? 'text-sm' : 'text-xs'} font-bold text-gray-800 leading-tight`}>
          {machine.title}
        </CardTitle>
      </CardHeader>

      <CardContent className={`flex-1 ${deviceMode === 'smartpos' ? 'p-3 pt-0' : 'p-2 pt-0'} flex flex-col justify-between`}>
        <div className="text-center mb-2">
          <div className="flex items-center justify-center space-x-1 mb-1">
            <span className={`${deviceMode === 'smartpos' ? 'text-base' : 'text-sm'} font-bold ${colors.text}`}>
              R$ {machine.price.toFixed(2).replace('.', ',')}
            </span>
          </div>
          <p className="text-xs text-gray-600 flex items-center justify-center">
            <Clock className="mr-1" size={10} />
            {machine.duration}min
          </p>
        </div>

        <div className="flex items-center justify-center mb-2">
          <Badge
            variant={machine.status === "available" ? "default" : "secondary"}
            className={`text-xs px-2 py-0.5 ${
              machine.status === "available" ? "bg-green-100 text-green-700"
              : machine.status === "running" ? "bg-blue-100 text-blue-700"
              : "bg-red-100 text-red-700"
            }`}
          >
            {getStatusText(machine.status)}
          </Badge>
        </div>

        {machine.status === "running" && machine.timeRemaining !== undefined && machine.timeRemaining > 0 && (
          <div className="space-y-1 mb-2">
            <Progress value={(machine.duration - machine.timeRemaining) / machine.duration * 100} className="h-1" />
            <div className="text-center text-xs text-gray-600">
              {machine.timeRemaining}min restantes
            </div>
          </div>
        )}

        {isAvailable && !isViewOnly && (
          <Button variant="default" size="sm" className={`w-full text-xs ${colors.btn} text-white ${deviceMode === 'smartpos' ? 'h-10 text-sm' : 'h-6'}`}>
            Selecionar
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
