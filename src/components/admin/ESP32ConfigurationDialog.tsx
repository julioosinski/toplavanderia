import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLaundry } from "@/hooks/useLaundry";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { Download, Settings, Copy, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { buildEsp32LavadoraFirmware } from "@/lib/esp32FirmwareDownload";

export const ESP32ConfigurationDialog = () => {
  const { currentLaundry } = useLaundry();
  const { settings } = useSystemSettings();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [machineName, setMachineName] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedLaundryId, setCopiedLaundryId] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  /** Índice relay_N igual ao campo relay_pin da máquina no cadastro */
  const [relayLogicalPin, setRelayLogicalPin] = useState(1);
  /** Igual a cycle_time_minutes da máquina */
  const [cycleTimeMinutes, setCycleTimeMinutes] = useState(40);

  const wifiSsid = settings?.wifi_ssid || "";
  const wifiPassword = settings?.wifi_password || "";
  const laundryId = currentLaundry?.id || "";

  const generateArduinoCode = () => {
    if (!laundryId) {
      toast({
        title: "Erro",
        description: "Lavanderia não selecionada",
        variant: "destructive"
      });
      return "";
    }

    const name =
      machineName.trim() ||
      `${currentLaundry?.name ?? "Lavanderia"}`;

    return buildEsp32LavadoraFirmware({
      wifiSsid,
      wifiPassword,
      laundryId,
      esp32Id: "__AUTO_MAC__",
      machineName: name,
      relayLogicalPin,
      cycleTimeMinutes,
    });
  };

  const handleDownload = () => {
    const code = generateArduinoCode();
    if (!code) return;

    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ESP32_${currentLaundry?.name || 'config'}_relay${relayLogicalPin}.ino`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Arquivo gerado!",
      description: "Firmware v2.1.3 (ID auto via MAC, auto-registro, portal cativo DNS) — compile no Arduino IDE e use em qualquer ESP32"
    });
  };

  const handleCopyConfig = () => {
    const config = `Lavanderia: ${currentLaundry?.name}\nID: ${laundryId}\nESP32 ID: gerado automaticamente via MAC`;
    navigator.clipboard.writeText(config);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    
    toast({
      title: "Copiado!",
      description: "Configuração copiada para área de transferência"
    });
  };

  const handleCopyLaundryId = () => {
    navigator.clipboard.writeText(laundryId);
    setCopiedLaundryId(true);
    setTimeout(() => setCopiedLaundryId(false), 2000);
    
    toast({
      title: "ID Copiado!",
      description: "LAUNDRY_ID copiado para área de transferência"
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Settings className="mr-2 h-4 w-4" />
          Configurar ESP32
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Gerar Firmware ESP32</DialogTitle>
          <DialogDescription>
            Firmware v2.1.3: cada ESP32 gera seu ID automaticamente via MAC Address.
            O mesmo arquivo .ino funciona em qualquer placa — basta fazer upload e o ESP aparecerá para aprovação no painel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lavanderia:</span>
                  <span className="font-medium">{currentLaundry?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">WiFi SSID:</span>
                  <span className="font-medium">{wifiSsid || "Configurado no proprio ESP32 (AP)"}</span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Laundry ID:</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-auto py-1 px-2"
                      onClick={handleCopyLaundryId}
                    >
                      {copiedLaundryId ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  <code className="block text-xs font-mono bg-background p-2 rounded border break-all">
                    {laundryId}
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Label htmlFor="machine_name">Nome amigável (opcional)</Label>
            <Input
              id="machine_name"
              value={machineName}
              onChange={(e) => setMachineName(e.target.value)}
              placeholder={`Deixe em branco para: "${currentLaundry?.name ?? 'Lavanderia'} — [ID]"`}
              className="font-mono text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="relay_pin">Relay no painel (relay_pin)</Label>
              <Input
                id="relay_pin"
                type="number"
                min={1}
                max={16}
                value={relayLogicalPin}
                onChange={(e) => setRelayLogicalPin(Math.max(1, Math.min(16, Number(e.target.value) || 1)))}
              />
              <p className="text-xs text-muted-foreground">Deve ser o mesmo número da máquina em Máquinas → relay_pin.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cycle_min">Tempo de ciclo (min)</Label>
              <Input
                id="cycle_min"
                type="number"
                min={1}
                max={1440}
                value={cycleTimeMinutes}
                onChange={(e) => setCycleTimeMinutes(Math.max(1, Math.min(1440, Number(e.target.value) || 40)))}
              />
              <p className="text-xs text-muted-foreground">Igual a cycle_time_minutes; o ESP desliga o relé ao fim.</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={() => setShowPreview(!showPreview)} 
              variant="outline" 
              className="flex-1"
              disabled={!laundryId}
            >
              {showPreview ? "Ocultar" : "Ver"} Preview
            </Button>
            <Button 
              onClick={handleDownload}
              className="flex-1"
              disabled={!laundryId}
            >
              <Download className="mr-2 h-4 w-4" />
              Baixar .ino
            </Button>
          </div>

          {showPreview && laundryId && (
            <Card className="bg-muted/30">
              <CardContent className="pt-4">
                <pre className="text-xs overflow-x-auto p-2 bg-background rounded border max-h-64 overflow-y-auto">
                  {generateArduinoCode().substring(0, 1200)}...
                </pre>
              </CardContent>
            </Card>
          )}

          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 space-y-2">
            <p className="text-sm text-amber-600 dark:text-amber-400">
              <strong>Como funciona:</strong>
            </p>
            <ul className="text-xs text-amber-600 dark:text-amber-400 space-y-1 ml-4">
              <li>• O mesmo .ino funciona em qualquer ESP32 — o ID é gerado pelo MAC</li>
              <li>• No primeiro boot, o ESP abre rede própria para configurar Wi-Fi</li>
              <li>• Após conectar, o ESP aparece em "Pendentes de Aprovação" no painel</li>
              <li>• Credenciais ficam salvas e voltam após queda de energia</li>
              <li>• Cada máquina usa um relay_pin diferente (1, 2, 3...)</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
