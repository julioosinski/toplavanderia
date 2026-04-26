import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, Cpu, AlertTriangle, Wifi } from "lucide-react";
import { useLaundry } from "@/hooks/useLaundry";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useToast } from "@/hooks/use-toast";

const FIRMWARE_TEMPLATE = `/*
 * ESP32 AutoConfig v4.1 - Top Lavanderia
 * Firmware com Portal de Configuração WiFi
 * Gerado automaticamente pelo painel admin
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WebServer.h>
#include <SPIFFS.h>

const char* DEFAULT_SSID     = "{{WIFI_SSID}}";
const char* DEFAULT_PASSWORD = "{{WIFI_PASSWORD}}";
const char* LAUNDRY_ID       = "{{LAUNDRY_ID}}";
const char* SUPABASE_URL     = "{{SUPABASE_URL}}";
const char* SUPABASE_KEY     = "{{SUPABASE_KEY}}";

String wifiSSID = "";
String wifiPassword = "";
String esp32_id = "";
String deviceName = "";
String apName = "";
String heartbeatUrl = "";
String pollUrl = "";
String confirmUrl = "";

const unsigned long HEARTBEAT_INTERVAL = 30000;
const unsigned long POLL_INTERVAL = 5000;
const int WIFI_CONNECT_TIMEOUT = 20;

unsigned long lastHeartbeat = 0;
unsigned long lastPoll = 0;
bool isAPMode = false;

const int RELAY_PINS[] = {2, 4, 5, 18};
const int NUM_RELAYS = 4;

WebServer server(80);

void initSPIFFS() {
  if (!SPIFFS.begin(true)) { Serial.println("SPIFFS falhou!"); return; }
}

void saveWiFiCredentials(String ssid, String password) {
  File f = SPIFFS.open("/wifi_ssid.txt", "w");
  if (f) { f.print(ssid); f.close(); }
  f = SPIFFS.open("/wifi_pass.txt", "w");
  if (f) { f.print(password); f.close(); }
}

void loadWiFiCredentials() {
  if (SPIFFS.exists("/wifi_ssid.txt")) {
    File f = SPIFFS.open("/wifi_ssid.txt", "r");
    if (f) { wifiSSID = f.readString(); f.close(); }
    f = SPIFFS.open("/wifi_pass.txt", "r");
    if (f) { wifiPassword = f.readString(); f.close(); }
  } else {
    wifiSSID = String(DEFAULT_SSID);
    wifiPassword = String(DEFAULT_PASSWORD);
  }
}

const char CONFIG_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TopLav Config</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center}
.card{background:#1e293b;border-radius:16px;padding:32px;max-width:400px;width:90%}
h1{text-align:center;color:#60a5fa;font-size:22px;margin-bottom:8px}
.sub{text-align:center;color:#94a3b8;font-size:13px;margin-bottom:24px}
label{display:block;color:#94a3b8;font-size:13px;margin:16px 0 4px}
input{width:100%;padding:12px;border:1px solid #334155;border-radius:8px;background:#0f172a;color:#e2e8f0;font-size:16px}
input:focus{border-color:#60a5fa;outline:none}
button{width:100%;padding:14px;border:none;border-radius:8px;background:#3b82f6;color:#fff;font-size:16px;font-weight:bold;cursor:pointer;margin-top:24px}
button:hover{background:#2563eb}
.id{text-align:center;color:#475569;font-size:11px;margin-top:16px}
</style></head><body>
<div class="card">
<h1>Top Lavanderia</h1>
<p class="sub">Configure a rede WiFi</p>
<form action="/save" method="POST">
<label>SSID</label><input type="text" name="ssid" required placeholder="Nome da rede 2.4GHz">
<label>Senha</label><input type="password" name="password" required placeholder="Senha do WiFi">
<button type="submit">Salvar e Conectar</button>
</form>
<p class="id">%DEVICE_ID%</p>
</div></body></html>
)rawliteral";

void startAPMode() {
  isAPMode = true;
  WiFi.disconnect();
  WiFi.mode(WIFI_AP);
  WiFi.softAP(apName.c_str());
  Serial.println("AP ativo: " + apName + " IP: 192.168.4.1");

  server.on("/", HTTP_GET, []() {
    String html = String(CONFIG_HTML);
    html.replace("%DEVICE_ID%", esp32_id);
    server.send(200, "text/html", html);
  });

  server.on("/save", HTTP_POST, []() {
    String s = server.arg("ssid");
    String p = server.arg("password");
    if (s.length() > 0) {
      saveWiFiCredentials(s, p);
      server.send(200, "text/html", "<html><body style='background:#0f172a;color:#34d399;display:flex;align-items:center;justify-content:center;height:100vh;font-family:Arial'><div><h1>Salvo!</h1><p>Reiniciando...</p></div></body></html>");
      delay(3000);
      ESP.restart();
    } else {
      server.send(400, "text/plain", "SSID obrigatorio");
    }
  });

  server.onNotFound([]() {
    server.sendHeader("Location", "http://192.168.4.1", true);
    server.send(302, "text/plain", "");
  });

  server.begin();
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("ESP32 AutoConfig v4.1 - Top Lavanderia");

  for (int i = 0; i < NUM_RELAYS; i++) { pinMode(RELAY_PINS[i], OUTPUT); digitalWrite(RELAY_PINS[i], LOW); }

  WiFi.mode(WIFI_STA);
  uint8_t mac[6]; WiFi.macAddress(mac);
  char macStr[7]; sprintf(macStr, "%02X%02X%02X", mac[3], mac[4], mac[5]);
  esp32_id = "esp32_" + String(macStr);
  deviceName = "TopLav_" + String(macStr);
  apName = "TopLav_Config_" + String(macStr);

  initSPIFFS();
  loadWiFiCredentials();

  String baseUrl = String(SUPABASE_URL) + "/functions/v1/";
  heartbeatUrl = baseUrl + "esp32-monitor?action=heartbeat";
  pollUrl = baseUrl + "esp32-monitor?action=poll_commands&esp32_id=" + esp32_id;
  confirmUrl = baseUrl + "esp32-monitor?action=confirm_command";

  if (wifiSSID.length() == 0 || wifiSSID == "{{WIFI_SSID}}") { startAPMode(); return; }

  Serial.println("Conectando: " + wifiSSID);
  WiFi.begin(wifiSSID.c_str(), wifiPassword.c_str());
  int r = 0;
  while (WiFi.status() != WL_CONNECTED && r < WIFI_CONNECT_TIMEOUT) { delay(500); Serial.print("."); r++; }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" OK IP:" + WiFi.localIP().toString());
    sendHeartbeat(true);
  } else {
    Serial.println(" FALHOU - abrindo portal");
    startAPMode();
  }
}

void loop() {
  if (isAPMode) { server.handleClient(); return; }
  unsigned long now = millis();
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect(); delay(5000);
    static int fc = 0; fc++;
    if (fc > 12) { startAPMode(); fc = 0; }
    return;
  }
  if (now - lastHeartbeat >= HEARTBEAT_INTERVAL) { sendHeartbeat(false); lastHeartbeat = now; }
  if (now - lastPoll >= POLL_INTERVAL) { pollCommands(); lastPoll = now; }
}

void sendHeartbeat(bool autoRegister) {
  HTTPClient http;
  http.begin(heartbeatUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
  StaticJsonDocument<512> doc;
  doc["esp32_id"] = esp32_id;
  doc["laundry_id"] = LAUNDRY_ID;
  doc["device_name"] = deviceName;
  doc["ip_address"] = WiFi.localIP().toString();
  doc["signal_strength"] = WiFi.RSSI();
  doc["firmware_version"] = "v4.1";
  doc["uptime_seconds"] = millis() / 1000;
  doc["network_status"] = "connected";
  if (autoRegister) doc["auto_register"] = true;
  JsonObject relays = doc.createNestedObject("relay_status");
  for (int i = 0; i < NUM_RELAYS; i++) {
    relays["pin_" + String(RELAY_PINS[i])] = digitalRead(RELAY_PINS[i]) == HIGH ? "on" : "off";
  }
  String jsonStr; serializeJson(doc, jsonStr);
  int httpCode = http.POST(jsonStr);
  if (httpCode == 200) Serial.println("Heartbeat OK");
  else Serial.println("Heartbeat err:" + String(httpCode));
  http.end();
}

void pollCommands() {
  HTTPClient http;
  http.begin(pollUrl);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
  int httpCode = http.GET();
  if (httpCode == 200) {
    String response = http.getString();
    DynamicJsonDocument doc(2048);
    if (deserializeJson(doc, response) == DeserializationError::Ok) {
      JsonArray commands = doc["commands"].as<JsonArray>();
      for (JsonObject cmd : commands) {
        String cid = cmd["id"].as<String>();
        String act = cmd["action"].as<String>();
        int pin = cmd["relay_pin"].as<int>();
        bool ok = executeCommand(act, pin);
        confirmCommand(cid, ok);
      }
    }
  }
  http.end();
}

bool executeCommand(String action, int relayPin) {
  bool v = false;
  for (int i = 0; i < NUM_RELAYS; i++) { if (RELAY_PINS[i] == relayPin) { v = true; break; } }
  if (!v) return false;
  if (action == "activate" || action == "turn_on") { digitalWrite(relayPin, HIGH); return true; }
  if (action == "deactivate" || action == "turn_off") { digitalWrite(relayPin, LOW); return true; }
  return false;
}

void confirmCommand(String commandId, bool success) {
  HTTPClient http;
  http.begin(confirmUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
  StaticJsonDocument<256> doc;
  doc["command_id"] = commandId;
  doc["esp32_id"] = esp32_id;
  doc["success"] = success;
  String jsonStr; serializeJson(doc, jsonStr);
  http.POST(jsonStr);
  http.end();
}
`;

export const ESP32ConfigQRCode = () => {
  const { currentLaundry } = useLaundry();
  const { settings } = useSystemSettings();
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  if (!currentLaundry?.id) return null;

  const hasWifi = settings?.wifi_ssid && settings?.wifi_password;

  const generateFirmware = () => {
    setDownloading(true);

    const firmware = FIRMWARE_TEMPLATE
      .replace(/\{\{WIFI_SSID\}\}/g, settings?.wifi_ssid || "")
      .replace(/\{\{WIFI_PASSWORD\}\}/g, settings?.wifi_password || "")
      .replace(/\{\{LAUNDRY_ID\}\}/g, currentLaundry.id)
      .replace(/\{\{SUPABASE_URL\}\}/g, import.meta.env.VITE_SUPABASE_URL || "")
      .replace(/\{\{SUPABASE_KEY\}\}/g, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "");

    const blob = new Blob([firmware], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ESP32_TopLav_v4.1_${currentLaundry.name?.replace(/\s+/g, "_") || "laundry"}.ino`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Firmware v4.1 gerado!",
      description: hasWifi 
        ? "WiFi pré-configurado. O ESP32 também permite reconfiguração via portal." 
        : "Sem WiFi pré-configurado. O ESP32 abrirá o portal de configuração automaticamente.",
    });

    setDownloading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-primary" />
          Firmware ESP32 v4.1 (Portal WiFi)
        </CardTitle>
        <CardDescription>
          Firmware com portal de configuração WiFi integrado. Se o WiFi falhar, o ESP32 cria uma rede para reconfiguração.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {!hasWifi && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                WiFi não configurado nas settings. O ESP32 abrirá o <strong>portal de configuração</strong> (rede TopLav_Config_*) automaticamente ao ligar.
              </AlertDescription>
            </Alert>
          )}

          {hasWifi && (
            <Alert>
              <Wifi className="h-4 w-4" />
              <AlertDescription>
                WiFi pré-configurado: <strong>{settings?.wifi_ssid}</strong>. Se a rede mudar, o ESP32 abre o portal automaticamente.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">Como usar:</p>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Clique em <strong>"Baixar Firmware"</strong></li>
              <li>Abra no Arduino IDE e faça upload para o ESP32</li>
              <li>O ESP32 tenta conectar ao WiFi automaticamente</li>
              <li>Se falhar, cria a rede <code className="bg-muted px-1 rounded">TopLav_Config_XXXXXX</code></li>
              <li>Conecte nessa rede e acesse <code className="bg-muted px-1 rounded">http://192.168.4.1</code></li>
              <li>Configure SSID e senha → o ESP32 reinicia e se registra</li>
              <li>Aparece em <strong>"Pendentes"</strong> acima para aprovação</li>
            </ol>
          </div>

          <Button
            onClick={generateFirmware}
            disabled={downloading}
            className="w-full gap-2"
          >
            <Download className="h-4 w-4" />
            Baixar Firmware v4.1 (.ino)
          </Button>

          <p className="text-xs text-muted-foreground">
            Laundry ID: <code className="bg-muted px-1 rounded text-xs">{currentLaundry.id}</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
