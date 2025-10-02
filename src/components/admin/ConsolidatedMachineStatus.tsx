import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Droplets, Wind } from "lucide-react";
import { type Machine } from "@/hooks/useMachines";
import { MachineStatusCard } from "./MachineStatusCard";
import { useState } from "react";
import { MachineDetailsDialog } from "./MachineDetailsDialog";

interface ConsolidatedMachineStatusProps {
  machinesByLaundry: Record<string, { laundryName: string; machines: Machine[] }>;
  loading?: boolean;
}

export const ConsolidatedMachineStatus = ({
  machinesByLaundry,
  loading,
}: ConsolidatedMachineStatusProps) => {
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-64 mb-6" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="mb-6">
              <div className="h-6 bg-muted rounded w-48 mb-4" />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[...Array(6)].map((_, j) => (
                  <div key={j} className="h-48 bg-muted rounded" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold">Visão Consolidada</h2>
        <p className="text-sm text-muted-foreground">
          Status de todas as máquinas em {Object.keys(machinesByLaundry).length} lavanderias
        </p>
      </div>

      {Object.entries(machinesByLaundry).map(([laundryId, { laundryName, machines }]) => {
        const washers = machines.filter((m) => m.type === "lavadora");
        const dryers = machines.filter((m) => m.type === "secadora");
        
        const stats = {
          available: machines.filter((m) => m.status === "available").length,
          running: machines.filter((m) => m.status === "running").length,
          offline: machines.filter((m) => m.status === "offline").length,
        };

        return (
          <Card key={laundryId} className="border-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow">
                    <Building2 className="text-primary-foreground" size={20} />
                  </div>
                  <div>
                    <CardTitle>{laundryName}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {stats.available} disponíveis • {stats.running} em uso • {stats.offline} offline
                    </p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Lavadoras */}
              {washers.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Droplets size={16} className="text-blue-600" />
                    <h4 className="font-semibold text-sm">Lavadoras ({washers.length})</h4>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {washers.map((machine) => (
                      <MachineStatusCard
                        key={machine.id}
                        machine={machine}
                        onClick={() => setSelectedMachine(machine)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Secadoras */}
              {dryers.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Wind size={16} className="text-orange-600" />
                    <h4 className="font-semibold text-sm">Secadoras ({dryers.length})</h4>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {dryers.map((machine) => (
                      <MachineStatusCard
                        key={machine.id}
                        machine={machine}
                        onClick={() => setSelectedMachine(machine)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <MachineDetailsDialog
        machine={selectedMachine}
        open={!!selectedMachine}
        onOpenChange={(open) => !open && setSelectedMachine(null)}
      />
    </div>
  );
};
