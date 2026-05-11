import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLaundry } from "@/hooks/useLaundry";
import { LaundryGuard } from "@/components/admin/LaundryGuard";
import { Activity, AlertTriangle, CheckCircle, RefreshCw, WifiOff, Zap, Wifi, Clock } from "lucide-react";

interface ESP32Status {
  esp32_id: string;
  laundry_id: string;
  is_online: boolean | null;
  ip_address?: string | null;
  signal_strength?: number | null;
  firmware_version?: string | null;
  last_heartbeat?: string | null;
  relay_status?: Record<string, unknown> | string | null;
  registration_status?: string | null;
}

interface Machine {
  id: string;
  name: string;
  esp32_id: string;
  relay_pin: number;
  status: string;
  laundry_id: string;
}

type FilterMode = "all" | "online" | "offline";

const ONLINE_THRESHOLD_MIN = 3;

function isOnline(lastHeartbeat?: string | null): boolean {
  if (!lastHeartbeat) return false;
  return (Date.now() - new Date(lastHeartbeat).getTime()) / 60000 < ONLINE_THRESHOLD_MIN;
}

function timeSince(lastHeartbeat?: string | null): string {
  if (!lastHeartbeat) return "Nunca";
  const diffMs = Date.now() - new Date(lastHeartbeat).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function signalLabel(dbm?: number | null): { text: string; color: string } {
  if (dbm == null) return { text: "—", color: "text-muted-foreground" };
  if (dbm >= -50) return { text: "Excelente", color: "text-green-600" };
  if (dbm >= -65) return { text: "Bom", color: "text-green-600" };
  if (dbm >= -75) return { text: "Regular", color: "text-amber-600" };
  return { text: "Fraco", color: "text-red-600" };
}

function translateStatus(status: string): string {
  const map: Record<string, string> = {
    available: "Disponível",
    running: "Em uso",
    maintenance: "Manutenção",
    offline: "Offline",
    error: "Erro",
  };
  return map[status] || status;
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "available") return "default";
  if (status === "running") return "secondary";
  if (status === "maintenance" || status === "error") return "destructive";
  return "outline";
}

export default function ESP32Diagnostics() {
  const { currentLaundry } = useLaundry();
  const currentLaundryId = currentLaundry?.id;
  const [esp32List, setEsp32List] = useState<ESP32Status[]>([]);
  const [machineList, setMachineList] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterMode>("all");

  const fetchData = useCallback(async () => {
    if (!currentLaundryId) {
      setEsp32List([]);
      setMachineList([]);
      setLoading(false);
      return;
    }

    try {
      const [espRes, machRes] = await Promise.all([
        supabase
          .from("esp32_status")
          .select("esp32_id, laundry_id, is_online, ip_address, signal_strength, firmware_version, last_heartbeat, relay_status, registration_status")
          .eq("laundry_id", currentLaundryId)
          .order("esp32_id"),
        supabase
          .from("machines")
          .select("id, name, esp32_id, relay_pin, status, laundry_id")
          .eq("laundry_id", currentLaundryId)
          .order("name"),
      ]);

      setEsp32List((espRes.data || []) as ESP32Status[]);
      setMachineList((machRes.data || []) as Machine[]);
    } catch (error) {
      console.error("Error fetching diagnostics:", error);
    } finally {
      setLoading(false);
    }
  }, [currentLaundryId]);

  useEffect(() => {
    void fetchData();

    const channel = supabase
      .channel(`esp32-diag-${currentLaundryId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "esp32_status" }, () => void fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "machines" }, () => void fetchData())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchData, currentLaundryId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  // Mostrar apenas ESP32s vinculados a máquinas ou pendentes de aprovação
  const linkedEsp32Ids = new Set(machineList.map(m => m.esp32_id).filter(Boolean));
  const relevantEsp32 = esp32List.filter(
    e => linkedEsp32Ids.has(e.esp32_id) || e.registration_status === "pending"
  );

  const onlineCount = relevantEsp32.filter(e => isOnline(e.last_heartbeat)).length;
  const offlineCount = relevantEsp32.length - onlineCount;

  const filtered = relevantEsp32.filter(e => {
    if (filter === "online") return isOnline(e.last_heartbeat);
    if (filter === "offline") return !isOnline(e.last_heartbeat);
    return true;
  });

  const getMachinesForESP32 = (esp32Id: string) =>
    machineList.filter(m => m.esp32_id === esp32Id);

  const getRelayConflicts = (esp32Id: string) => {
    const pins = getMachinesForESP32(esp32Id).map(m => m.relay_pin);
    return [...new Set(pins.filter((p, i) => pins.indexOf(p) !== i))];
  };

  const renderRelayStatus = (relayStatus?: ESP32Status["relay_status"]) => {
    if (!relayStatus || typeof relayStatus !== "object") return null;
    const entries = Object.entries(relayStatus as Record<string, string>);
    if (entries.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1.5 mt-2">
        {entries.map(([key, val]) => (
          <Badge
            key={key}
            variant={val === "on" ? "default" : "outline"}
            className={val === "on" ? "bg-green-600 hover:bg-green-700" : ""}
          >
            {key}: {val === "on" ? "Ligado" : "Desligado"}
          </Badge>
        ))}
      </div>
    );
  };

  return (
    <LaundryGuard>
      {loading ? (
        <div className="space-y-6 animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-muted rounded-lg" />)}
          </div>
          <div className="h-48 bg-muted rounded-lg" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Diagnóstico ESP32</h1>
              <p className="text-muted-foreground text-sm">
                Monitoramento em tempo real — {currentLaundry?.name}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>

          {/* Resumo */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card
              className={`cursor-pointer transition-colors ${filter === "all" ? "ring-2 ring-primary" : ""}`}
              onClick={() => setFilter("all")}
            >
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Activity className="h-4 w-4" />
                    Total
                  </div>
                  <span className="text-2xl font-bold">{relevantEsp32.length}</span>
                </div>
              </CardContent>
            </Card>

            <Card
              className={`cursor-pointer transition-colors ${filter === "online" ? "ring-2 ring-green-500" : ""}`}
              onClick={() => setFilter("online")}
            >
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    Online
                  </div>
                  <span className="text-2xl font-bold text-green-600">{onlineCount}</span>
                </div>
              </CardContent>
            </Card>

            <Card
              className={`cursor-pointer transition-colors ${filter === "offline" ? "ring-2 ring-red-500" : ""}`}
              onClick={() => setFilter("offline")}
            >
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-red-600">
                    <WifiOff className="h-4 w-4" />
                    Offline
                  </div>
                  <span className="text-2xl font-bold text-red-600">{offlineCount}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Zap className="h-4 w-4" />
                    Máquinas
                  </div>
                  <span className="text-2xl font-bold">{machineList.length}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lista ESP32 */}
          <div className="space-y-3">
            {filtered.map(esp32 => {
              const online = isOnline(esp32.last_heartbeat);
              const machines = getMachinesForESP32(esp32.esp32_id);
              const conflicts = getRelayConflicts(esp32.esp32_id);
              const signal = signalLabel(esp32.signal_strength);

              return (
                <Card
                  key={`${esp32.esp32_id}-${esp32.laundry_id}`}
                  className={conflicts.length > 0 ? "border-red-500/50" : ""}
                >
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <code>{esp32.esp32_id}</code>
                        <Badge variant={online ? "default" : "secondary"} className={online ? "bg-green-600" : ""}>
                          {online ? "Online" : "Offline"}
                        </Badge>
                        {esp32.registration_status === "pending" && (
                          <Badge variant="outline" className="border-amber-500 text-amber-600">
                            Pendente
                          </Badge>
                        )}
                        {conflicts.length > 0 && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Conflito relay {conflicts.join(", ")}
                          </Badge>
                        )}
                      </CardTitle>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {esp32.firmware_version && (
                          <span className="font-mono">{esp32.firmware_version}</span>
                        )}
                        {online && esp32.ip_address && <span>{esp32.ip_address}</span>}
                        {online && esp32.signal_strength != null && (
                          <span className={`flex items-center gap-1 ${signal.color}`}>
                            <Wifi className="h-3 w-3" />
                            {esp32.signal_strength}dBm ({signal.text})
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {timeSince(esp32.last_heartbeat)}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {/* Relés — só mostrar quando online (dados em tempo real) */}
                    {online && renderRelayStatus(esp32.relay_status)}

                    {/* Máquinas vinculadas */}
                    {machines.length > 0 ? (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          Máquinas ({machines.length})
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {machines.map(m => (
                            <div key={m.id} className="flex items-center justify-between p-2 bg-muted/40 rounded-md border text-sm">
                              <div>
                                <span className="font-medium">{m.name}</span>
                                <span className="text-xs text-muted-foreground ml-2">relay {m.relay_pin}</span>
                              </div>
                              <Badge variant={statusVariant(m.status)} className="text-xs">
                                {translateStatus(m.status)}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">
                        Nenhuma máquina vinculada
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Estado vazio */}
          {filtered.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <WifiOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {relevantEsp32.length === 0
                    ? "Nenhum ESP32 vinculado a máquinas nesta lavanderia"
                    : `Nenhum ESP32 ${filter === "online" ? "online" : "offline"} no momento`}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </LaundryGuard>
  );
}
