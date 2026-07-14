import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Receipt, TrendingUp, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLaundry } from "@/hooks/useLaundry";
import { billableRevenueAmount } from "@/lib/transactionRevenue";

type SalesPeriod = "daily" | "monthly" | "custom";

interface SalesTotals {
  salesCount: number;
  revenue: number;
}

const todayIsoDate = () => new Date().toISOString().split("T")[0];

const monthStartIsoDate = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
};

const formatBrl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const periodLabel = (period: SalesPeriod, start: string, end: string) => {
  if (period === "daily") return "Hoje";
  if (period === "monthly") return "Mês atual";
  return `${start.split("-").reverse().join("/")} – ${end.split("-").reverse().join("/")}`;
};

export const DashboardSalesSummary = () => {
  const { isAdmin, isSuperAdmin, currentLaundry, isViewingAllLaundries, laundries } = useLaundry();
  const isConsolidated = isSuperAdmin && isViewingAllLaundries;

  const [period, setPeriod] = useState<SalesPeriod>("daily");
  const [customStart, setCustomStart] = useState(() => monthStartIsoDate());
  const [customEnd, setCustomEnd] = useState(() => todayIsoDate());
  const [totals, setTotals] = useState<SalesTotals>({ salesCount: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => {
    if (period === "daily") {
      const day = todayIsoDate();
      return { start: day, end: day };
    }
    if (period === "monthly") {
      return { start: monthStartIsoDate(), end: todayIsoDate() };
    }
    const start = customStart <= customEnd ? customStart : customEnd;
    const end = customStart <= customEnd ? customEnd : customStart;
    return { start, end };
  }, [period, customStart, customEnd]);

  const loadSales = useCallback(async () => {
    if (!isAdmin) return;
    if (!isConsolidated && !currentLaundry?.id) {
      setTotals({ salesCount: 0, revenue: 0 });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from("transactions")
        .select("id, total_amount, payment_method")
        .eq("status", "completed")
        .gte("created_at", `${range.start}T00:00:00`)
        .lte("created_at", `${range.end}T23:59:59.999`);

      if (isConsolidated) {
        const laundryIds = laundries.map((l) => l.id).filter(Boolean);
        if (laundryIds.length === 0) {
          setTotals({ salesCount: 0, revenue: 0 });
          return;
        }
        query = query.in("laundry_id", laundryIds);
      } else {
        query = query.eq("laundry_id", currentLaundry!.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = data || [];
      const revenue = rows.reduce(
        (sum, row) => sum + billableRevenueAmount(row.total_amount, row.payment_method),
        0,
      );
      // Liberações manuais não contam como venda paga.
      const salesCount = rows.filter((row) => row.payment_method !== "manual_release").length;

      setTotals({ salesCount, revenue });
    } catch (err) {
      console.error("[DashboardSalesSummary]", err);
      setTotals({ salesCount: 0, revenue: 0 });
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isConsolidated, currentLaundry, laundries, range.start, range.end]);

  useEffect(() => {
    void loadSales();
  }, [loadSales]);

  if (!isAdmin) return null;

  const averageTicket = totals.salesCount > 0 ? totals.revenue / totals.salesCount : 0;
  const scopeLabel = isConsolidated
    ? "Todas as lavanderias"
    : currentLaundry?.name || "Lavanderia";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg">Vendas</CardTitle>
            <CardDescription>
              {scopeLabel} · {periodLabel(period, range.start, range.end)}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border p-0.5">
              {(
                [
                  { id: "daily", label: "Diário" },
                  { id: "monthly", label: "Mensal" },
                  { id: "custom", label: "Personalizado" },
                ] as const
              ).map((option) => (
                <Button
                  key={option.id}
                  type="button"
                  size="sm"
                  variant={period === option.id ? "default" : "ghost"}
                  className="h-8 px-3"
                  onClick={() => setPeriod(option.id)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => void loadSales()}
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {period === "custom" && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 max-w-xl">
            <div className="space-y-1.5">
              <Label htmlFor="dashboard-sales-start">De</Label>
              <Input
                id="dashboard-sales-start"
                type="date"
                value={customStart}
                max={customEnd}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dashboard-sales-end">Até</Label>
              <Input
                id="dashboard-sales-end"
                type="date"
                value={customEnd}
                min={customStart}
                max={todayIsoDate()}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                <Receipt className="h-4 w-4" />
                Total de vendas
              </div>
              <p className="text-2xl font-bold tracking-tight">{totals.salesCount}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                <DollarSign className="h-4 w-4" />
                Receita
              </div>
              <p className="text-2xl font-bold tracking-tight">{formatBrl(totals.revenue)}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                <TrendingUp className="h-4 w-4" />
                Ticket médio
              </div>
              <p className="text-2xl font-bold tracking-tight">{formatBrl(averageTicket)}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
