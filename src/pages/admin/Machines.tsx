import { useCallback, useEffect, useState, useRef } from "react";
import { useLaundry } from "@/hooks/useLaundry";
import { useOperatorReleasePermission } from "@/hooks/useOperatorReleasePermission";
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
  type MachineRow,
} from "@/lib/machineEsp32Sync";
import { adminRemoteRelease } from "@/lib/deviceRemoteRelease";
import { reaisToCentavos } from "@/lib/money";
import { classifyReleaseError } from "@/lib/manualReleaseFeedback";
import { ESP32ConfigurationDialog } from "@/components/admin/ESP32ConfigurationDialog";
import { Link } from "react-router-dom";
import { Sofa, Coffee } from "lucide-react";
import { ESP32PendingApproval } from "@/components/admin/ESP32PendingApproval";
import { SectionErrorBoundary } from "@/components/system/SectionErrorBoundary";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Machine = MachineRow & {
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

type Esp32StatusWithLaundry = Esp32StatusRow & {
  laundry_id?: string | null;
};

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : "Erro desconhecido";
};

const asNumber = (value: unknown, fallback = 0) => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export default function Machines() {
  const { currentLaundry, isSuperAdmin, isViewingAllLaundries } = useLaundry();
  const permission = useOperatorReleasePermission();
  const { isOperator, canRelease, dayCents, monthCents, dayLimitCents, monthLimitCents, refetch: refetchPermission } = permission;
  const { toast } = useToast();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const loadMachinesRef = useRef<() => Promise<void>>(async () => {});
  const initialLoadDone = useRef(false);
  const currentLaundryId = currentLaundry?.id;
  const isAllLaundryView = isSuperAdmin && isViewingAllLaundries;

  const loadMachines = useCallback(async () => {
    if (!currentLaundryId && !isAllLaundryView) {
      setMachines([]);
      setLoading(false);
      return;
    }

    try {
      if (!initialLoadDone.current) setLoading(true);
      
      // Fetch machines with ESP32 status
      let machinesQuery = supabase
        .from("machines")
        .select("*")
        .order("name");

      if (!isAllLaundryView && currentLaundryId) {
        machinesQuery = machinesQuery.eq("laundry_id", currentLaundryId);
      }

      const { data: machinesData, error: machinesError } = await machinesQuery;

      if (machinesError) throw machinesError;

      // Fetch ESP32 status separately
      const { data: esp32Data, error: esp32Error } = await supabase
        .from("esp32_status")
        .select("esp32_id, ip_address, is_online, signal_strength, last_heartbeat, network_status, relay_status, laundry_id");

      let esp32ForLaundry: Esp32StatusWithLaundry[] = [];
      if (esp32Error) {
        console.warn("Error loading ESP32 status; showing machines without signal data:", esp32Error);
        const { data: rpcEsp32Data } = await supabase.rpc("get_esp32_heartbeats", {
          _laundry_id: currentLaundryId,
        });
        esp32ForLaundry = ((rpcEsp32Data || []) as Esp32StatusWithLaundry[]).map((esp) => ({
          ...esp,
          laundry_id: currentLaundryId,
        }));
      } else {
        const esp32Rows = (esp32Data || []) as Esp32StatusWithLaundry[];
        esp32ForLaundry = isAllLaundryView
          ? esp32Rows
          : esp32Rows.filter((esp) => esp.laundry_id === currentLaundryId);
      }

      const enrichedMachines = ((machinesData || []) as Machine[]).map((machine) => {
        const esp32: Esp32StatusRow | undefined = machine.esp32_id
          ? esp32ForLaundry.find((esp) => esp.esp32_id === machine.esp32_id)
          : undefined;

        const staleMs = ESP32_HEARTBEAT_STALE_MINUTES * 60_000;
        const computed = computeMachineStatus(machine, esp32, { staleMs });
        const espReachable = isEsp32Reachable(esp32, staleMs);

        return {
          ...machine,
          realStatus: computed.status,
          esp32_online: espReachable,
          signal_strength: esp32?.signal_strength || null,
          last_heartbeat: esp32?.last_heartbeat || null,
          network_status: esp32?.network_status || 'unknown',
        };
      });

      setMachines(enrichedMachines);
    } catch (error: unknown) {
      console.error("Error loading machines:", error);
      toast({
        title: "Erro",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      initialLoadDone.current = true;
    }
  }, [currentLaundryId, isAllLaundryView, toast]);

  loadMachinesRef.current = loadMachines;

  useEffect(() => {
    if (currentLaundryId || isAllLaundryView) {
      void loadMachines();
    } else {
      setMachines([]);
      setLoading(false);
    }
  }, [currentLaundryId, isAllLaundryView, loadMachines]);

  const dialogOpenRef = useRef(false);
  dialogOpenRef.current = dialogOpen;

  useEffect(() => {
    if (!currentLaundry?.id || isAllLaundryView) return;
    const lid = currentLaundry.id;
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (dialogOpenRef.current) return;
      // Debounce: heartbeats de ESP32 chegam ~30s e resetavam a tabela/paginação.
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => {
        if (!dialogOpenRef.current) void loadMachinesRef.current();
      }, 2500);
    };
    const channel = supabase
      .channel(`admin-machines-rt-${lid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'machines', filter: `laundry_id=eq.${lid}` },
        scheduleReload
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'esp32_status', filter: `laundry_id=eq.${lid}` },
        scheduleReload
      )
      .subscribe();
    return () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      void supabase.removeChannel(channel);
    };
  }, [currentLaundry?.id, isAllLaundryView]);

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
    } catch (error: unknown) {
      toast({
        title: "Erro",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleSuccess = () => {
    setDialogOpen(false);
    setEditingMachine(null);
    loadMachines();
  };

  const formatBRL = (cents: number) => `R$ ${(cents / 100).toFixed(2)}`;

  const limitBadge = isOperator && canRelease ? (
    <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
      <span>
        <strong className="text-foreground">Hoje:</strong> {formatBRL(dayCents)}
        {dayLimitCents != null ? ` / ${formatBRL(dayLimitCents)}` : ' (sem limite)'}
      </span>
      <span>
        <strong className="text-foreground">Mês:</strong> {formatBRL(monthCents)}
        {monthLimitCents != null ? ` / ${formatBRL(monthLimitCents)}` : ' (sem limite)'}
      </span>
    </div>
  ) : null;

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
        const labels: Record<string, string> = {
          lavadora: "Lavadora",
          washing: "Lavadora",
          secadora: "Secadora",
          drying: "Secadora",
          massage: "Poltrona",
          coffee: "Café",
        };
        return <span>{labels[type] ?? type}</span>;
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
        const price = asNumber(row.getValue("price_per_cycle"));
        return `R$ ${price.toFixed(2)}`;
      },
    },
    {
      accessorKey: "total_uses",
      header: "Total de Usos",
      cell: ({ row }) => asNumber(row.getValue("total_uses")),
    },
    {
      accessorKey: "total_revenue",
      header: "Receita Total",
      cell: ({ row }) => {
        const revenue = asNumber(row.getValue("total_revenue"));
        return `R$ ${revenue.toFixed(2)}`;
      },
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => {
        const machine = row.original;

        if (isOperator && !canRelease) {
          return (
            <span className="text-xs text-muted-foreground">
              Sem autorização
            </span>
          );
        }

        const handleRelease = async () => {
          const isCoffee = machine.type === 'coffee';
          const isMassage = machine.type === 'massage';
          if (isCoffee) {
            const raw = window.prompt(
              `Valor do crédito de café em "${machine.name}" (R$):`,
              '',
            );
            if (!raw) return;
            const valorCentavos = reaisToCentavos(raw);
            if (valorCentavos <= 0) {
              toast({ title: 'Valor inválido', description: 'Informe um valor em reais (ex.: 8,50).', variant: 'destructive' });
              return;
            }
            if (!confirm(`Liberar R$ ${(valorCentavos / 100).toFixed(2)} no moedeiro de "${machine.name}"?`)) return;
            const { error } = await adminRemoteRelease({ machineId: machine.id, valorCentavos });
            if (error) {
              toast({ ...classifyReleaseError(error.message), variant: 'destructive' });
            } else {
              toast({ title: 'Liberação remota enfileirada', description: `R$ ${(valorCentavos / 100).toFixed(2)} — comando enviado ao ESP32.` });
              loadMachines();
              void refetchPermission();
            }
            return;
          }
          if (isMassage) {
            if (!confirm('Liberar sessão de massagem remotamente (relé ON pelo tempo do ciclo)?')) return;
            const { error } = await adminRemoteRelease({ machineId: machine.id });
            if (error) {
              toast({ ...classifyReleaseError(error.message), variant: 'destructive' });
            } else {
              toast({ title: 'Liberação remota enfileirada', description: 'Comando enviado ao ESP32.' });
              loadMachines();
              void refetchPermission();
            }
            return;
          }
          if (isOperator) {
            // Operador: usa admin_remote_release (com validação de limite no backend)
            if (!confirm(`Liberar máquina "${machine.name}" remotamente?`)) return;
            const { error } = await adminRemoteRelease({ machineId: machine.id });
            if (error) {
              toast({ ...classifyReleaseError(error.message), variant: 'destructive' });
            } else {
              toast({ title: 'Máquina liberada', description: 'Comando enviado ao ESP32.' });
              loadMachines();
              void refetchPermission();
            }
            return;
          }
          if (!confirm('Liberar no totem (disponível), atualizar relé no painel e enviar comando OFF ao ESP32?')) return;
          const { error } = await forceMachineReleased({ machineId: machine.id });
          if (error) {
            toast({ title: 'Erro', description: error.message, variant: 'destructive' });
          } else {
            toast({ title: 'Máquina liberada', description: 'Totem e esp32_status alinhados; comando de desligar relé enfileirado.' });
            loadMachines();
          }
        };

        if (isOperator) {
          return (
            <Button variant="outline" size="sm" onClick={handleRelease}>
              <Unlock className="mr-2 h-4 w-4" />
              {machine.type === 'coffee' || machine.type === 'massage' ? 'Liberar remoto' : 'Liberar'}
            </Button>
          );
        }

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
              <DropdownMenuItem onClick={handleRelease}>
                <Unlock className="mr-2 h-4 w-4" />
                {machine.type === 'coffee' || machine.type === 'massage' ? 'Liberar remoto' : 'Liberar máquina'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  if (!confirm('Colocar em manutenção, espelhar relé OFF e enviar comando OFF ao ESP32?')) return;
                  const { error } = await forceMachineMaintenance(machine.id);
                  if (error) {
                    toast({ title: 'Erro', description: error.message, variant: 'destructive' });
                  } else {
                    toast({ title: 'Manutenção', description: 'Status atualizado e relé desligado no painel e no ESP32.' });
                    loadMachines();
                  }
                }}
              >
                <Wrench className="mr-2 h-4 w-4" />
                Colocar em manutenção
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDelete(machine)} className="text-destructive">
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
    <LaundryGuard allowSuperAdminAllView={isAllLaundryView}>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Máquinas</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie lavadoras, secadoras, poltronas e café
            </p>
          </div>
          {!isOperator && (
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" className="sm:size-default" asChild>
                <Link to="/admin/coffee-firmware">
                  <Coffee className="mr-1 sm:mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Firmware Café</span>
                  <span className="sm:hidden">Café</span>
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="sm:size-default" asChild>
                <Link to="/admin/massage-chair">
                  <Sofa className="mr-1 sm:mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Firmware Poltrona</span>
                  <span className="sm:hidden">Poltrona</span>
                </Link>
              </Button>
              <ESP32ConfigurationDialog />
              <Button size="sm" className="sm:size-default" onClick={() => {
                setEditingMachine(null);
                setDialogOpen(true);
              }}>
                <Plus className="mr-1 sm:mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Nova Máquina</span>
                <span className="sm:hidden">Nova</span>
              </Button>
            </div>
          )}
        </div>

        {limitBadge}

        {!isOperator && (
          <SectionErrorBoundary title="Falha ao carregar pendências de ESP32.">
            <ESP32PendingApproval />
          </SectionErrorBoundary>
        )}

        <MachineDialog 
          machine={editingMachine ? {
            ...editingMachine,
            type: (
              editingMachine.type === 'washing' ? 'lavadora'
              : editingMachine.type === 'drying' ? 'secadora'
              : editingMachine.type === 'massage' ? 'massage'
              : editingMachine.type === 'coffee' ? 'coffee'
              : editingMachine.type === 'lavadora' || editingMachine.type === 'secadora'
                ? editingMachine.type
                : 'lavadora'
            ) as 'lavadora' | 'secadora' | 'massage' | 'coffee',
            esp32_id: editingMachine.esp32_id ?? undefined,
            relay_pin: editingMachine.relay_pin ?? undefined,
          } : null}
          onSuccess={handleSuccess}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />

        <SectionErrorBoundary title="Falha ao carregar tabela de máquinas.">
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
        </SectionErrorBoundary>
      </div>
    </LaundryGuard>
  );
}
