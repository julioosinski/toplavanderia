import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Droplets, Wind } from "lucide-react";
import { type Machine } from "@/hooks/useMachines";
import { MachineStatusCard } from "./MachineStatusCard";
import { MachineDetailsDialog } from "./MachineDetailsDialog";
import { MachineFilterBar } from "./MachineFilterBar";

interface MachineStatusGridProps {
  machines: Machine[];
  loading?: boolean;
}

export const MachineStatusGrid = ({ machines, loading }: MachineStatusGridProps) => {
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

  // Filter machines
  const filteredMachines = machines.filter((machine) => {
    if (statusFilter !== "all" && machine.status !== statusFilter) return false;
    if (typeFilter !== "all" && machine.type !== typeFilter) return false;
    return true;
  });

  const washers = filteredMachines.filter((m) => m.type === "lavadora");
  const dryers = filteredMachines.filter((m) => m.type === "secadora");

  // Stats
  const stats = {
    available: machines.filter((m) => m.status === "available").length,
    running: machines.filter((m) => m.status === "running").length,
    offline: machines.filter((m) => m.status === "offline").length,
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Status das Máquinas</h2>
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

      {/* Lavadoras */}
      {(typeFilter === "all" || typeFilter === "lavadora") && washers.length > 0 && (
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50/50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shadow">
                <Droplets className="text-primary-foreground" size={20} />
              </div>
              <div>
                <CardTitle className="text-blue-700 dark:text-blue-400">Lavadoras</CardTitle>
                <CardDescription>{washers.length} máquinas</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {washers.map((machine) => (
                <MachineStatusCard
                  key={machine.id}
                  machine={machine}
                  onClick={() => setSelectedMachine(machine)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Secadoras */}
      {(typeFilter === "all" || typeFilter === "secadora") && dryers.length > 0 && (
        <Card className="border-orange-200 bg-gradient-to-r from-orange-50/50 to-orange-100/50 dark:from-orange-950/20 dark:to-orange-900/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center shadow">
                <Wind className="text-primary-foreground" size={20} />
              </div>
              <div>
                <CardTitle className="text-orange-700 dark:text-orange-400">Secadoras</CardTitle>
                <CardDescription>{dryers.length} máquinas</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {dryers.map((machine) => (
                <MachineStatusCard
                  key={machine.id}
                  machine={machine}
                  onClick={() => setSelectedMachine(machine)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
      />
    </div>
  );
};
