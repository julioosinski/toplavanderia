import { useCallback, useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, Cpu, Clock, Wifi, AlertTriangle, Armchair, Coffee, WashingMachine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLaundry } from "@/hooks/useLaundry";
import { useSystemSettings, type SystemSettings } from "@/hooks/useSystemSettings";
import { useToast } from "@/hooks/use-toast";
import {
  type Esp32ApprovalMachineType,
  ESP32_DB_TYPE_BY_FORM,
  ESP32_DEVICE_PROFILE_BY_TYPE,
  ESP32_MACHINE_TYPE_LABELS,
  inferEsp32DeviceType,
  suggestMachineName,
} from "@/lib/esp32DeviceType";

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
  type: Esp32ApprovalMachineType;
  relay_pin: number;
  price_per_cycle: number;
  cycle_time_minutes: number;
  capacity_kg: number;
}

const defaultForm = (
  settings: SystemSettings | null,
  type: Esp32ApprovalMachineType = "lavadora"
): MachineForm => {
  const base = {
    name: "",
    type,
    relay_pin: 2,
    price_per_cycle: settings?.default_price || 5,
    cycle_time_minutes: settings?.default_cycle_time || 40,
    capacity_kg: 10,
  };

  if (type === "massage") {
    return {
      ...base,
      price_per_cycle: 15,
      cycle_time_minutes: 15,
      capacity_kg: 0,
      relay_pin: 1,
    };
  }

  if (type === "coffee") {
    return {
      ...base,
      price_per_cycle: 6,
      cycle_time_minutes: 0,
      capacity_kg: 0,
      relay_pin: 1,
    };
  }

  if (type === "secadora") {
    return { ...base, capacity_kg: 15 };
  }

  return base;
};

const TypeIcon = ({ type }: { type: Esp32ApprovalMachineType }) => {
  switch (type) {
    case "massage":
      return <Armchair className="h-3.5 w-3.5" />;
    case "coffee":
      return <Coffee className="h-3.5 w-3.5" />;
    case "secadora":
      return <WashingMachine className="h-3.5 w-3.5" />;
    default:
      return <WashingMachine className="h-3.5 w-3.5" />;
  }
};

export const ESP32PendingApproval = () => {
  const [pendingDevices, setPendingDevices] = useState<PendingESP32[]>([]);
  const [forms, setForms] = useState<Record<string, MachineForm>>({});
  const [loading, setLoading] = useState(true);
  const { currentLaundry } = useLaundry();
  const currentLaundryId = currentLaundry?.id;
  const { settings } = useSystemSettings();
  const { toast } = useToast();

  const updateForm = (espId: string, updates: Partial<MachineForm>) => {
    setForms((prev) => ({
      ...prev,
      [espId]: { ...(prev[espId] || defaultForm(settings)), ...updates },
    }));
  };

  const handleTypeChange = (espId: string, type: Esp32ApprovalMachineType) => {
    const device = pendingDevices.find((d) => d.esp32_id === espId);
    const fresh = defaultForm(settings, type);
    updateForm(espId, {
      ...fresh,
      type,
      name: suggestMachineName(type, device?.device_name),
    });
  };

  const getForm = (espId: string, device?: PendingESP32): MachineForm => {
    if (forms[espId]) {
      return forms[espId];
    }
    const inferred = device ? inferEsp32DeviceType(device) : "lavadora";
    return {
      ...defaultForm(settings, inferred),
      name: suggestMachineName(inferred, device?.device_name),
    };
  };

  const fetchPendingDevices = useCallback(async () => {
    if (!currentLaundryId) return;

    const { data: pendingData } = await supabase
      .from("esp32_status")
      .select("id, esp32_id, device_name, ip_address, signal_strength, firmware_version, last_heartbeat, registration_status, created_at")
      .eq("laundry_id", currentLaundryId)
      .eq("registration_status", "pending");

    const { data: approvedData } = await supabase
      .from("esp32_status")
      .select("id, esp32_id, device_name, ip_address, signal_strength, firmware_version, last_heartbeat, registration_status, created_at")
      .eq("laundry_id", currentLaundryId)
      .eq("registration_status", "approved");

    const { data: machinesData } = await supabase
      .from("machines")
      .select("esp32_id")
      .eq("laundry_id", currentLaundryId);

    const machineEsp32Ids = new Set(machinesData?.map((m) => m.esp32_id) || []);
    const orphanedApproved = (approvedData || []).filter((d) => !machineEsp32Ids.has(d.esp32_id));
    const allDevices = [...(pendingData || []), ...orphanedApproved];

    setPendingDevices(allDevices);

    setForms((prev) => {
      const next = { ...prev };
      for (const device of allDevices) {
        if (!next[device.esp32_id]) {
          const inferred = inferEsp32DeviceType(device);
          next[device.esp32_id] = {
            ...defaultForm(settings, inferred),
            name: suggestMachineName(inferred, device.device_name),
          };
        }
      }
      return next;
    });

    setLoading(false);
  }, [currentLaundryId, settings]);

  useEffect(() => {
    fetchPendingDevices();
    const channel = supabase
      .channel("pending-esp32-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "esp32_status",
          filter: `laundry_id=eq.${currentLaundryId}`,
        },
        () => fetchPendingDevices()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentLaundryId, fetchPendingDevices]);

  const approveDevice = async (device: PendingESP32) => {
    const form = getForm(device.esp32_id, device);

    if (!form.name.trim()) {
      toast({ title: "Nome obrigatório", description: "Dê um nome para a máquina", variant: "destructive" });
      return;
    }

    const isRelayMachine = form.type === "lavadora" || form.type === "secadora";

    const machinePayload: Record<string, unknown> = {
      name: form.name.trim(),
      type: ESP32_DB_TYPE_BY_FORM[form.type],
      device_profile: ESP32_DEVICE_PROFILE_BY_TYPE[form.type],
      esp32_id: device.esp32_id,
      price_per_cycle: form.price_per_cycle,
      cycle_time_minutes: form.cycle_time_minutes,
      laundry_id: currentLaundry?.id,
      status: "available",
      relay_pin: isRelayMachine ? form.relay_pin : null,
      capacity_kg: isRelayMachine ? form.capacity_kg : 0,
    };

    const { error: machineError } = await supabase.from("machines").insert(machinePayload);

    if (machineError) {
      toast({ title: "Erro", description: `Falha ao criar máquina: ${machineError.message}`, variant: "destructive" });
      return;
    }

    const { error: statusError } = await supabase
      .from("esp32_status")
      .update({
        registration_status: "approved",
        device_name: form.name.trim(),
      })
      .eq("id", device.id);

    if (statusError) {
      toast({ title: "Aviso", description: "Máquina criada mas falha ao aprovar ESP32", variant: "destructive" });
      return;
    }

    toast({
      title: "ESP32 aprovado",
      description: `${form.name} (${ESP32_MACHINE_TYPE_LABELS[form.type]}) — ${device.esp32_id}`,
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
          <Badge variant="secondary" className="ml-2">
            {pendingDevices.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          Novos ESP32s detectados. O tipo é sugerido pelo firmware; confira e aprove para criar o equipamento
          (lavadoras, secadoras, poltrona ou café).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pendingDevices.map((device) => {
          const form = getForm(device.esp32_id, device);
          const inferred = inferEsp32DeviceType(device);
          const isRelayMachine = form.type === "lavadora" || form.type === "secadora";

          return (
            <div key={device.id} className="flex flex-col gap-3 p-4 border rounded-lg bg-background">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Cpu className="h-4 w-4 text-primary" />
                  <span className="font-mono font-bold">{device.esp32_id}</span>
                  <Badge variant="secondary" className="gap-1">
                    <TypeIcon type={inferred} />
                    Detectado: {ESP32_MACHINE_TYPE_LABELS[inferred]}
                  </Badge>
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

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t">
                <div className="col-span-2 md:col-span-1">
                  <Label className="text-xs">Nome do equipamento *</Label>
                  <Input
                    placeholder={
                      form.type === "massage"
                        ? "Poltrona de Massagem"
                        : form.type === "coffee"
                          ? "Máquina de Café"
                          : "Ex: Lavadora 01"
                    }
                    value={form.name}
                    onChange={(e) => updateForm(device.esp32_id, { name: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Tipo *</Label>
                  <Select value={form.type} onValueChange={(v) => handleTypeChange(device.esp32_id, v as Esp32ApprovalMachineType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lavadora">Lavadora</SelectItem>
                      <SelectItem value="secadora">Secadora</SelectItem>
                      <SelectItem value="massage">Poltrona de massagem</SelectItem>
                      <SelectItem value="coffee">Máquina de café</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {isRelayMachine && (
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
                )}

                <div>
                  <Label className="text-xs">Preço (R$)</Label>
                  <Input
                    type="number"
                    step="0.50"
                    value={form.price_per_cycle}
                    onChange={(e) => updateForm(device.esp32_id, { price_per_cycle: Number(e.target.value) })}
                  />
                </div>

                {form.type !== "coffee" && (
                  <div>
                    <Label className="text-xs">
                      {form.type === "massage" ? "Sessão (min)" : "Tempo (min)"}
                    </Label>
                    <Input
                      type="number"
                      value={form.cycle_time_minutes}
                      onChange={(e) => updateForm(device.esp32_id, { cycle_time_minutes: Number(e.target.value) })}
                    />
                  </div>
                )}

                {isRelayMachine && (
                  <div>
                    <Label className="text-xs">Capacidade (kg)</Label>
                    <Input
                      type="number"
                      value={form.capacity_kg}
                      onChange={(e) => updateForm(device.esp32_id, { capacity_kg: Number(e.target.value) })}
                    />
                  </div>
                )}
              </div>

              {!isRelayMachine && (
                <p className="text-xs text-muted-foreground">
                  {form.type === "massage"
                    ? "Poltrona: perfil timed_session — relé físico GPIO 26 no firmware; sem relay_pin no painel."
                    : "Café: perfil coin_dispense — pulsos no moedeiro; sem relé de lavagem."}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={() => approveDevice(device)} className="gap-1 flex-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Aprovar ({ESP32_MACHINE_TYPE_LABELS[form.type]})
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
