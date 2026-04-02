import { useEffect, useState, useRef } from "react";
import { useLaundry } from "@/contexts/LaundryContext";
import { supabase } from "@/integrations/supabase/client";
import { LaundryGuard } from "@/components/admin/LaundryGuard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, MoreVertical, Circle, Unlock, Wrench } from "lucide-react";
import { SignalIndicator } from "@/components/admin/SignalIndicator";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MachineDialog } from "@/components/admin/MachineDialog";
import {
  forceMachineReleased,
  forceMachineMaintenance,
  computeMachineStatus,
  isEsp32Reachable,
  ESP32_HEARTBEAT_STALE_MINUTES,
  type Esp32StatusRow,
} from "@/lib/machineEsp32Sync";
import { ESP32ConfigurationDialog } from "@/components/admin/ESP32ConfigurationDialog";
import { ESP32PendingApproval } from "@/components/admin/ESP32PendingApproval";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Machine = {
  id: string;
  name: string;
  type: string;
  status: string;
  capacity_kg: number;
  price_per_cycle: number;
  total_uses: number | null;
  total_revenue: number | null;
  location?: string | null;
  esp32_id?: string | null;
  relay_pin?: number | null;
  cycle_time_minutes?: number | null;
  temperature?: number | null;
  realStatus?: string;
  esp32_online?: boolean;
  signal_strength?: number | null;
  last_heartbeat?: string | null;
  network_status?: string;
};

export default function Machines() {
  const { currentLaundry } = useLaundry();
  const { toast } = useToast();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const loadMachinesRef = useRef<() => Promise<void>>(async () => {});
  const initialLoadDone = useRef(false);

  const loadMachines = async () => {
    if (!currentLaundry) return;

    try {
      if (!initialLoadDone.current) setLoading(true);
      
      // Fetch machines with ESP32 status
      const { data: machinesData, error: machinesError } = await supabase
        .from("machines")
        .select("*")
        .eq("laundry_id", currentLaundry.id)
        .order("name");

      if (machinesError) throw machinesError;

      // Fetch ESP32 status separately
      const { data: esp32Data, error: esp32Error } = await supabase
        .from("esp32_status")
        .select("esp32_id, ip_address, is_online, signal_strength, last_heartbeat, network_status, relay_status, laundry_id");

      if (esp32Error) throw esp32Error;

      const esp32ForLaundry =
        esp32Data?.filter((esp) => esp.laundry_id === currentLaundry.id) ?? [];

      const enrichedMachines = (machinesData || []).map((machine) => {
        const esp32: Esp32StatusRow | undefined = machine.esp32_id
          ? esp32ForLaundry.find((esp) => esp.esp32_id === machine.esp32_id) as Esp32StatusRow | undefined
          : undefined;

        const staleMs = ESP32_HEARTBEAT_STALE_MINUTES * 60_000;
        const computed = computeMachineStatus(machine as any, esp32, { staleMs });
        const espReachable = isEsp32Reachable(esp32, staleMs);

        return {
          ...machine,
          realStatus: computed.status,
          esp32_online: espReachable,
          signal_strength: (esp32 as any)?.signal_strength || null,
          last_heartbeat: esp32?.last_heartbeat || null,
          network_status: (esp32 as any)?.network_status || 'unknown',
        };
      });

      setMachines(enrichedMachines as Machine[]);
    } catch (error: any) {
      console.error("Error loading machines:", error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      initialLoadDone.current = true;
    }
  };

  loadMachinesRef.current = loadMachines;

  useEffect(() => {
    if (currentLaundry) {
      void loadMachines();
    }
  }, [currentLaundry]);

  useEffect(() => {
    if (!currentLaundry?.id) return;
    const lid = currentLaundry.id;
    const channel = supabase
      .channel(`admin-machines-rt-${lid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'machines', filter: `laundry_id=eq.${lid}` },
        () => void loadMachinesRef.current()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'esp32_status', filter: `laundry_id=eq.${lid}` },
        () => void loadMachinesRef.current()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentLaundry?.id]);

  const handleEdit = (machine: Machine) => {
    setEditingMachine(machine);
    setDialogOpen(true);
  };

  const handleDelete = async (machine: Machine) => {
    if (!confirm(`Tem certeza que deseja excluir a máquina "${machine.name}"?`)) return;

    try {
      const { error } = await supabase
        .from("machines")
        .delete()
        .eq("id", machine.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Máquina excluída com sucesso",
      });

      loadMachines();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSuccess = () => {
    setDialogOpen(false);
    setEditingMachine(null);
    loadMachines();
  };

  const columns: ColumnDef<Machine>[] = [
    {
      accessorKey: "name",
      header: "Nome",
    },
    {
      accessorKey: "type",
      header: "Tipo",
      cell: ({ row }) => {
        const type = row.getValue("type") as string;
        const label = type === "lavadora" || type === "washing" ? "Lavadora" : "Secadora";
        return <span className="capitalize">{label}</span>;
      },
    },
    {
      accessorKey: "realStatus",
      header: "Status",
      cell: ({ row }) => {
        const machine = row.original;
        const status = machine.realStatus || machine.status;
        
        const getStatusConfig = (s: string) => {
          if (s === 'offline') return { 
            variant: "destructive" as const, 
            label: "Offline", 
            icon: <Circle className="h-3 w-3 fill-destructive" />,
            description: "ESP32 desconectado"
          };
          if (s === 'in_use' || s === 'running') return { 
            variant: "default" as const, 
            label: "Em Serviço", 
            icon: <Circle className="h-3 w-3 fill-primary animate-pulse" />,
            description: "Máquina operando"
          };
          if (s === 'maintenance') return { 
            variant: "outline" as const, 
            label: "Manutenção", 
            icon: <Circle className="h-3 w-3 fill-yellow-500" />,
            description: "Em manutenção"
          };
          return { 
            variant: "secondary" as const, 
            label: "Disponível", 
            icon: <Circle className="h-3 w-3 fill-green-500" />,
            description: "Pronta para uso"
          };
        };
        
        const config = getStatusConfig(status);
        return (
          <div className="flex items-center gap-2">
            {config.icon}
            <div className="flex flex-col">
              <Badge variant={config.variant} className="w-fit">
                {config.label}
              </Badge>
              <span className="text-xs text-muted-foreground mt-1">
                {config.description}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "esp32_id",
      header: "ESP32 / Relé",
      cell: ({ row }) => {
        const machine = row.original;
        return (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-mono">{machine.esp32_id || "N/A"}</span>
            <span className="text-xs text-muted-foreground">Relé: {machine.relay_pin || "N/A"}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "signal_strength",
      header: "Sinal WiFi",
      cell: ({ row }) => {
        const machine = row.original;
        return (
          <SignalIndicator 
            signalStrength={machine.signal_strength || null}
            isOnline={machine.esp32_online || false}
          />
        );
      },
    },
    {
      accessorKey: "capacity_kg",
      header: "Capacidade",
      cell: ({ row }) => `${row.getValue("capacity_kg")} kg`,
    },
    {
      accessorKey: "price_per_cycle",
      header: "Preço/ciclo",
      cell: ({ row }) => {
        const price = row.getValue("price_per_cycle") as number;
        return `R$ ${price.toFixed(2)}`;
      },
    },
    {
      accessorKey: "total_uses",
      header: "Total de Usos",
      cell: ({ row }) => row.getValue("total_uses") || 0,
    },
    {
      accessorKey: "total_revenue",
      header: "Receita Total",
      cell: ({ row }) => {
        const revenue = row.getValue("total_revenue") as number;
        return `R$ ${(revenue || 0).toFixed(2)}`;
      },
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => {
        const machine = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleEdit(machine)}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  if (
                    !confirm(
                      "Liberar no totem (disponível), atualizar relé no painel e enviar comando OFF ao ESP32?"
                    )
                  ) {
                    return;
                  }
                  const { error } = await forceMachineReleased({ machineId: machine.id });
                  if (error) {
                    toast({
                      title: "Erro",
                      description: error.message,
                      variant: "destructive",
                    });
                  } else {
                    toast({
                      title: "Máquina liberada",
                      description: "Totem e esp32_status alinhados; comando de desligar relé enfileirado.",
                    });
                    loadMachines();
                  }
                }}
              >
                <Unlock className="mr-2 h-4 w-4" />
                Liberar máquina
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  if (
                    !confirm(
                      "Colocar em manutenção, espelhar relé OFF e enviar comando OFF ao ESP32?"
                    )
                  ) {
                    return;
                  }
                  const { error } = await forceMachineMaintenance(machine.id);
                  if (error) {
                    toast({
                      title: "Erro",
                      description: error.message,
                      variant: "destructive",
                    });
                  } else {
                    toast({
                      title: "Manutenção",
                      description: "Status atualizado e relé desligado no painel e no ESP32.",
                    });
                    loadMachines();
                  }
                }}
              >
                <Wrench className="mr-2 h-4 w-4" />
                Colocar em manutenção
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleDelete(machine)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <Card>
          <CardHeader className="h-24 bg-muted animate-pulse" />
          <CardContent className="h-96 bg-muted/50 animate-pulse" />
        </Card>
      </div>
    );
  }

  return (
    <LaundryGuard>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Máquinas</h1>
            <p className="text-muted-foreground">
              Gerencie todas as máquinas de lavar e secar
            </p>
          </div>
          <div className="flex gap-2">
            <ESP32ConfigurationDialog />
            <Button onClick={() => {
              setEditingMachine(null);
              setDialogOpen(true);
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Máquina
            </Button>
          </div>
        </div>

        <ESP32PendingApproval />

        <MachineDialog 
          machine={editingMachine ? { ...editingMachine, type: (editingMachine.type === 'washing' ? 'lavadora' : editingMachine.type === 'drying' ? 'secadora' : editingMachine.type) as 'lavadora' | 'secadora' } : null}
          onSuccess={handleSuccess}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />

        <Card>
          <CardHeader>
            <CardTitle>Todas as Máquinas</CardTitle>
            <CardDescription>
              Lista completa de máquinas cadastradas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={machines}
              searchKey="name"
              searchPlaceholder="Buscar por nome..."
            />
          </CardContent>
        </Card>
      </div>
    </LaundryGuard>
  );
}
