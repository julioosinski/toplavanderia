import { useEffect, useState } from "react";
import { useLaundry } from "@/contexts/LaundryContext";
import { supabase } from "@/integrations/supabase/client";
import { LaundryGuard } from "@/components/admin/LaundryGuard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";

type Transaction = {
  id: string;
  created_at: string;
  machine_id: string;
  status: string;
  total_amount: number;
  payment_method: string | null;
  weight_kg: number;
  duration_minutes: number | null;
};

const columns: ColumnDef<Transaction>[] = [
  {
    accessorKey: "created_at",
    header: "Data",
    cell: ({ row }) => {
      const date = new Date(row.getValue("created_at"));
      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    },
  },
  {
    accessorKey: "machine_id",
    header: "Máquina",
    cell: ({ row }) => {
      const id = row.getValue("machine_id") as string;
      return id.slice(0, 8);
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      const variants: Record<string, "default" | "secondary" | "destructive"> = {
        completed: "default",
        in_progress: "secondary",
        cancelled: "destructive",
      };
      return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
    },
  },
  {
    accessorKey: "weight_kg",
    header: "Peso (kg)",
  },
  {
    accessorKey: "duration_minutes",
    header: "Duração (min)",
  },
  {
    accessorKey: "payment_method",
    header: "Pagamento",
  },
  {
    accessorKey: "total_amount",
    header: "Valor",
    cell: ({ row }) => {
      const amount = row.getValue("total_amount") as number;
      return `R$ ${amount.toFixed(2)}`;
    },
  },
];

export default function Transactions() {
  const { currentLaundry } = useLaundry();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentLaundry) {
      loadTransactions();
    }
  }, [currentLaundry]);

  const loadTransactions = async () => {
    if (!currentLaundry) return;

    setLoading(true);
    const { data } = await supabase
      .from("transactions")
      .select("*")
      .eq("laundry_id", currentLaundry.id)
      .order("created_at", { ascending: false })
      .limit(100);

    setTransactions(data || []);
    setLoading(false);
  };

  if (loading) {
    return <div className="animate-pulse">Carregando...</div>;
  }

  return (
    <LaundryGuard>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transações</h1>
          <p className="text-muted-foreground">
            Histórico completo de transações
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Todas as Transações</CardTitle>
            <CardDescription>
              Últimas 100 transações realizadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={transactions}
              searchKey="status"
              searchPlaceholder="Filtrar por status..."
            />
          </CardContent>
        </Card>
      </div>
    </LaundryGuard>
  );
}
