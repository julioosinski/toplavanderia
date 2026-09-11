import { useMemo, useState, type ReactNode } from "react";
import { Circle, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export interface MachineMobileCardItem {
  id: string;
  name: string;
  type: string;
  status: string;
  realStatus?: string;
  esp32_id?: string | null;
  relay_pin?: number | null;
  cycle_time_minutes?: number | null;
  price_per_cycle: number;
  esp32_online?: boolean;
}

interface MachineMobileCardsProps<T extends MachineMobileCardItem> {
  machines: T[];
  renderActions: (machine: T) => ReactNode;
}

const TYPE_LABELS: Record<string, string> = {
  lavadora: "Lavadora",
  washing: "Lavadora",
  secadora: "Secadora",
  drying: "Secadora",
  massage: "Poltrona",
  coffee: "Café",
};

function statusConfig(status: string) {
  if (status === "offline") {
    return {
      variant: "destructive" as const,
      label: "Offline",
      icon: <Circle className="h-3 w-3 fill-destructive" />,
    };
  }
  if (status === "in_use" || status === "running") {
    return {
      variant: "default" as const,
      label: "Em Serviço",
      icon: <Circle className="h-3 w-3 fill-primary animate-pulse" />,
    };
  }
  if (status === "maintenance") {
    return {
      variant: "outline" as const,
      label: "Manutenção",
      icon: <Circle className="h-3 w-3 fill-yellow-500" />,
    };
  }
  return {
    variant: "secondary" as const,
    label: "Disponível",
    icon: <Circle className="h-3 w-3 fill-green-500" />,
  };
}

export function MachineMobileCards<T extends MachineMobileCardItem>({
  machines,
  renderActions,
}: MachineMobileCardsProps<T>) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return machines;
    return machines.filter((m) => m.name.toLowerCase().includes(q));
  }, [machines, query]);

  return (
    <div className="space-y-3 lg:hidden">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome..."
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhuma máquina encontrada.
        </p>
      ) : (
        filtered.map((machine) => {
          const status = machine.realStatus || machine.status;
          const config = statusConfig(status);
          const price = Number(machine.price_per_cycle);
          return (
            <Card key={machine.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{machine.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {TYPE_LABELS[machine.type] ?? machine.type}
                      {machine.cycle_time_minutes
                        ? ` · ${machine.cycle_time_minutes} min`
                        : ""}
                      {Number.isFinite(price) ? ` · R$ ${price.toFixed(2)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {config.icon}
                    <Badge variant={config.variant} className="whitespace-nowrap">
                      {config.label}
                    </Badge>
                  </div>
                </div>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {machine.esp32_id || "Sem ESP32"}
                  {machine.relay_pin != null ? ` · relé ${machine.relay_pin}` : ""}
                  {machine.esp32_online ? " · online" : " · offline"}
                </p>
                <div className="grid grid-cols-2 gap-2">{renderActions(machine)}</div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
