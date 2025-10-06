import { useEffect, useState } from "react";
import { useLaundry } from "@/contexts/LaundryContext";
import { supabase } from "@/integrations/supabase/client";
import { LaundryGuard } from "@/components/admin/LaundryGuard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, MoreVertical, Circle } from "lucide-react";
import { SignalIndicator } from "@/components/admin/SignalIndicator";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MachineDialog } from "@/components/admin/MachineDialog";
import { ESP32ConfigurationDialog } from "@/components/admin/ESP32ConfigurationDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Machine = {
  id: string;
  name: string;
  type: 'washing' | 'drying';
  status: string;
  capacity_kg: number;
  price_per_kg: number;
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

  useEffect(() => {
    if (currentLaundry) {
      loadMachines();
    }
  }, [currentLaundry]);

  const loadMachines = async () => {
    if (!currentLaundry) return;

    try {
      setLoading(true);
      
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

      // Merge machine data with ESP32 status
      const enrichedMachines = (machinesData || []).map((machine) => {
        // Find ESP32 status matching this machine's esp32_id
        const esp32 = esp32Data?.find((esp) => esp.esp32_id === machine.esp32_id);
        
        // Determine real status based on ESP32 data
        let realStatus = machine.status;
        let esp32Online = false;
        
        if (esp32) {
          const lastHeartbeat = esp32.last_heartbeat ? new Date(esp32.last_heartbeat) : null;
          const now = new Date();
          const isRecent = lastHeartbeat && (now.getTime() - lastHeartbeat.getTime()) < 5 * 60 * 1000; // 5 minutes
          
          esp32Online = esp32.is_online && isRecent;
          
          if (!esp32Online) {
            realStatus = 'offline';
          } else {
            // Check relay status
            const relayStatus = esp32.relay_status as any;
            if (relayStatus) {
              // Check if relay status is "on" or if there's a specific relay pin status
              const relayOn = relayStatus === 'on' || 
                             relayStatus.status === 'on' ||
                             relayStatus[`relay${machine.relay_pin}`] === 'on';
              
              if (relayOn) {
                realStatus = 'running';
              } else {
                realStatus = 'available';
              }
            }
          }
        } else {
          realStatus = 'offline';
        }

        return {
          ...machine,
          realStatus,
          esp32_online: esp32Online,
          signal_strength: esp32?.signal_strength || null,
          last_heartbeat: esp32?.last_heartbeat || null,
          network_status: esp32?.network_status || 'unknown',
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
    }
  };

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
      cell: ({ row }) => (
        <span className="capitalize">
          {row.getValue("type") === "washing" ? "Lavadora" : "Secadora"}
        </span>
      ),
    },
    {
      accessorKey: "realStatus",
      header: "Status Real",
      cell: ({ row }) => {
        const machine = row.original;
        const status = machine.realStatus || machine.status;
        
        const getStatusConfig = (s: string) => {
          if (s === 'offline') return { variant: "destructive" as const, label: "Offline", icon: "🔴" };
          if (s === 'in_use' || s === 'running') return { variant: "secondary" as const, label: "Em Uso", icon: "🔵" };
          if (s === 'maintenance') return { variant: "outline" as const, label: "Manutenção", icon: "🟡" };
          return { variant: "default" as const, label: "Disponível", icon: "🟢" };
        };
        
        const config = getStatusConfig(status);
        return (
          <div className="flex items-center gap-2">
            <span>{config.icon}</span>
            <Badge variant={config.variant}>
              {config.label}
            </Badge>
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
      accessorKey: "price_per_kg",
      header: "Preço/kg",
      cell: ({ row }) => {
        const price = row.getValue("price_per_kg") as number;
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

        <MachineDialog 
          machine={editingMachine}
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
