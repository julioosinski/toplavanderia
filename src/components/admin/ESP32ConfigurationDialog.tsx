import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLaundry } from "@/contexts/LaundryContext";
import { Download, Settings, Copy, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { buildEsp32LavadoraFirmware } from "@/lib/esp32FirmwareDownload";

export const ESP32ConfigurationDialog = () => {
  const { currentLaundry } = useLaundry();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [esp32Id, setEsp32Id] = useState("");
  const [machineName, setMachineName] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedLaundryId, setCopiedLaundryId] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const wifiSsid = "2G Osinski";
  const wifiPassword = "10203040";
  const laundryId = currentLaundry?.id || "";

  const generateArduinoCode = () => {
    if (!esp32Id || !laundryId) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o ID do ESP32",
        variant: "destructive"
      });
      return "";
    }

    const name =
      machineName.trim() ||
      `${currentLaundry?.name ?? "Lavanderia"} — ${esp32Id}`;

    return buildEsp32LavadoraFirmware({
      wifiSsid,
      wifiPassword,
      laundryId,
      esp32Id,
      machineName: name,
    });
  };

  const handleDownload = () => {
    const code = generateArduinoCode();
    if (!code) return;

    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ESP32_${esp32Id}_${currentLaundry?.name || 'config'}.ino`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Arquivo gerado!",
      description: "Firmware v2.0.5 (heartbeat + fila pending_commands) — compile no Arduino IDE"
    });
  };

  const handleCopyConfig = () => {
    const config = `WiFi: ${wifiSsid}\nLavanderia: ${currentLaundry?.name}\nID: ${laundryId}\nESP32: ${esp32Id}`;
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
          <DialogTitle>Gerar Configuração ESP32</DialogTitle>
          <DialogDescription>
            Baixa o firmware alinhado ao repositório (v2.0.5): heartbeat, servidor local e
            <strong> polling da fila Supabase</strong> (pagamento no totem via <code className="text-xs">pending_commands</code>).
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
                  <span className="font-medium">{wifiSsid}</span>
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
            <Label htmlFor="esp32_id">ID do ESP32 *</Label>
            <Input
              id="esp32_id"
              value={esp32Id}
              onChange={(e) => setEsp32Id(e.target.value)}
              placeholder="Ex: main, Cj01, Cj02, lavadora_01"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Deve ser <strong>exatamente</strong> o mesmo valor do campo <code className="text-xs">esp32_id</code> da máquina no Supabase.
            </p>
          </div>

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

          <div className="flex gap-2">
            <Button 
              onClick={() => setShowPreview(!showPreview)} 
              variant="outline" 
              className="flex-1"
              disabled={!esp32Id}
            >
              {showPreview ? "Ocultar" : "Ver"} Preview
            </Button>
            <Button 
              onClick={handleDownload}
              className="flex-1"
              disabled={!esp32Id}
            >
              <Download className="mr-2 h-4 w-4" />
              Baixar .ino
            </Button>
          </div>

          {showPreview && esp32Id && (
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
              <strong>⚠️ Configuração Física:</strong>
            </p>
            <ul className="text-xs text-amber-600 dark:text-amber-400 space-y-1 ml-4">
              <li>• Um ESP32 pode controlar múltiplas máquinas</li>
              <li>• Cada máquina usa um relay_pin diferente (1, 2, 3...)</li>
              <li>• ESP32 → Relay 1 → Máquina 1</li>
              <li>• ESP32 → Relay 2 → Máquina 2</li>
              <li>• Nunca use o mesmo relay_pin para duas máquinas!</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
