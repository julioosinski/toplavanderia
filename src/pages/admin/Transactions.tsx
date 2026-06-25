import { useCallback, useEffect, useMemo, useState } from "react";
import { useLaundry } from "@/hooks/useLaundry";
import { supabase } from "@/integrations/supabase/client";
import { LaundryGuard } from "@/components/admin/LaundryGuard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getMachineTypeMeta,
  mapDbMachineType,
  MACHINE_TYPE_ORDER,
  type MachineDisplayType,
} from "@/lib/machineDisplayTypes";
import {
  displayTransactionAmount,
  isManualRelease,
} from "@/lib/transactionRevenue";

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
  service_type?: MachineDisplayType;
};

const SERVICE_TYPES: MachineDisplayType[] = ["lavadora", "secadora", "massage", "coffee"];

const getPaymentLabel = (method: string | null | undefined) => {
  if (!method) return "—";
  if (method === "manual_release") return "Liberação Manual";
  if (method === "pix") return "PIX";
  if (method === "credit") return "Crédito";
  if (method === "debit" || method === "card") return "Débito";
  if (method === "cielo") return "Cielo";
  if (method === "totem") return "Totem";
  if (method.includes("*")) return `Cartão ${method}`;
  return method;
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
    accessorKey: "service_type",
    header: "Serviço",
    cell: ({ row }) => {
      const type = row.original.service_type ?? mapDbMachineType(row.original.machine_type);
      const meta = getMachineTypeMeta(type);
      const Icon = meta.icon;
      return (
        <Badge variant="outline" className="gap-1 font-normal">
          <Icon className="h-3 w-3" />
          {meta.label}
        </Badge>
      );
    },
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
    cell: ({ row }) => {
      const type = row.original.service_type ?? mapDbMachineType(row.original.machine_type);
      if (type === "coffee") return "—";
      const minutes = row.getValue("duration_minutes") as number | null;
      return minutes ?? "—";
    },
  },
  {
    accessorKey: "payment_method",
    header: "Pagamento",
    cell: ({ row }) => {
      const method = row.getValue("payment_method") as string | null;
      if (isManualRelease(method)) {
        return (
          <Badge variant="outline" className="border-amber-500 text-amber-700">
            Liberação Manual
          </Badge>
        );
      }
      return getPaymentLabel(method);
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
      const amount = displayTransactionAmount(row.getValue("total_amount") as number);
      const manual = isManualRelease(row.original.payment_method);
      return (
        <div className="text-right">
          <span className="font-medium">R$ {amount.toFixed(2)}</span>
          {manual && (
            <span className="block text-xs text-muted-foreground">liberação manual</span>
          )}
        </div>
      );
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
      .eq("status", "completed")
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
    const manualUserIds = [
      ...new Set(
        (txData || [])
          .filter((t) => isManualRelease(t.payment_method) && t.user_id)
          .map((t) => t.user_id!),
      ),
    ];
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
      const serviceType = mapDbMachineType(machine?.type);
      return {
        ...tx,
        machine_name: machine?.name || undefined,
        machine_type: machine?.type || undefined,
        service_type: serviceType,
        operator_name:
          isManualRelease(tx.payment_method) && tx.user_id
            ? profileMap.get(tx.user_id) || undefined
            : undefined,
      };
    });

    setTransactions(enriched);
    setLoading(false);
  }, [currentLaundryId, dateFilter]);

  const serviceSummaries = useMemo(() => {
    const totals: Record<MachineDisplayType, { count: number; total: number }> = {
      lavadora: { count: 0, total: 0 },
      secadora: { count: 0, total: 0 },
      massage: { count: 0, total: 0 },
      coffee: { count: 0, total: 0 },
    };

    for (const tx of transactions) {
      const type = tx.service_type ?? mapDbMachineType(tx.machine_type);
      totals[type].count += 1;
      totals[type].total += displayTransactionAmount(tx.total_amount);
    }

    return totals;
  }, [transactions]);

  const grandTotal = useMemo(
    () => transactions.reduce((sum, tx) => sum + displayTransactionAmount(tx.total_amount), 0),
    [transactions],
  );

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

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[...SERVICE_TYPES]
            .sort((a, b) => MACHINE_TYPE_ORDER[a] - MACHINE_TYPE_ORDER[b])
            .map((type) => {
              const meta = getMachineTypeMeta(type);
              const Icon = meta.icon;
              const summary = serviceSummaries[type];
              return (
                <Card key={type} className={`border ${meta.cardBorder}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className={`text-sm font-medium flex items-center gap-2 ${meta.titleClass}`}>
                      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${meta.iconBg}`}>
                        <Icon className="h-4 w-4 text-white" />
                      </span>
                      {meta.label}
                    </CardTitle>
                    <CardDescription>
                      {summary.count} transaç{summary.count !== 1 ? "ões" : "ão"} no período
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold tracking-tight">
                      R$ {summary.total.toFixed(2)}
                    </p>
                    {type === "coffee" && (
                      <p className="text-xs text-muted-foreground mt-1">Créditos liberados / vendidos</p>
                    )}
                    {type === "massage" && (
                      <p className="text-xs text-muted-foreground mt-1">Sessões liberadas / pagas</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Resumo do período</CardTitle>
              <CardDescription>
                Soma de lavagem, secagem, café e massagem (inclui liberações manuais)
              </CardDescription>
            </div>
            <p className="text-xl font-bold whitespace-nowrap">R$ {grandTotal.toFixed(2)}</p>
          </CardHeader>
        </Card>

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
