import { useCallback, useEffect, useState } from "react";
import { useLaundry } from "@/hooks/useLaundry";
import { supabase } from "@/integrations/supabase/client";
import { LaundryGuard } from "@/components/admin/LaundryGuard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

type Transaction = {
  id: string;
  created_at: string;
  machine_id: string;
  machine_name?: string;
  machine_type?: string;
  status: string;
  total_amount: number;
  payment_method: string | null;
  weight_kg: number;
  duration_minutes: number | null;
  user_id?: string | null;
  operator_name?: string;
};

const statusLabels: Record<string, string> = {
  completed: "Concluído",
  in_progress: "Em Andamento",
  pending: "Pendente",
  cancelled: "Cancelado",
  failed: "Falhou",
};

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  completed: "default",
  in_progress: "secondary",
  pending: "outline",
  cancelled: "destructive",
  failed: "destructive",
};

const columns: ColumnDef<Transaction>[] = [
  {
    accessorKey: "created_at",
    header: "Data",
    cell: ({ row }) => {
      const date = new Date(row.getValue("created_at"));
      return date.toLocaleDateString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    },
  },
  {
    accessorKey: "machine_name",
    header: "Máquina",
    cell: ({ row }) => row.original.machine_name || row.original.machine_id.slice(0, 8),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <Badge variant={statusVariants[status] || "secondary"}>
          {statusLabels[status] || status}
        </Badge>
      );
    },
  },
  {
    accessorKey: "duration_minutes",
    header: "Duração (min)",
  },
  {
    accessorKey: "payment_method",
    header: "Pagamento",
    cell: ({ row }) => {
      const method = row.getValue("payment_method") as string | null;
      if (method === "manual_release") {
        return (
          <Badge variant="outline" className="border-amber-500 text-amber-700">
            Liberação Manual
          </Badge>
        );
      }
      return method || "—";
    },
  },
  {
    accessorKey: "operator_name",
    header: "Operador",
    cell: ({ row }) => {
      const name = row.original.operator_name;
      if (!name) return "—";
      return <span className="text-sm font-medium">{name}</span>;
    },
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

type DateFilter = "all" | "today" | "week" | "month";

export default function Transactions() {
  const { currentLaundry } = useLaundry();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const currentLaundryId = currentLaundry?.id;

  const loadTransactions = useCallback(async () => {
    if (!currentLaundryId) return;
    setLoading(true);

    let query = supabase
      .from("transactions")
      .select("*")
      .eq("laundry_id", currentLaundryId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (dateFilter !== "all") {
      const now = new Date();
      let startDate: Date;
      if (dateFilter === "today") {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (dateFilter === "week") {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      query = query.gte("created_at", startDate.toISOString());
    }

    const { data: txData } = await query;

    // Fetch machine names
    const { data: machinesData } = await supabase
      .from("machines")
      .select("id, name, type")
      .eq("laundry_id", currentLaundryId);
    const machineMap = new Map(machinesData?.map(m => [m.id, m]) || []);

    // Fetch operator names for manual releases
    const manualUserIds = [...new Set((txData || []).filter(t => t.payment_method === 'manual_release' && t.user_id).map(t => t.user_id!))];
    let profileMap = new Map<string, string>();
    if (manualUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", manualUserIds);
      profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name || '']) || []);
    }

    const enriched = (txData || []).map(tx => {
      const machine = machineMap.get(tx.machine_id);
      return {
        ...tx,
        machine_name: machine?.name || undefined,
        machine_type: machine?.type || undefined,
        operator_name: tx.payment_method === 'manual_release' && tx.user_id ? profileMap.get(tx.user_id) || undefined : undefined,
      };
    });

    setTransactions(enriched);
    setLoading(false);
  }, [currentLaundryId, dateFilter]);

  useEffect(() => {
    if (currentLaundryId) void loadTransactions();
  }, [currentLaundryId, loadTransactions]);

  const filterLabels: Record<DateFilter, string> = {
    all: "Todas",
    today: "Hoje",
    week: "Semana",
    month: "Mês",
  };

  if (loading) {
    return <div className="animate-pulse">Carregando...</div>;
  }

  return (
    <LaundryGuard>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Transações</h1>
            <p className="text-sm text-muted-foreground">Histórico completo de transações</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {(["all", "today", "week", "month"] as DateFilter[]).map(f => (
              <Button
                key={f}
                variant={dateFilter === f ? "default" : "outline"}
                size="sm"
                onClick={() => setDateFilter(f)}
              >
                {filterLabels[f]}
              </Button>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Transações</CardTitle>
            <CardDescription>
              {dateFilter === "all" ? "Últimas 200 transações" : `Filtro: ${filterLabels[dateFilter]}`}
              {" — "}
              {transactions.length} registro(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={transactions}
              searchKey="machine_name"
              searchPlaceholder="Filtrar por máquina..."
            />
          </CardContent>
        </Card>
      </div>
    </LaundryGuard>
  );
}
