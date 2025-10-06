import { useEffect, useState } from "react";
import { useLaundry } from "@/contexts/LaundryContext";
import { supabase } from "@/integrations/supabase/client";
import { LaundryGuard } from "@/components/admin/LaundryGuard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, MoreVertical } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MachineDialog } from "@/components/admin/MachineDialog";
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
      const { data, error } = await supabase
        .from("machines")
        .select("*")
        .eq("laundry_id", currentLaundry.id)
        .order("name");

      if (error) throw error;

      setMachines((data || []) as Machine[]);
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
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        const variants = {
          available: "default",
          in_use: "secondary",
          maintenance: "destructive",
        };
        const labels = {
          available: "Disponível",
          in_use: "Em uso",
          maintenance: "Manutenção",
        };
        return (
          <Badge variant={variants[status as keyof typeof variants] as any}>
            {labels[status as keyof typeof labels] || status}
          </Badge>
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
          <Button onClick={() => {
            setEditingMachine(null);
            setDialogOpen(true);
          }}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Máquina
          </Button>
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
