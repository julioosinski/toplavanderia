import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useLaundry } from "@/contexts/LaundryContext";
import { Activity, AlertTriangle, CheckCircle, WifiOff, Zap } from "lucide-react";

interface ESP32Status {
  esp32_id: string;
  laundry_id: string;
  is_online: boolean;
  ip_address?: string;
  signal_strength?: number;
  last_heartbeat?: string;
  relay_status?: any;
}

interface Machine {
  id: string;
  name: string;
  esp32_id: string;
  relay_pin: number;
  status: string;
  laundry_id: string;
}

interface Laundry {
  id: string;
  name: string;
}

export default function ESP32Diagnostics() {
  const { currentLaundry } = useLaundry();
  const [esp32List, setEsp32List] = useState<ESP32Status[]>([]);
  const [machineList, setMachineList] = useState<Machine[]>([]);
  const [laundries, setLaundries] = useState<Laundry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    
    // Realtime
    const esp32Channel = supabase
      .channel('esp32-diagnostics')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'esp32_status' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'machines' }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(esp32Channel);
    };
  }, [currentLaundry]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Buscar todas as lavanderias
      const { data: laundriesData } = await supabase
        .from('laundries')
        .select('id, name')
        .eq('is_active', true);
      
      setLaundries(laundriesData || []);

      // Buscar todos ESP32s
      const { data: esp32Data } = await supabase
        .from('esp32_status')
        .select('*')
        .order('esp32_id');

      setEsp32List(esp32Data || []);

      // Buscar todas as máquinas
      const { data: machinesData } = await supabase
        .from('machines')
        .select('*')
        .order('name');

      setMachineList(machinesData || []);
    } catch (error) {
      console.error('Error fetching diagnostics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMachinesForESP32 = (esp32Id: string, laundryId: string) => {
    return machineList.filter(m => m.esp32_id === esp32Id && m.laundry_id === laundryId);
  };

  const getRelayConflicts = (esp32Id: string, laundryId: string) => {
    const machines = getMachinesForESP32(esp32Id, laundryId);
    const relayPins = machines.map(m => m.relay_pin);
    const duplicates = relayPins.filter((pin, index) => relayPins.indexOf(pin) !== index);
    return [...new Set(duplicates)];
  };

  const getLaundryName = (laundryId: string) => {
    return laundries.find(l => l.id === laundryId)?.name || laundryId.substring(0, 8);
  };

  const getTimeSinceHeartbeat = (lastHeartbeat?: string) => {
    if (!lastHeartbeat) return 'Nunca';
    const now = new Date();
    const last = new Date(lastHeartbeat);
    const diffMs = now.getTime() - last.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}min atrás`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h atrás`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d atrás`;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Diagnóstico ESP32</h1>
        <p className="text-muted-foreground">
          Visualização completa de todos os ESP32s e suas máquinas vinculadas
        </p>
      </div>

      {/* Resumo Geral */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Total ESP32s
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{esp32List.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              Online
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {esp32List.filter(e => e.is_online).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-600">
              <WifiOff className="h-4 w-4" />
              Offline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {esp32List.filter(e => !e.is_online).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Máquinas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{machineList.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de ESP32s */}
      <div className="space-y-4">
        {esp32List.map(esp32 => {
          const machines = getMachinesForESP32(esp32.esp32_id, esp32.laundry_id);
          const conflicts = getRelayConflicts(esp32.esp32_id, esp32.laundry_id);
          const hasConflicts = conflicts.length > 0;

          return (
            <Card key={`${esp32.esp32_id}-${esp32.laundry_id}`} className={hasConflicts ? "border-red-500" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <code className="text-lg">{esp32.esp32_id}</code>
                      <Badge variant={esp32.is_online ? "default" : "secondary"}>
                        {esp32.is_online ? "Online" : "Offline"}
                      </Badge>
                      <Badge variant="outline">{getLaundryName(esp32.laundry_id)}</Badge>
                      {hasConflicts && (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Conflito!
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-4 text-xs">
                      {esp32.ip_address && <span>IP: {esp32.ip_address}</span>}
                      {esp32.signal_strength && <span>Sinal: {esp32.signal_strength} dBm</span>}
                      <span>Último heartbeat: {getTimeSinceHeartbeat(esp32.last_heartbeat)}</span>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {hasConflicts && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                      ⚠️ Conflito de relay_pin detectado: Pins {conflicts.join(', ')} estão duplicados!
                    </p>
                  </div>
                )}

                {machines.length > 0 ? (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">
                      Máquinas Vinculadas ({machines.length}):
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {machines.map(machine => (
                        <div
                          key={machine.id}
                          className="flex items-center justify-between p-2 bg-muted/50 rounded border"
                        >
                          <div>
                            <p className="font-medium text-sm">{machine.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Relay Pin: {machine.relay_pin}
                            </p>
                          </div>
                          <Badge
                            variant={
                              machine.status === 'available'
                                ? 'default'
                                : machine.status === 'running'
                                ? 'secondary'
                                : 'outline'
                            }
                          >
                            {machine.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    ⚠️ Nenhuma máquina vinculada a este ESP32
                  </p>
                )}

                {/* Relay Status */}
                {esp32.relay_status && (
                  <div className="mt-4 p-3 bg-muted/30 rounded border">
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">Status dos Relés:</h4>
                    <code className="text-xs block">
                      {JSON.stringify(esp32.relay_status, null, 2)}
                    </code>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {esp32List.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <WifiOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum ESP32 encontrado</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
