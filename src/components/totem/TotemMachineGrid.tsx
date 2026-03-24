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
  const gridCols = deviceMode === 'smartpos' ? 'grid-cols-2' : 'grid-cols-6';
  const lavadoras = machines.filter(m => m.type === "lavadora").slice(0, deviceMode === 'smartpos' ? 4 : 6);
  const secadoras = machines.filter(m => m.type === "secadora").slice(0, deviceMode === 'smartpos' ? 4 : 6);

  return (
    <div className="container mx-auto px-2 flex-1 flex flex-col min-h-0">
      <div className={`flex-1 ${deviceMode === 'smartpos' ? 'space-y-3' : 'grid grid-rows-2 gap-3'}`}>
        {/* Lavadoras */}
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-3 shadow-lg flex flex-col">
          <div className="flex items-center justify-center mb-3 space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
              <Droplets className="text-white" size={16} />
            </div>
            <h2 className="text-xl font-bold text-blue-700">Lavadoras</h2>
          </div>
          <div className={`flex-1 grid ${gridCols} gap-3`}>
            {lavadoras.map(machine => (
              <TotemMachineCard key={machine.id} machine={machine} deviceMode={deviceMode} isViewOnly={isViewOnly} colorScheme="blue" onSelect={onSelect} />
            ))}
          </div>
        </div>

        {/* Secadoras */}
        <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl p-3 shadow-lg flex flex-col">
          <div className="flex items-center justify-center mb-3 space-x-2">
            <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center shadow-lg">
              <Wind className="text-white" size={16} />
            </div>
            <h2 className="text-xl font-bold text-orange-700">Secadoras</h2>
          </div>
          <div className={`flex-1 grid ${gridCols} gap-3`}>
            {secadoras.map(machine => (
              <TotemMachineCard key={machine.id} machine={machine} deviceMode={deviceMode} isViewOnly={isViewOnly} colorScheme="orange" onSelect={onSelect} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
