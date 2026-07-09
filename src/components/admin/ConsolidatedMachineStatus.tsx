import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2 } from "lucide-react";
import { type Machine } from "@/hooks/useMachines";
import { useState } from "react";
import { MachineDetailsDialog } from "./MachineDetailsDialog";
import { MachineTypeSections } from "./MachineTypeSections";

interface ConsolidatedMachineStatusProps {
  machinesByLaundry: Record<string, { laundryName: string; machines: Machine[] }>;
  loading?: boolean;
  onAfterMachineAction?: () => void;
}

export const ConsolidatedMachineStatus = ({
  machinesByLaundry,
  loading,
  onAfterMachineAction,
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

      {Object.keys(machinesByLaundry).length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma máquina cadastrada nas lavanderias disponíveis.
          </CardContent>
        </Card>
      )}

      {Object.entries(machinesByLaundry).map(([laundryId, { laundryName, machines }]) => {
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
              <MachineTypeSections
                machines={machines}
                typeFilter="all"
                onSelectMachine={setSelectedMachine}
                compact
              />
            </CardContent>
          </Card>
        );
      })}

      <MachineDetailsDialog
        machine={selectedMachine}
        open={!!selectedMachine}
        onOpenChange={(open) => !open && setSelectedMachine(null)}
        onAfterAction={onAfterMachineAction}
      />
    </div>
  );
};
