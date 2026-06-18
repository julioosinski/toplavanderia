import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Cpu } from "lucide-react";
import { useLaundry } from "@/hooks/useLaundry";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useToast } from "@/hooks/use-toast";
import { buildEsp32LavadoraFirmware } from "@/lib/esp32FirmwareDownload";

export const ESP32ConfigQRCode = () => {
  const { currentLaundry } = useLaundry();
  const { settings } = useSystemSettings();
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [machineName, setMachineName] = useState("");
  const [relayPin, setRelayPin] = useState(1);
  const [cycleTime, setCycleTime] = useState(40);

  if (!currentLaundry?.id) return null;

  const generateFirmware = () => {
    setDownloading(true);

    const name = machineName.trim() || currentLaundry?.name || "Lavanderia";

    const firmware = buildEsp32LavadoraFirmware({
      wifiSsid: settings?.wifi_ssid || "",
      wifiPassword: settings?.wifi_password || "",
      laundryId: currentLaundry.id,
      machineName: name,
      relayLogicalPin: relayPin,
      cycleTimeMinutes: cycleTime,
    });

    const blob = new Blob([firmware], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ESP32_${currentLaundry.name?.replace(/\s+/g, "_") || "config"}_relay${relayPin}.ino`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Firmware gerado!",
      description: "Abra no Arduino IDE e faça upload para o ESP32.",
    });

    setDownloading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-primary" />
          Gerar Firmware ESP32
        </CardTitle>
        <CardDescription>
          O ESP32 gera seu ID automaticamente via MAC. Após upload, se não houver Wi-Fi salvo
          ou a rede mudar, ele abre o AP <strong>TopLavanderia-…</strong> (senha <code>toplav123</code>)
          com o painel &quot;Configurar Wi-Fi&quot; no celular.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fw-name">Nome da máquina (opcional)</Label>
            <Input
              id="fw-name"
              value={machineName}
              onChange={(e) => setMachineName(e.target.value)}
              placeholder={currentLaundry?.name || "Nome exibido no ESP"}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fw-relay">Pino do relé</Label>
              <Input
                id="fw-relay"
                type="number"
                min={1}
                max={16}
                value={relayPin}
                onChange={(e) => setRelayPin(Math.max(1, Math.min(16, Number(e.target.value) || 1)))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fw-cycle">Tempo de ciclo (min)</Label>
              <Input
                id="fw-cycle"
                type="number"
                min={1}
                max={120}
                value={cycleTime}
                onChange={(e) => setCycleTime(Math.max(1, Math.min(120, Number(e.target.value) || 40)))}
              />
            </div>
          </div>

          <Button
            onClick={generateFirmware}
            disabled={downloading}
            className="w-full gap-2"
          >
            <Download className="h-4 w-4" />
            Baixar Firmware (.ino)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
