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
    <div className="flex-1 flex flex-col min-h-0 px-2 gap-1.5 overflow-hidden">
      {lavadoras.length === 0 && secadoras.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <Droplets className="mx-auto text-muted-foreground" size={40} />
            <h2 className="text-lg font-semibold text-muted-foreground">Nenhuma máquina cadastrada</h2>
            <p className="text-xs text-muted-foreground">Entre em contato com o administrador.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Lavadoras */}
          {lavadoras.length > 0 && (
            <div className={`${secadoras.length > 0 ? 'flex-1' : 'flex-1'} bg-blue-50 rounded-lg p-2 flex flex-col min-h-0 overflow-hidden`}>
              <div className="flex items-center justify-center gap-1.5 mb-1 shrink-0">
                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                  <Droplets className="text-white" size={12} />
                </div>
                <h2 className="text-sm font-bold text-blue-700">Lavadoras</h2>
              </div>
              <div className={`flex-1 grid ${getGridClass(lavadoras.length)} gap-1.5 auto-rows-fr min-h-0`}>
                {lavadoras.map(machine => (
                  <TotemMachineCard key={machine.id} machine={machine} deviceMode={deviceMode} isViewOnly={isViewOnly} colorScheme="blue" onSelect={onSelect} />
                ))}
              </div>
            </div>
          )}

          {/* Secadoras */}
          {secadoras.length > 0 && (
            <div className={`${lavadoras.length > 0 ? 'flex-1' : 'flex-1'} bg-orange-50 rounded-lg p-2 flex flex-col min-h-0 overflow-hidden`}>
              <div className="flex items-center justify-center gap-1.5 mb-1 shrink-0">
                <div className="w-6 h-6 bg-orange-600 rounded-full flex items-center justify-center">
                  <Wind className="text-white" size={12} />
                </div>
                <h2 className="text-sm font-bold text-orange-700">Secadoras</h2>
              </div>
              <div className={`flex-1 grid ${getGridClass(secadoras.length)} gap-1.5 auto-rows-fr min-h-0`}>
                {secadoras.map(machine => (
                  <TotemMachineCard key={machine.id} machine={machine} deviceMode={deviceMode} isViewOnly={isViewOnly} colorScheme="orange" onSelect={onSelect} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
