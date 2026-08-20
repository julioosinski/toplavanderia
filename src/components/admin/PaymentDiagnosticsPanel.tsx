import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLaundry } from "@/hooks/useLaundry";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, CreditCard, RefreshCw, Zap } from "lucide-react";
import { formatBrazilDateTime } from "@/lib/brazilReportDates";
import type { PaymentDiagnosticRow } from "@/lib/payments/types";
import { useToast } from "@/hooks/use-toast";

function stateVariant(state: string): "default" | "secondary" | "destructive" | "outline" {
  if (state === "RELEASED" || state === "RECONCILED") return "default";
  if (state === "AUTHORIZED" || state === "RELEASE_PENDING") return "secondary";
  if (
    state === "RECONCILIATION_PENDING" ||
    state === "ERROR" ||
    state === "REVERSED"
  ) {
    return "destructive";
  }
  return "outline";
}

function formatAmount(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function PaymentDiagnosticsPanel() {
  const { currentLaundry } = useLaundry();
  const { toast } = useToast();
  const [rows, setRows] = useState<PaymentDiagnosticRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [releasingId, setReleasingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentLaundry?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("list_payment_diagnostics_admin", {
        _laundry_id: currentLaundry.id,
        _hours: 48,
        _limit: 80,
      });
      if (error) throw error;
      setRows((data ?? []) as PaymentDiagnosticRow[]);
    } catch (e) {
      console.error(e);
      toast({
        title: "Erro ao carregar diagnóstico",
        description: e instanceof Error ? e.message : "Falha desconhecida",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [currentLaundry?.id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleReenqueue = async (transactionId: string | null) => {
    if (!transactionId) return;
    setReleasingId(transactionId);
    try {
      const { data, error } = await supabase.rpc("enqueue_totem_machine_release", {
        _transaction_id: transactionId,
      });
      if (error) throw error;
      toast({
        title: "Liberação reenfileirada",
        description: data ? `Comando ${String(data).slice(0, 8)}…` : "Comando existente reutilizado",
      });
      await load();
    } catch (e) {
      toast({
        title: "Falha ao reenfileirar",
        description: e instanceof Error ? e.message : "Erro",
        variant: "destructive",
      });
    } finally {
      setReleasingId(null);
    }
  };

  const problemCount = rows.filter(
    (r) =>
      r.reconciliation_pending ||
      r.needs_refund ||
      (r.payment_authorized && r.session_state !== "RELEASED" && r.esp_command_status !== "completed")
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Sessões Cielo (Stone preparado) — últimas 48h
          </span>
          {problemCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {problemCount} atenção
            </Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Fluxo de pagamento</CardTitle>
          <CardDescription>
            Pagamentos autorizados sem liberação ESP aparecem aqui. Use reenfileirar sem nova cobrança.
            Pulso do relé permanece 1s (sem alteração de firmware).
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Máquina</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Sessão</TableHead>
                <TableHead>ESP</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {loading ? "Carregando…" : "Nenhuma sessão recente"}
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => {
                const needsAction =
                  row.payment_authorized &&
                  row.esp_command_status !== "completed" &&
                  !row.has_in_flight_command;
                return (
                  <TableRow key={row.session_id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatBrazilDateTime(row.created_at)}
                    </TableCell>
                    <TableCell className="text-sm">{row.machine_name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{formatAmount(row.amount_cents)}</TableCell>
                    <TableCell>
                      <Badge variant={stateVariant(row.session_state)}>{row.session_state}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.esp_command_status ?? "—"}
                      {row.has_in_flight_command && (
                        <span className="block text-amber-600">em voo</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs space-y-1">
                      {row.payment_authorized && (
                        <Badge variant="secondary" className="mr-1">pago</Badge>
                      )}
                      {row.needs_refund && (
                        <Badge variant="destructive" className="mr-1">estorno?</Badge>
                      )}
                      {row.reconciliation_pending && (
                        <Badge variant="outline">reconciliar</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {needsAction && row.transaction_id && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={releasingId === row.transaction_id}
                          onClick={() => handleReenqueue(row.transaction_id)}
                        >
                          <Zap className="h-3 w-3 mr-1" />
                          Reenfileirar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
