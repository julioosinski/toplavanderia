import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLaundry } from "@/contexts/LaundryContext";
import { Download, Settings, Copy, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const ESP32ConfigurationDialog = () => {
  const { currentLaundry } = useLaundry();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [esp32Id, setEsp32Id] = useState("");
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

    return `// ===== CONFIGURAÇÃO DO SISTEMA =====
// ⚠️ ATENÇÃO: Arquivo gerado automaticamente para ${currentLaundry?.name}
const char* ssid = "${wifiSsid}";
const char* password = "${wifiPassword}";

// IDs de identificação
const String LAUNDRY_ID = "${laundryId}";
const String ESP32_ID = "${esp32Id}";

// Supabase (NÃO MODIFICAR)
const String SUPABASE_URL = "https://rkdybjzwiwwqqzjfmerm.supabase.co";
const String SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZHlianp3aXd3cXF6amZtZXJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMDgxNjcsImV4cCI6MjA2ODg4NDE2N30.CnRP8lrmGmvcbHmWdy72ZWlfZ28cDdNoxdADnyFAOXg";

// ===== CONFIGURAÇÃO DE HARDWARE =====
const int RELAY_PIN = 16;
const int LED_PIN = 2;

// ===== VARIÁVEIS GLOBAIS =====
WebServer server(80);
unsigned long lastHeartbeat = 0;
const unsigned long heartbeatInterval = 30000;
bool relayState = false;
bool machineRunning = false;

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(LED_PIN, LOW);
  
  connectWiFi();
  setupRoutes();
  server.begin();
  sendHeartbeat();
}

void loop() {
  server.handleClient();
  
  if (millis() - lastHeartbeat >= heartbeatInterval) {
    lastHeartbeat = millis();
    sendHeartbeat();
  }
}

void connectWiFi() {
  Serial.println("🔌 Conectando ao WiFi...");
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\\n✅ WiFi conectado!");
    Serial.print("📡 IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\\n❌ Falha ao conectar WiFi");
  }
}

void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ WiFi desconectado. Tentando reconectar...");
    connectWiFi();
    return;
  }

  HTTPClient http;
  String url = SUPABASE_URL + "/functions/v1/esp32-monitor?action=heartbeat";
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", "Bearer " + SUPABASE_KEY);

  String payload = "{";
  payload += "\\"esp32_id\\":\\"" + ESP32_ID + "\\",";
  payload += "\\"laundry_id\\":\\"" + LAUNDRY_ID + "\\",";
  payload += "\\"ip_address\\":\\"" + WiFi.localIP().toString() + "\\",";
  payload += "\\"signal_strength\\":" + String(WiFi.RSSI()) + ",";
  payload += "\\"network_status\\":\\"connected\\",";
  payload += "\\"firmware_version\\":\\"v3.0.0\\","; // ⬆️ Versão atualizada
  payload += "\\"uptime_seconds\\":" + String(millis() / 1000) + ",";
  payload += "\\"is_active\\":" + String(machineRunning ? "true" : "false") + ",";
  
  // ✅ FORMATO CORRETO: relay_1, relay_2, relay_3...
  // Cada relay_pin das máquinas corresponde a um relay_X
  payload += "\\"relay_status\\":{";
  payload += "\\"relay_1\\":\\"" + String(relayState ? "on" : "off") + "\\",";
  payload += "\\"relay_2\\":\\"off\\""; // Adicione mais relés conforme necessário
  // payload += ",\\"relay_3\\":\\"off\\""; // Descomente para adicionar relay 3
  payload += "}";
  
  payload += "}";

  int httpCode = http.POST(payload);
  
  if (httpCode > 0) {
    Serial.println("✅ Heartbeat enviado! HTTP " + String(httpCode));
  } else {
    Serial.println("❌ Erro ao enviar heartbeat: " + String(httpCode));
  }
  
  http.end();
}

// Resto do código (setupRoutes, handlers, etc)...
`;
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
      description: "Código Arduino baixado com sucesso"
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
            Configure um novo ESP32 para esta lavanderia. O sistema gerará o código Arduino personalizado.
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
              placeholder="Ex: main, Cj01, Cj02, secondary"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Use um nome único para identificar este ESP32 (ex: main, Cj01, Cj02)
            </p>
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
                  {generateArduinoCode().substring(0, 800)}...
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