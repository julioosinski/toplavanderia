import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Download, TrendingUp, Calendar, WashingMachine } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLaundry } from "@/hooks/useLaundry";
import { displayTransactionAmount, isManualRelease } from "@/lib/transactionRevenue";
import { Skeleton } from "@/components/ui/skeleton";
import { getMachineTypeMeta, mapDbMachineType, type MachineDisplayType } from "@/lib/machineDisplayTypes";
import {
  brazilIsoDate,
  brazilIsoDateLabel,
  brazilMonthStartIsoDate,
  brazilRangeBoundsUtc,
  formatBrazilDateTime,
} from "@/lib/brazilReportDates";
import {
  dbTypesForDisplayType,
  formatBrl,
  groupSalesTransactions,
  machineFromJoin,
  resolveSalesPeriodRange,
  salesPeriodCaption,
  type SalesGroupBy,
  type SalesMachineOption,
  type SalesPeriodPreset,
  type SalesTransactionRow,
} from "@/lib/salesReport";

const PAGE_SIZE = 1000;
const PRESETS: { id: SalesPeriodPreset; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "7d", label: "7 dias" },
  { id: "month", label: "Este mês" },
  { id: "custom", label: "Personalizado" },
];
const GROUP_OPTIONS: { id: SalesGroupBy; label: string }[] = [
  { id: "machine", label: "Por máquina" },
  { id: "daily", label: "Por dia" },
  { id: "weekly", label: "Por semana" },
  { id: "monthly", label: "Por mês" },
];

const paymentLabel = (method: string | null | undefined) => {
  if (!method) return "—";
  if (method === "manual_release") return "Liberação manual";
  if (method === "pix") return "PIX";
  if (method === "credit") return "Crédito";
  if (method === "debit" || method === "card") return "Débito";
  if (method === "cielo") return "Cielo";
  if (method === "totem") return "Totem";
  if (method.includes("*")) return `Cartão ${method}`;
  return method;
};

export const LaundryReportsTab = () => {
  const { currentLaundry } = useLaundry();
  const currentLaundryId = currentLaundry?.id;
  const { toast } = useToast();
  const requestId = useRef(0);

  const [preset, setPreset] = useState<SalesPeriodPreset>("month");
  const [customStart, setCustomStart] = useState(() => brazilMonthStartIsoDate());
  const [customEnd, setCustomEnd] = useState(() => brazilIsoDate());
  const [groupBy, setGroupBy] = useState<SalesGroupBy>("machine");
  const [machineId, setMachineId] = useState("all");
  const [machineType, setMachineType] = useState<"all" | MachineDisplayType>("all");
  const [paymentMethod, setPaymentMethod] = useState("all");

  const [machines, setMachines] = useState<SalesMachineOption[]>([]);
  const [transactions, setTransactions] = useState<SalesTransactionRow[]>([]);
  const [loading, setLoading] = useState(false);

  const range = useMemo(
    () => resolveSalesPeriodRange(preset, customStart, customEnd),
    [preset, customStart, customEnd],
  );

  const loadMachines = useCallback(async () => {
    if (!currentLaundryId) return;
    const { data, error } = await supabase
      .from("machines")
      .select("id, name, type")
      .eq("laundry_id", currentLaundryId)
      .order("name");
    if (!error && data) setMachines(data as SalesMachineOption[]);
  }, [currentLaundryId]);

  const loadReport = useCallback(async () => {
    if (!currentLaundryId) return;
    const id = ++requestId.current;
    setLoading(true);
    try {
      const { startUtc, endUtc } = brazilRangeBoundsUtc(range.start, range.end);
      const rows: SalesTransactionRow[] = [];
      let from = 0;

      for (;;) {
        let query = supabase
          .from("transactions")
          .select("id, machine_id, total_amount, created_at, payment_method, user_id, machines!inner(name, type)")
          .eq("laundry_id", currentLaundryId)
          .eq("status", "completed")
          .gte("created_at", startUtc)
          .lte("created_at", endUtc)
          .order("created_at", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (machineId !== "all") {
          query = query.eq("machine_id", machineId);
        }
        if (paymentMethod === "debit") {
          query = query.in("payment_method", ["debit", "card"]);
        } else if (paymentMethod !== "all") {
          query = query.eq("payment_method", paymentMethod);
        }

        const { data, error } = await query;
        if (error) throw error;
        rows.push(...((data || []) as SalesTransactionRow[]));
        if (!data || data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
        if (from >= 20000) break;
      }

      if (id !== requestId.current) return;

      let filtered = rows;
      if (machineType !== "all") {
        const allowed = new Set(dbTypesForDisplayType(machineType));
        filtered = rows.filter((tx) => {
          const joined = machineFromJoin(tx.machines);
          if (!joined.type) return false;
          return allowed.has(joined.type) || mapDbMachineType(joined.type) === machineType;
        });
      }

      const manualUserIds = [
        ...new Set(
          filtered
            .filter((t) => isManualRelease(t.payment_method) && t.user_id)
            .map((t) => t.user_id!),
        ),
      ];
      if (manualUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", manualUserIds);
        const profileMap = new Map(profiles?.map((p) => [p.user_id, p.full_name || ""]) || []);
        filtered = filtered.map((t) => ({
          ...t,
          operator_name:
            isManualRelease(t.payment_method) && t.user_id
              ? profileMap.get(t.user_id) || undefined
              : undefined,
        }));
      }

      if (id !== requestId.current) return;
      setTransactions(filtered);
    } catch (error) {
      console.error("Error generating report:", error);
      if (id === requestId.current) {
        toast({ title: "Erro", description: "Falha ao gerar relatório do período", variant: "destructive" });
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [currentLaundryId, machineId, machineType, paymentMethod, range.end, range.start, toast]);

  useEffect(() => {
    if (currentLaundryId) {
      void loadMachines();
    }
  }, [currentLaundryId, loadMachines]);

  useEffect(() => {
    if (currentLaundryId) {
      void loadReport();
    }
  }, [currentLaundryId, loadReport]);

  const machinesForGroup = useMemo(() => {
    let list = machines;
    if (machineId !== "all") list = list.filter((m) => m.id === machineId);
    if (machineType !== "all") {
      const allowed = new Set(dbTypesForDisplayType(machineType));
      list = list.filter((m) => allowed.has(m.type) || mapDbMachineType(m.type) === machineType);
    }
    return list;
  }, [machineId, machineType, machines]);

  const reportRows = useMemo(
    () => groupSalesTransactions(transactions, groupBy, machinesForGroup),
    [groupBy, machinesForGroup, transactions],
  );

  const totalSales = transactions.length;
  const totalRevenue = reportRows.reduce((sum, row) => sum + row.revenue, 0);
  const billableSales = transactions.filter((t) => !isManualRelease(t.payment_method)).length;
  const manualReleaseCount = transactions.filter((t) => isManualRelease(t.payment_method)).length;
  const averageTicket = billableSales > 0 ? totalRevenue / billableSales : 0;

  const exportReport = () => {
    const isMachine = groupBy === "machine";
    const headers = isMachine
      ? ["Máquina", "Tipo", "Ciclos", "Vendas pagas", "Receita", "Lib. manuais"]
      : ["Período", "Ciclos", "Vendas pagas", "Receita", "Lib. manuais"];
    const lines = [
      `Lavanderia,${currentLaundry?.name || ""}`,
      `Período,${salesPeriodCaption(range.start, range.end)}`,
      "",
      headers.join(","),
      ...reportRows.map((row) =>
        (isMachine
          ? [
              row.machineName,
              row.machineType ? getMachineTypeMeta(row.machineType).label : "",
              row.sales,
              row.billableSales,
              row.revenue.toFixed(2),
              row.manualCount,
            ]
          : [row.label, row.sales, row.billableSales, row.revenue.toFixed(2), row.manualCount]
        ).join(","),
      ),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `vendas_${currentLaundry?.name || "unidade"}_${range.start}_${range.end}.csv`;
    link.click();
  };

  if (!currentLaundry) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-center">Nenhuma lavanderia selecionada</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Filtros
          </CardTitle>
          <CardDescription>
            {currentLaundry.name} · {salesPeriodCaption(range.start, range.end)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((option) => (
              <Button
                key={option.id}
                type="button"
                size="sm"
                variant={preset === option.id ? "default" : "outline"}
                onClick={() => setPreset(option.id)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          {preset === "custom" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
              <div className="space-y-1.5">
                <Label htmlFor="sales-start">De</Label>
                <Input
                  id="sales-start"
                  type="date"
                  value={customStart}
                  max={customEnd || brazilIsoDate()}
                  onChange={(e) => {
                    setCustomStart(e.target.value);
                    setPreset("custom");
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sales-end">Até</Label>
                <Input
                  id="sales-end"
                  type="date"
                  value={customEnd}
                  min={customStart}
                  max={brazilIsoDate()}
                  onChange={(e) => {
                    setCustomEnd(e.target.value);
                    setPreset("custom");
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-1">
            {GROUP_OPTIONS.map((option) => (
              <Button
                key={option.id}
                type="button"
                size="sm"
                variant={groupBy === option.id ? "default" : "outline"}
                onClick={() => setGroupBy(option.id)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Máquina</Label>
              <Select value={machineId} onValueChange={setMachineId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {machines.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={machineType}
                onValueChange={(value) => setMachineType(value as "all" | MachineDisplayType)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="lavadora">Lavadora</SelectItem>
                  <SelectItem value="secadora">Secadora</SelectItem>
                  <SelectItem value="massage">Poltrona</SelectItem>
                  <SelectItem value="coffee">Café</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Pagamento</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="credit">Crédito</SelectItem>
                  <SelectItem value="debit">Débito</SelectItem>
                  <SelectItem value="cielo">Cielo</SelectItem>
                  <SelectItem value="manual_release">Liberação manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void loadReport()} disabled={loading}>
              {loading ? "Atualizando..." : "Atualizar"}
            </Button>
            <Button type="button" variant="outline" onClick={exportReport} disabled={reportRows.length === 0}>
              <Download size={16} className="mr-1" />
              Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-5">
            {loading ? <Skeleton className="h-16 w-full" /> : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <TrendingUp className="text-green-600 h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ciclos no período</p>
                  <p className="text-2xl font-bold">{totalSales}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            {loading ? <Skeleton className="h-16 w-full" /> : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="text-primary h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Receita</p>
                  <p className="text-2xl font-bold">{formatBrl(totalRevenue)}</p>
                  {manualReleaseCount > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {manualReleaseCount} lib. manual(is) fora da receita
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            {loading ? <Skeleton className="h-16 w-full" /> : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <Calendar className="text-purple-600 h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ticket médio</p>
                  <p className="text-2xl font-bold">{formatBrl(averageTicket)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Somente vendas pagas</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <WashingMachine className="h-4 w-4" />
            {groupBy === "machine" ? "Relatório por máquina" : "Relatório por período"}
          </CardTitle>
          <CardDescription>
            {groupBy === "machine"
              ? "Receita e ciclos de cada máquina no intervalo selecionado."
              : `Agrupamento ${groupBy === "daily" ? "diário" : groupBy === "weekly" ? "semanal (segunda a domingo)" : "mensal"} em ${salesPeriodCaption(range.start, range.end)}.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : reportRows.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum dado neste período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{groupBy === "machine" ? "Máquina" : "Período"}</TableHead>
                  {groupBy === "machine" && <TableHead>Tipo</TableHead>}
                  <TableHead className="text-right">Ciclos</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Ticket</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportRows.map((row) => {
                  const ticket = row.billableSales > 0 ? row.revenue / row.billableSales : 0;
                  const meta = row.machineType ? getMachineTypeMeta(row.machineType) : null;
                  return (
                    <TableRow key={row.key} className={row.sales === 0 ? "opacity-60" : undefined}>
                      <TableCell className="font-medium">
                        {row.label}
                        {row.manualCount > 0 && (
                          <span className="block text-xs text-muted-foreground">
                            {row.manualCount} lib. manual
                          </span>
                        )}
                      </TableCell>
                      {groupBy === "machine" && (
                        <TableCell>
                          {meta ? <Badge variant="outline">{meta.label}</Badge> : "—"}
                        </TableCell>
                      )}
                      <TableCell className="text-right">{row.sales}</TableCell>
                      <TableCell className="text-right font-semibold">{formatBrl(row.revenue)}</TableCell>
                      <TableCell className="text-right">{formatBrl(ticket)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movimentação do período</CardTitle>
          <CardDescription>
            {transactions.length} transação(ões) entre {brazilIsoDateLabel(range.start)} e {brazilIsoDateLabel(range.end)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : transactions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhuma transação neste período.</p>
          ) : (
            <div className="max-h-[28rem] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Máquina</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => {
                    const { date, time } = formatBrazilDateTime(tx.created_at);
                    const joined = machineFromJoin(tx.machines);
                    const machineName = machines.find((m) => m.id === tx.machine_id)?.name || joined.name;
                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="whitespace-nowrap text-sm">{date} {time}</TableCell>
                        <TableCell>{machineName}</TableCell>
                        <TableCell>
                          {isManualRelease(tx.payment_method) ? (
                            <Badge variant="outline" className="border-amber-500 text-amber-700">
                              Manual{tx.operator_name ? ` · ${tx.operator_name}` : ""}
                            </Badge>
                          ) : (
                            paymentLabel(tx.payment_method)
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatBrl(displayTransactionAmount(tx.total_amount))}
                          {isManualRelease(tx.payment_method) && (
                            <span className="block text-xs font-normal text-muted-foreground">sem receita</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
