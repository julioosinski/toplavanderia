import { useEffect, useState } from "react";
import { useLaundry } from "@/contexts/LaundryContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";

type Machine = {
  id: string;
  name: string;
  type: string;
  status: string;
  capacity_kg: number;
  price_per_kg: number;
  total_uses: number | null;
  total_revenue: number | null;
};

const columns: ColumnDef<Machine>[] = [
  {
    accessorKey: "name",
    header: "Nome",
  },
  {
    accessorKey: "type",
    header: "Tipo",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <Badge variant={status === "available" ? "default" : "secondary"}>
          {status === "available" ? "Disponível" : "Em Uso"}
        </Badge>
      );
    },
  },
  {
    accessorKey: "capacity_kg",
    header: "Capacidade (kg)",
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
  },
  {
    accessorKey: "total_revenue",
    header: "Receita Total",
    cell: ({ row }) => {
      const revenue = row.getValue("total_revenue") as number;
      return `R$ ${(revenue || 0).toFixed(2)}`;
    },
  },
];

export default function Machines() {
  const { currentLaundry } = useLaundry();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentLaundry) {
      loadMachines();
    }
  }, [currentLaundry]);

  const loadMachines = async () => {
    if (!currentLaundry) return;

    setLoading(true);
    const { data } = await supabase
      .from("machines")
      .select("*")
      .eq("laundry_id", currentLaundry.id)
      .order("name");

    setMachines(data || []);
    setLoading(false);
  };

  if (loading) {
    return <div className="animate-pulse">Carregando...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Máquinas</h1>
          <p className="text-muted-foreground">
            Gerencie suas máquinas de lavar
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nova Máquina
        </Button>
      </div>

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
  );
}
