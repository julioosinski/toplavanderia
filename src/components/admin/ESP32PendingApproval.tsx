import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Cpu, Clock, Wifi, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLaundry } from "@/contexts/LaundryContext";
import { useSystemSettings } from "@/hooks/useSystemSettings";
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

interface MachineForm {
  name: string;
  type: string;
  relay_pin: number;
  price_per_cycle: number;
  cycle_time_minutes: number;
  capacity_kg: number;
}

const defaultForm = (settings: any): MachineForm => ({
  name: "",
  type: "washer",
  relay_pin: 2,
  price_per_cycle: settings?.default_price || 5,
  cycle_time_minutes: settings?.default_cycle_time || 40,
  capacity_kg: 10,
});

export const ESP32PendingApproval = () => {
  const [pendingDevices, setPendingDevices] = useState<PendingESP32[]>([]);
  const [forms, setForms] = useState<Record<string, MachineForm>>({});
  const [loading, setLoading] = useState(true);
  const { currentLaundry } = useLaundry();
  const { settings } = useSystemSettings();
  const { toast } = useToast();

  const updateForm = (espId: string, updates: Partial<MachineForm>) => {
    setForms(prev => ({
      ...prev,
      [espId]: { ...(prev[espId] || defaultForm(settings)), ...updates },
    }));
  };

  const getForm = (espId: string): MachineForm => forms[espId] || defaultForm(settings);

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

  useEffect(() => {
    fetchPendingDevices();
    const channel = supabase
      .channel("pending-esp32-changes")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "esp32_status",
        filter: `laundry_id=eq.${currentLaundry?.id}`,
      }, () => fetchPendingDevices())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentLaundry?.id]);

  const approveDevice = async (device: PendingESP32) => {
    const form = getForm(device.esp32_id);

    if (!form.name.trim()) {
      toast({ title: "Nome obrigatório", description: "Dê um nome para a máquina", variant: "destructive" });
      return;
    }

    // 1. Criar máquina automaticamente
    const { error: machineError } = await supabase
      .from("machines")
      .insert({
        name: form.name,
        type: form.type,
        esp32_id: device.esp32_id,
        relay_pin: form.relay_pin,
        price_per_cycle: form.price_per_cycle,
        cycle_time_minutes: form.cycle_time_minutes,
        capacity_kg: form.capacity_kg,
        laundry_id: currentLaundry?.id,
        status: "available",
      });

    if (machineError) {
      toast({ title: "Erro", description: `Falha ao criar máquina: ${machineError.message}`, variant: "destructive" });
      return;
    }

    // 2. Aprovar ESP32 e atualizar nome
    const { error: statusError } = await supabase
      .from("esp32_status")
      .update({
        registration_status: "approved",
        device_name: form.name,
      })
      .eq("id", device.id);

    if (statusError) {
      toast({ title: "Aviso", description: "Máquina criada mas falha ao aprovar ESP32", variant: "destructive" });
      return;
    }

    toast({
      title: "✅ ESP32 Aprovado!",
      description: `${form.name} (${device.esp32_id}) criada e pronta para uso`,
    });

    fetchPendingDevices();
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
          Novos ESP32s detectados. Preencha os dados e aprove para criar a máquina automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pendingDevices.map((device) => {
          const form = getForm(device.esp32_id);
          return (
            <div key={device.id} className="flex flex-col gap-3 p-4 border rounded-lg bg-background">
              {/* Header: ESP32 info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-primary" />
                  <span className="font-mono font-bold">{device.esp32_id}</span>
                </div>
                <Badge variant="outline">
                  <Clock className="h-3 w-3 mr-1" />
                  Pendente
                </Badge>
              </div>

              {/* Device details */}
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

              {/* Machine creation form */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t">
                <div className="col-span-2 md:col-span-1">
                  <Label className="text-xs">Nome da Máquina *</Label>
                  <Input
                    placeholder="Ex: Lavadora 01"
                    value={form.name}
                    onChange={(e) => updateForm(device.esp32_id, { name: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Tipo *</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => updateForm(device.esp32_id, { type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="washer">Lavadora</SelectItem>
                      <SelectItem value="dryer">Secadora</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Pino do Relé</Label>
                  <Select
                    value={String(form.relay_pin)}
                    onValueChange={(v) => updateForm(device.esp32_id, { relay_pin: Number(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">Pino 2</SelectItem>
                      <SelectItem value="4">Pino 4</SelectItem>
                      <SelectItem value="5">Pino 5</SelectItem>
                      <SelectItem value="18">Pino 18</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Preço (R$)</Label>
                  <Input
                    type="number"
                    step="0.50"
                    value={form.price_per_cycle}
                    onChange={(e) => updateForm(device.esp32_id, { price_per_cycle: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Tempo (min)</Label>
                  <Input
                    type="number"
                    value={form.cycle_time_minutes}
                    onChange={(e) => updateForm(device.esp32_id, { cycle_time_minutes: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Capacidade (kg)</Label>
                  <Input
                    type="number"
                    value={form.capacity_kg}
                    onChange={(e) => updateForm(device.esp32_id, { capacity_kg: Number(e.target.value) })}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={() => approveDevice(device)} className="gap-1 flex-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Aprovar e Criar Máquina
                </Button>
                <Button size="sm" variant="destructive" onClick={() => rejectDevice(device)} className="gap-1">
                  <XCircle className="h-4 w-4" />
                  Rejeitar
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
