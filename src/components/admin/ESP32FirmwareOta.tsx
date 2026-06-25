import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, RefreshCw, Cpu, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLaundry } from "@/hooks/useLaundry";
import { useToast } from "@/hooks/use-toast";

interface Esp32Device {
  esp32_id: string;
  device_name: string | null;
  firmware_version: string | null;
  last_heartbeat: string | null;
  registration_status: string | null;
}

interface OtaJob {
  id: string;
  esp32_id: string;
  firmware_version: string;
  status: string;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://rkdybjzwiwwqqzjfmerm.supabase.co";

const getAnonKey = () =>
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZHlianp3aXd3cXF6amZtZXJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMDgxNjcsImV4cCI6MjA2ODg4NDE2N30.CnRP8lrmGmvcbHmWdy72ZWlfZ28cDdNoxdADnyFAOXg";

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "completed") return "default";
  if (status === "failed" || status === "cancelled") return "destructive";
  if (status === "downloading" || status === "pending") return "secondary";
  return "outline";
};

export const ESP32FirmwareOta = () => {
  const { currentLaundry } = useLaundry();
  const { toast } = useToast();
  const laundryId = currentLaundry?.id;

  const [devices, setDevices] = useState<Esp32Device[]>([]);
  const [jobs, setJobs] = useState<OtaJob[]>([]);
  const [selectedEsp32Id, setSelectedEsp32Id] = useState("");
  const [firmwareVersion, setFirmwareVersion] = useState("v2.2.4");
  const [binFile, setBinFile] = useState<File | null>(null);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchDevices = useCallback(async () => {
    if (!laundryId) return;

    setLoadingDevices(true);
    const { data, error } = await supabase
      .from("esp32_status")
      .select("esp32_id, device_name, firmware_version, last_heartbeat, registration_status")
      .eq("laundry_id", laundryId)
      .eq("registration_status", "approved")
      .order("device_name");

    if (error) {
      toast({ title: "Erro ao listar ESP32", description: error.message, variant: "destructive" });
    } else {
      const list = data ?? [];
      setDevices(list);
      setSelectedEsp32Id((prev) => prev || list[0]?.esp32_id || "");
    }
    setLoadingDevices(false);
  }, [laundryId, toast]);

  const fetchJobs = useCallback(async () => {
    if (!laundryId) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const params = new URLSearchParams({ action: "list", laundry_id: laundryId });
    if (selectedEsp32Id) params.set("esp32_id", selectedEsp32Id);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/esp32-firmware-ota?${params}`, {
      headers: {
        apikey: getAnonKey(),
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) return;

    const payload = (await response.json()) as { success?: boolean; jobs?: OtaJob[] };
    if (payload.success && payload.jobs) {
      setJobs(payload.jobs);
    }
  }, [laundryId, selectedEsp32Id]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 15000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const scheduleOta = async () => {
    if (!laundryId || !selectedEsp32Id || !binFile) {
      toast({ title: "Preencha ESP32 e arquivo .bin", variant: "destructive" });
      return;
    }

    const version = firmwareVersion.trim();
    if (!/^v?\d+\.\d+\.\d+$/i.test(version)) {
      toast({
        title: "Versão inválida",
        description: "Use o formato v2.2.4",
        variant: "destructive",
      });
      return;
    }

    const normalizedVersion = version.startsWith("v") ? version : `v${version}`;
    const storagePath = `${laundryId}/${selectedEsp32Id}/${normalizedVersion}.bin`;

    setUploading(true);
    try {
      const checksum = await sha256Hex(binFile);

      const { error: uploadError } = await supabase.storage
        .from("esp32-firmware")
        .upload(storagePath, binFile, {
          upsert: true,
          contentType: "application/octet-stream",
        });

      if (uploadError) throw uploadError;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão expirada — faça login novamente");

      const response = await fetch(`${SUPABASE_URL}/functions/v1/esp32-firmware-ota?action=schedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: getAnonKey(),
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          laundry_id: laundryId,
          esp32_id: selectedEsp32Id,
          firmware_version: normalizedVersion,
          storage_path: storagePath,
          file_size: binFile.size,
          checksum_sha256: checksum,
        }),
      });

      const payload = (await response.json()) as { success?: boolean; error?: string; message?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? `HTTP ${response.status}`);
      }

      toast({
        title: "OTA enfileirada",
        description: payload.message ?? "O ESP32 aplicará em até ~30 s se estiver online.",
      });

      setBinFile(null);
      await fetchJobs();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha no upload OTA";
      toast({ title: "Erro OTA", description: message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (!laundryId) return null;

  const selectedDevice = devices.find((d) => d.esp32_id === selectedEsp32Id);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          Atualização OTA (Wi-Fi)
        </CardTitle>
        <CardDescription>
          O admin gera o <strong>código-fonte</strong> (<code>.ino</code>); o OTA exige o{' '}
          <strong>binário compilado</strong> (<code>.bin</code>) — veja o passo a passo abaixo.
          A primeira instalação com suporte OTA ainda exige upload USB (lavadoras v2.2.4+, café/poltrona v1.1.0+).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="space-y-2">
            <p>
              <strong>Do .ino ao .bin (Arduino IDE):</strong>
            </p>
            <ol className="list-decimal ml-4 space-y-1 text-sm">
              <li>Baixe o firmware em Firmware Café / Poltrona / Máquinas (arquivo <code>.ino</code>).</li>
              <li>
                Abra no Arduino IDE (poltrona: placa ESP32 + partition <strong>Huge APP 3MB</strong>).
              </li>
              <li>
                Menu <strong>Sketch → Export compiled Binary</strong> (ou Ctrl+Alt+S) — gera{' '}
                <code>sketch.ino.bin</code> na pasta do sketch.
              </li>
              <li>
                Anexe esse <code>.bin</code> aqui embaixo, informe a versão (ex.:{' '}
                <code>v1.1.0-toplav-poltrona</code>) e agende o OTA.
              </li>
            </ol>
            <p className="text-xs text-muted-foreground pt-1">
              O Supabase não compila <code>.ino</code> no servidor — só distribui o <code>.bin</code> já
              compilado. O ESP verifica atualizações a cada ~5 minutos quando online.
            </p>
          </AlertDescription>
        </Alert>

        {loadingDevices ? (
          <p className="text-sm text-muted-foreground">Carregando ESP32 aprovados...</p>
        ) : devices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum ESP32 aprovado nesta lavanderia. Aprove um dispositivo antes de agendar OTA.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Dispositivo ESP32</Label>
              <Select value={selectedEsp32Id} onValueChange={setSelectedEsp32Id}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o ESP32" />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((d) => (
                    <SelectItem key={d.esp32_id} value={d.esp32_id}>
                      <span className="flex items-center gap-2">
                        <Cpu className="h-3 w-3" />
                        {d.device_name || d.esp32_id}
                        {d.firmware_version ? ` (${d.firmware_version})` : ""}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedDevice?.last_heartbeat && (
                <p className="text-xs text-muted-foreground">
                  Último heartbeat: {new Date(selectedDevice.last_heartbeat).toLocaleString("pt-BR")}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ota-version">Versão do firmware</Label>
                <Input
                  id="ota-version"
                  value={firmwareVersion}
                  onChange={(e) => setFirmwareVersion(e.target.value)}
                  placeholder="v2.2.4"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ota-bin">Arquivo .bin</Label>
                <Input
                  id="ota-bin"
                  type="file"
                  accept=".bin,application/octet-stream"
                  onChange={(e) => setBinFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            <Button
              onClick={scheduleOta}
              disabled={uploading || !binFile || !selectedEsp32Id}
              className="w-full gap-2"
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Enviando..." : "Enviar e agendar OTA"}
            </Button>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Histórico OTA (últimos 20)</h4>
            <Button variant="ghost" size="sm" onClick={fetchJobs} className="gap-1">
              <RefreshCw className="h-3 w-3" />
              Atualizar
            </Button>
          </div>

          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum job OTA registrado.</p>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
                >
                  <div>
                    <span className="font-mono text-xs">{job.esp32_id}</span>
                    <span className="mx-2 text-muted-foreground">→</span>
                    <span>{job.firmware_version}</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(job.created_at).toLocaleString("pt-BR")}
                      {job.error_message ? ` — ${job.error_message}` : ""}
                    </p>
                  </div>
                  <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
