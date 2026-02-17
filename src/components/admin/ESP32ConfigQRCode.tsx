import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, Copy, Check, Download } from "lucide-react";
import { useLaundry } from "@/contexts/LaundryContext";
import { useToast } from "@/hooks/use-toast";
import QRCode from "qrcode";

export const ESP32ConfigQRCode = () => {
  const { currentLaundry } = useLaundry();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const configData = JSON.stringify({
    laundry_id: currentLaundry?.id || "",
    supabase_url: import.meta.env.VITE_SUPABASE_URL,
    api_key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  });

  useEffect(() => {
    if (canvasRef.current && currentLaundry?.id) {
      QRCode.toCanvas(canvasRef.current, configData, {
        width: 250,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });
    }
  }, [currentLaundry?.id, configData]);

  const copyConfig = async () => {
    await navigator.clipboard.writeText(configData);
    setCopied(true);
    toast({ title: "Copiado!", description: "Dados de configuração copiados" });
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQR = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `esp32-config-${currentLaundry?.name || "laundry"}.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  if (!currentLaundry?.id) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-primary" />
          QR Code de Configuração ESP32
        </CardTitle>
        <CardDescription>
          Escaneie este QR Code durante a configuração do ESP32 para preencher automaticamente o Laundry ID
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="border rounded-lg p-4 bg-white">
            <canvas ref={canvasRef} />
          </div>
          <div className="space-y-3 flex-1">
            <p className="text-sm text-muted-foreground">
              <strong>Como usar:</strong>
            </p>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Ligue o ESP32 (primeiro boot ou após reset)</li>
              <li>Conecte ao WiFi <code className="bg-muted px-1 rounded">TopLav_XXXXXX</code></li>
              <li>Acesse <code className="bg-muted px-1 rounded">192.168.4.1</code></li>
              <li>Cole o Laundry ID ou escaneie o QR Code</li>
              <li>O ESP32 se registrará automaticamente</li>
              <li>Aprove na seção "Pendentes" acima</li>
            </ol>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={copyConfig} className="gap-1">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copiado" : "Copiar Config"}
              </Button>
              <Button variant="outline" size="sm" onClick={downloadQR} className="gap-1">
                <Download className="h-4 w-4" />
                Baixar QR Code
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Laundry ID: <code className="bg-muted px-1 rounded text-xs">{currentLaundry?.id}</code>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
