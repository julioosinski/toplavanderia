import { useState } from "react";
import { type Machine } from "@/hooks/useMachines";
import { MachineDetailsDialog } from "./MachineDetailsDialog";
import { MachineFilterBar } from "./MachineFilterBar";
import { MachineTypeSections } from "./MachineTypeSections";
import { Card, CardContent } from "@/components/ui/card";

interface MachineStatusGridProps {
  machines: Machine[];
  loading?: boolean;
  onAfterMachineAction?: () => void;
}

export const MachineStatusGrid = ({ machines, loading, onAfterMachineAction }: MachineStatusGridProps) => {
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const filteredMachines = machines.filter((machine) => {
    if (statusFilter !== "all" && machine.status !== statusFilter) return false;
    if (typeFilter !== "all" && machine.type !== typeFilter) return false;
    return true;
  });

  const stats = {
    available: machines.filter((m) => m.status === "available").length,
    running: machines.filter((m) => m.status === "running").length,
    offline: machines.filter((m) => m.status === "offline").length,
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Status das Máquinas</h2>
          <p className="text-sm text-muted-foreground">
            {stats.available} disponíveis • {stats.running} em uso • {stats.offline} offline
          </p>
        </div>
        <MachineFilterBar
          statusFilter={statusFilter}
          typeFilter={typeFilter}
          onStatusChange={setStatusFilter}
          onTypeChange={setTypeFilter}
        />
      </div>

      <div className="space-y-6">
        <MachineTypeSections
          machines={filteredMachines}
          typeFilter={typeFilter}
          onSelectMachine={setSelectedMachine}
        />
      </div>

      {filteredMachines.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma máquina encontrada com os filtros selecionados.
          </CardContent>
        </Card>
      )}

      <MachineDetailsDialog
        machine={selectedMachine}
        open={!!selectedMachine}
        onOpenChange={(open) => !open && setSelectedMachine(null)}
        onAfterAction={onAfterMachineAction}
      />
    </div>
  );
};
