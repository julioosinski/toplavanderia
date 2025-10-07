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

    return `/**
 * ESP32 Lavadora Individual - Sistema de Controle
 * Versão: 3.0.0 - Gerado automaticamente
 * 
 * Lavanderia: ${currentLaundry?.name}
 * ESP32 ID: ${esp32Id}
 * Gerado em: ${new Date().toLocaleString('pt-BR')}
 */

#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ================== CONFIGURAÇÕES WIFI ==================
const char* ssid = "${wifiSsid}";
const char* password = "${wifiPassword}";

// ================== IDENTIFICAÇÃO ==================
#define LAUNDRY_ID "${laundryId}"
#define ESP32_ID "${esp32Id}"
#define MACHINE_NAME "ESP32 ${esp32Id}"

// ================== CONFIGURAÇÕES SUPABASE ==================
const char* supabaseUrl = "https://rkdybjzwiwwqqzjfmerm.supabase.co";
const char* supabaseApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZHlianp3aXd3cXF6amZtZXJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMDgxNjcsImV4cCI6MjA2ODg4NDE2N30.CnRP8lrmGmvcbHmWdy72ZWlfZ28cDdNoxdADnyFAOXg";

// ================== CONFIGURAÇÕES HARDWARE ==================
#define RELAY_PIN 2                // Pino do relé (GPIO2)
#define LED_PIN 2                  // LED embutido (GPIO2)

// ================== VARIÁVEIS DE CONTROLE ==================
WebServer server(80);
unsigned long lastHeartbeat = 0;
const unsigned long HEARTBEAT_INTERVAL = 30000;  // 30 segundos
bool relayState = false;
unsigned long machineStartTime = 0;
bool machineRunning = false;

void setup() {
  Serial.begin(115200);
  Serial.println("\\n\\n========================================");
  Serial.println("ESP32 ${esp32Id} - ${currentLaundry?.name}");
  Serial.println("========================================");
  
  // Configurar hardware
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(LED_PIN, LOW);
  
  // Conectar WiFi
  connectWiFi();
  
  // Configurar rotas HTTP
  setupRoutes();
  
  // Iniciar servidor
  server.begin();
  Serial.println("🌐 Servidor web iniciado na porta 80");
  Serial.println("========================================\\n");
  
  // Enviar primeiro heartbeat
  sendHeartbeat();
}

void loop() {
  server.handleClient();
  
  // Enviar heartbeat periódico
  if (millis() - lastHeartbeat > HEARTBEAT_INTERVAL) {
    sendHeartbeat();
  }
  
  delay(10);
}

// ================== CONEXÃO WIFI ==================
void connectWiFi() {
  Serial.println("📡 Conectando ao WiFi...");
  Serial.printf("   SSID: %s\\n", ssid);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\\n✅ WiFi conectado com sucesso!");
    Serial.printf("   IP: %s\\n", WiFi.localIP().toString().c_str());
    Serial.printf("   Sinal: %d dBm\\n", WiFi.RSSI());
  } else {
    Serial.println("\\n❌ Falha ao conectar WiFi!");
    Serial.println("   Verifique SSID e senha");
  }
}

// ================== ROTAS HTTP ==================
void setupRoutes() {
  server.on("/", HTTP_GET, handleRoot);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/start", HTTP_POST, handleStart);
  server.on("/stop", HTTP_POST, handleStop);
  server.onNotFound(handleNotFound);
}

void handleRoot() {
  String html = "<!DOCTYPE html><html><head><meta charset='UTF-8'>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1.0'>";
  html += "<title>ESP32 - " + String(MACHINE_NAME) + "</title>";
  html += "<style>body{font-family:Arial;margin:20px;background:#f0f0f0}";
  html += ".container{background:white;padding:20px;border-radius:10px;box-shadow:0 2px 5px rgba(0,0,0,0.1)}";
  html += "h1{color:#333;border-bottom:2px solid #4CAF50;padding-bottom:10px}";
  html += ".status{display:flex;justify-content:space-between;margin:15px 0;padding:10px;background:#f9f9f9;border-radius:5px}";
  html += ".label{font-weight:bold;color:#666}.value{color:#333}";
  html += ".online{color:#4CAF50;font-weight:bold}.offline{color:#f44336;font-weight:bold}";
  html += "button{background:#4CAF50;color:white;border:none;padding:12px 24px;border-radius:5px;cursor:pointer;font-size:16px;margin:5px}";
  html += "button:hover{background:#45a049}button.stop{background:#f44336}button.stop:hover{background:#da190b}</style></head><body>";
  html += "<div class='container'><h1>🔧 " + String(MACHINE_NAME) + "</h1>";
  html += "<div class='status'><span class='label'>ESP32 ID:</span><span class='value'>" + String(ESP32_ID) + "</span></div>";
  html += "<div class='status'><span class='label'>Lavanderia:</span><span class='value'>" + String(LAUNDRY_ID) + "</span></div>";
  html += "<div class='status'><span class='label'>IP:</span><span class='value'>" + WiFi.localIP().toString() + "</span></div>";
  html += "<div class='status'><span class='label'>Sinal WiFi:</span><span class='value'>" + String(WiFi.RSSI()) + " dBm</span></div>";
  html += "<div class='status'><span class='label'>Status:</span><span class='value ";
  html += machineRunning ? "online'>▶️ RODANDO" : "offline'>⏹️ PARADA";
  html += "</span></div>";
  html += "<div class='status'><span class='label'>Relé:</span><span class='value'>" + String(relayState ? "LIGADO ✅" : "DESLIGADO ⭕") + "</span></div>";
  html += "<div style='margin-top:20px'>";
  html += "<button onclick=\\"fetch('/start',{method:'POST'}).then(()=>location.reload())\\">▶️ Iniciar</button>";
  html += "<button class='stop' onclick=\\"fetch('/stop',{method:'POST'}).then(()=>location.reload())\\">⏹️ Parar</button>";
  html += "</div></div></body></html>";
  
  server.send(200, "text/html", html);
}

void handleStatus() {
  StaticJsonDocument<512> doc;
  doc["esp32_id"] = ESP32_ID;
  doc["laundry_id"] = LAUNDRY_ID;
  doc["ip_address"] = WiFi.localIP().toString();
  doc["signal_strength"] = WiFi.RSSI();
  doc["network_status"] = "connected";
  doc["firmware_version"] = "v3.0.0";
  doc["uptime_seconds"] = millis() / 1000;
  doc["is_active"] = machineRunning;
  doc["relay_status"] = relayState ? "on" : "off";
  
  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
  
  Serial.println("📊 Status requisitado via HTTP");
}

void handleStart() {
  Serial.println("▶️ Comando START recebido");
  relayState = true;
  machineRunning = true;
  machineStartTime = millis();
  digitalWrite(RELAY_PIN, HIGH);
  digitalWrite(LED_PIN, HIGH);
  
  server.send(200, "application/json", "{\\"success\\":true,\\"message\\":\\"Máquina iniciada\\"}");
  Serial.println("✅ Máquina iniciada com sucesso");
  sendHeartbeat();  // Enviar status atualizado imediatamente
}

void handleStop() {
  Serial.println("⏹️ Comando STOP recebido");
  relayState = false;
  machineRunning = false;
  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(LED_PIN, LOW);
  
  server.send(200, "application/json", "{\\"success\\":true,\\"message\\":\\"Máquina parada\\"}");
  Serial.println("✅ Máquina parada com sucesso");
  sendHeartbeat();  // Enviar status atualizado imediatamente
}

void handleNotFound() {
  server.send(404, "application/json", "{\\"error\\":\\"Rota não encontrada\\"}");
}

// ================== HEARTBEAT ==================
void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ WiFi desconectado, tentando reconectar...");
    connectWiFi();
    return;
  }
  
  HTTPClient http;
  String url = String(supabaseUrl) + "/functions/v1/esp32-monitor?action=heartbeat";
  
  Serial.println("\\n📡 Enviando heartbeat...");
  
  // Preparar JSON
  StaticJsonDocument<512> doc;
  doc["esp32_id"] = ESP32_ID;
  doc["laundry_id"] = LAUNDRY_ID;
  doc["ip_address"] = WiFi.localIP().toString();
  doc["signal_strength"] = WiFi.RSSI();
  doc["network_status"] = "connected";
  doc["firmware_version"] = "v3.0.0";
  doc["uptime_seconds"] = millis() / 1000;
  doc["is_active"] = machineRunning;
  
  // Formato correto do relay_status
  JsonObject relayStatusObj = doc.createNestedObject("relay_status");
  relayStatusObj["relay_1"] = relayState ? "on" : "off";
  relayStatusObj["relay_2"] = "off";
  
  String payload;
  serializeJson(doc, payload);
  
  // Fazer requisição
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", supabaseApiKey);
  
  int httpCode = http.POST(payload);
  
  if (httpCode > 0) {
    Serial.printf("✅ Heartbeat enviado - HTTP %d\\n", httpCode);
    lastHeartbeat = millis();
  } else {
    Serial.printf("❌ Erro no heartbeat - HTTP %d\\n", httpCode);
  }
  
  http.end();
}
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