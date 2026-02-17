import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Cpu, Clock, Wifi, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLaundry } from "@/contexts/LaundryContext";
import { useToast } from "@/hooks/use-toast";

interface PendingESP32 {
  id: string;
  esp32_id: string;
  device_name: string | null;
  ip_address: string | null;
  signal_strength: number | null;
  firmware_version: string | null;
  last_heartbeat: string | null;
  registration_status: string | null;
  created_at: string;
}

interface Machine {
  id: string;
  name: string;
  esp32_id: string | null;
}

export const ESP32PendingApproval = () => {
  const [pendingDevices, setPendingDevices] = useState<PendingESP32[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedMachines, setSelectedMachines] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const { currentLaundry } = useLaundry();
  const { toast } = useToast();

  const fetchPendingDevices = async () => {
    if (!currentLaundry?.id) return;

    const { data, error } = await supabase
      .from("esp32_status")
      .select("id, esp32_id, device_name, ip_address, signal_strength, firmware_version, last_heartbeat, registration_status, created_at")
      .eq("laundry_id", currentLaundry.id)
      .eq("registration_status", "pending");

    if (!error) setPendingDevices(data || []);
    setLoading(false);
  };

  const fetchMachines = async () => {
    if (!currentLaundry?.id) return;

    const { data } = await supabase
      .from("machines")
      .select("id, name, esp32_id")
      .eq("laundry_id", currentLaundry.id);

    setMachines(data || []);
  };

  useEffect(() => {
    fetchPendingDevices();
    fetchMachines();

    const channel = supabase
      .channel("pending-esp32-changes")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "esp32_status",
        filter: `laundry_id=eq.${currentLaundry?.id}`,
      }, () => {
        fetchPendingDevices();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentLaundry?.id]);

  const approveDevice = async (device: PendingESP32) => {
    const machineId = selectedMachines[device.esp32_id];
    
    // Aprovar o ESP32
    const { error: statusError } = await supabase
      .from("esp32_status")
      .update({ registration_status: "approved" })
      .eq("id", device.id);

    if (statusError) {
      toast({ title: "Erro", description: "Falha ao aprovar ESP32", variant: "destructive" });
      return;
    }

    // Se uma máquina foi selecionada, associar
    if (machineId) {
      const { error: machineError } = await supabase
        .from("machines")
        .update({ esp32_id: device.esp32_id })
        .eq("id", machineId);

      if (machineError) {
        toast({ title: "Aviso", description: "ESP32 aprovado mas falha ao associar máquina", variant: "destructive" });
        return;
      }
    }

    toast({
      title: "ESP32 Aprovado!",
      description: machineId 
        ? `${device.esp32_id} aprovado e associado à máquina`
        : `${device.esp32_id} aprovado (sem máquina associada)`,
    });

    fetchPendingDevices();
    fetchMachines();
  };

  const rejectDevice = async (device: PendingESP32) => {
    const { error } = await supabase
      .from("esp32_status")
      .update({ registration_status: "rejected" })
      .eq("id", device.id);

    if (error) {
      toast({ title: "Erro", description: "Falha ao rejeitar ESP32", variant: "destructive" });
      return;
    }

    toast({ title: "ESP32 Rejeitado", description: `${device.esp32_id} foi rejeitado` });
    fetchPendingDevices();
  };

  const unassignedMachines = machines.filter(m => !m.esp32_id);

  if (loading) return null;
  if (pendingDevices.length === 0) return null;

  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          ESP32s Pendentes de Aprovação
          <Badge variant="secondary" className="ml-2">{pendingDevices.length}</Badge>
        </CardTitle>
        <CardDescription>
          Novos ESP32s detectados que precisam ser aprovados e associados a máquinas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pendingDevices.map((device) => (
          <div key={device.id} className="flex flex-col gap-3 p-4 border rounded-lg bg-background">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-primary" />
                <span className="font-mono font-bold">{device.esp32_id}</span>
                {device.device_name && (
                  <Badge variant="outline">{device.device_name}</Badge>
                )}
              </div>
              <Badge variant="outline">
                <Clock className="h-3 w-3 mr-1" />
                Pendente
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-muted-foreground">
              <span>IP: {device.ip_address || "N/A"}</span>
              <span className="flex items-center gap-1">
                <Wifi className="h-3 w-3" />
                {device.signal_strength ? `${device.signal_strength} dBm` : "N/A"}
              </span>
              <span>FW: {device.firmware_version || "N/A"}</span>
              <span>
                {device.last_heartbeat 
                  ? new Date(device.last_heartbeat).toLocaleString("pt-BR")
                  : "Sem heartbeat"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={selectedMachines[device.esp32_id] || ""}
                onValueChange={(value) => setSelectedMachines(prev => ({ ...prev, [device.esp32_id]: value }))}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Associar a uma máquina (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {unassignedMachines.map((machine) => (
                    <SelectItem key={machine.id} value={machine.id}>
                      {machine.name}
                    </SelectItem>
                  ))}
                  {unassignedMachines.length === 0 && (
                    <SelectItem value="none" disabled>
                      Nenhuma máquina disponível
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>

              <Button size="sm" onClick={() => approveDevice(device)} className="gap-1">
                <CheckCircle2 className="h-4 w-4" />
                Aprovar
              </Button>
              <Button size="sm" variant="destructive" onClick={() => rejectDevice(device)} className="gap-1">
                <XCircle className="h-4 w-4" />
                Rejeitar
              </Button>
            </div>
          </div>
        ))}

        {unassignedMachines.length === 0 && pendingDevices.length > 0 && (
          <Alert>
            <AlertDescription>
              Todas as máquinas já possuem ESP32 associado. Cadastre novas máquinas antes de aprovar.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
