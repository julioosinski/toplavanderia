import { MonitorSmartphone, WifiOff, AlertTriangle, CheckCircle2, CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTotemHeartbeats } from "@/hooks/useTotemHeartbeats";
import { formatSilentFor, type TotemHealth, type TotemStatus } from "@/lib/totemHeartbeat";

interface TotemStatusCardProps {
  /** Sem laundryId: todos os totens visíveis ao usuário (visão consolidada). */
  laundryId?: string;
  laundryNames?: Record<string, string>;
}

export function TotemStatusCard({ laundryId, laundryNames }: TotemStatusCardProps) {
  const { totems, staleCount, isLoading, hasError } = useTotemHeartbeats(laundryId);

  if (isLoading || hasError) return null;

  return (
    <Card
      className={staleCount > 0 ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/20" : undefined}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MonitorSmartphone className="h-5 w-5" aria-hidden="true" />
          Totem de pagamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {totems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum totem enviando sinal. Instale o APK 2.2.130 ou superior na LIO para monitorar se o
            totem está vendendo.
          </p>
        ) : (
          <ul className="space-y-2" aria-live="polite">
            {totems.map((totem) => (
              <TotemRow
                key={`${totem.laundry_id}:${totem.device_id}`}
                totem={totem}
                laundryName={laundryId ? undefined : laundryNames?.[totem.laundry_id]}
              />
            ))}
          </ul>
        )}
        {staleCount > 0 && (
          <p className="text-sm text-red-700 dark:text-red-300">
            Sem sinal há mais de 10 minutos: o totem não está vendendo. Verifique energia e internet da
            LIO e reabra o app do totem.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function TotemRow({ totem, laundryName }: { totem: TotemStatus; laundryName?: string }) {
  const meta = HEALTH_META[totem.health];
  const Icon = meta.icon;

  return (
    <li className="flex flex-col gap-1 rounded-md border bg-background/60 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${meta.iconClass}`} aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {laundryName ? `${laundryName} · ` : ""}
            {totem.device_model || "Totem"}
          </p>
          <p className="text-xs text-muted-foreground">
            Último sinal {formatSilentFor(totem.silentForMs)}
            {totem.app_version ? ` · APK ${totem.app_version}` : ""}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {totem.payment_in_progress && totem.health !== "stale" && (
          <Badge variant="outline" className="gap-1">
            <CreditCard className="h-3 w-3" aria-hidden="true" />
            Pagamento em andamento
          </Badge>
        )}
        <Badge variant="outline" className={meta.badgeClass}>
          {meta.label}
        </Badge>
      </div>
    </li>
  );
}

const HEALTH_META: Record<
  TotemHealth,
  { label: string; icon: typeof CheckCircle2; iconClass: string; badgeClass: string }
> = {
  online: {
    label: "Online",
    icon: CheckCircle2,
    iconClass: "text-green-600",
    badgeClass: "border-green-300 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300",
  },
  app_offline: {
    // O próprio sinal chegou: o app estava marcado offline e se corrige no envio seguinte.
    label: "Reconectando",
    icon: WifiOff,
    iconClass: "text-amber-600",
    badgeClass: "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
  },
  stale: {
    label: "Sem sinal",
    icon: AlertTriangle,
    iconClass: "text-red-600",
    badgeClass: "border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300",
  },
};
