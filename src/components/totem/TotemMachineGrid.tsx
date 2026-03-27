import { Droplets, Wind } from "lucide-react";
import { TotemMachineCard } from "./TotemMachineCard";
import type { Machine } from "@/hooks/useMachines";

interface TotemMachineGridProps {
  machines: Machine[];
  deviceMode: string;
  isViewOnly: boolean;
  onSelect: (id: string) => void;
}

export const TotemMachineGrid = ({ machines, deviceMode, isViewOnly, onSelect }: TotemMachineGridProps) => {
  const lavadoras = machines.filter(m => m.type === "lavadora");
  const secadoras = machines.filter(m => m.type === "secadora");

  const getGridClass = (count: number) => {
    if (deviceMode === 'smartpos') return 'grid-cols-2';
    if (count <= 3) return 'grid-cols-3';
    if (count <= 4) return 'grid-cols-4';
    if (count <= 5) return 'grid-cols-5';
    if (count <= 6) return 'grid-cols-6';
    if (count <= 8) return 'grid-cols-8';
    return 'grid-cols-10';
  };

  return (
    <div className="container mx-auto px-2 flex-1 flex flex-col min-h-0 overflow-auto">
      {lavadoras.length === 0 && secadoras.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3 p-8">
            <Droplets className="mx-auto text-muted-foreground" size={48} />
            <h2 className="text-xl font-semibold text-muted-foreground">Nenhuma máquina cadastrada</h2>
            <p className="text-sm text-muted-foreground">Entre em contato com o administrador.</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-3">
          {/* Lavadoras - parte superior */}
          {lavadoras.length > 0 && (
            <div className="flex-1 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-3 shadow-lg flex flex-col min-h-0">
              <div className="flex items-center justify-center mb-2 space-x-2">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
                  <Droplets className="text-white" size={16} />
                </div>
                <h2 className="text-xl font-bold text-blue-700">Lavadoras</h2>
              </div>
              <div className={`flex-1 grid ${getGridClass(lavadoras.length)} gap-3 auto-rows-fr`}>
                {lavadoras.map(machine => (
                  <TotemMachineCard key={machine.id} machine={machine} deviceMode={deviceMode} isViewOnly={isViewOnly} colorScheme="blue" onSelect={onSelect} />
                ))}
              </div>
            </div>
          )}

          {/* Secadoras - parte inferior */}
          {secadoras.length > 0 && (
            <div className="flex-1 bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl p-3 shadow-lg flex flex-col min-h-0">
              <div className="flex items-center justify-center mb-2 space-x-2">
                <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center shadow-lg">
                  <Wind className="text-white" size={16} />
                </div>
                <h2 className="text-xl font-bold text-orange-700">Secadoras</h2>
              </div>
              <div className={`flex-1 grid ${getGridClass(secadoras.length)} gap-3 auto-rows-fr`}>
                {secadoras.map(machine => (
                  <TotemMachineCard key={machine.id} machine={machine} deviceMode={deviceMode} isViewOnly={isViewOnly} colorScheme="orange" onSelect={onSelect} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
