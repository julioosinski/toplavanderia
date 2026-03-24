import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, Cpu, AlertTriangle, Wifi } from "lucide-react";
import { useLaundry } from "@/contexts/LaundryContext";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useToast } from "@/hooks/use-toast";

const FIRMWARE_TEMPLATE = `/*
 * ESP32 AutoConfig v4.0 - Top Lavanderia
 * Firmware gerado automaticamente pelo painel admin
 * NÃO EDITE - gere novamente pelo painel se precisar alterar
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* WIFI_SSID     = "{{WIFI_SSID}}";
const char* WIFI_PASSWORD = "{{WIFI_PASSWORD}}";
const char* LAUNDRY_ID    = "{{LAUNDRY_ID}}";
const char* SUPABASE_URL  = "{{SUPABASE_URL}}";
const char* SUPABASE_KEY  = "{{SUPABASE_KEY}}";

String esp32_id = "";
String deviceName = "";
String heartbeatUrl = "";
String pollUrl = "";
String confirmUrl = "";

const unsigned long HEARTBEAT_INTERVAL = 30000;
const unsigned long POLL_INTERVAL = 5000;
const int MAX_WIFI_RETRIES = 50;

unsigned long lastHeartbeat = 0;
unsigned long lastPoll = 0;

const int RELAY_PINS[] = {2, 4, 5, 18};
const int NUM_RELAYS = 4;

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("========================================");
  Serial.println("ESP32 AutoConfig v4.0 - Top Lavanderia");
  Serial.println("========================================");

  for (int i = 0; i < NUM_RELAYS; i++) {
    pinMode(RELAY_PINS[i], OUTPUT);
    digitalWrite(RELAY_PINS[i], LOW);
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  uint8_t mac[6];
  WiFi.macAddress(mac);
  char macStr[7];
  sprintf(macStr, "%02X%02X%02X", mac[3], mac[4], mac[5]);
  esp32_id = "esp32_" + String(macStr);
  deviceName = "TopLav_" + String(macStr);

  Serial.println("ID: " + esp32_id);

  String baseUrl = String(SUPABASE_URL) + "/functions/v1/";
  heartbeatUrl = baseUrl + "esp32-monitor?action=heartbeat";
  pollUrl = baseUrl + "esp32-monitor?action=poll_commands&esp32_id=" + esp32_id;
  confirmUrl = baseUrl + "esp32-monitor?action=confirm_command";

  Serial.print("Conectando WiFi");
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < MAX_WIFI_RETRIES) {
    delay(500); Serial.print("."); retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" OK! IP: " + WiFi.localIP().toString());
    sendHeartbeat(true);
  } else {
    Serial.println(" FALHOU");
  }
}

void loop() {
  unsigned long now = millis();
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect(); delay(10000); return;
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
  doc["firmware_version"] = "v4.0";
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
  else Serial.println("Heartbeat falhou: " + String(httpCode));
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
        String commandId = cmd["id"].as<String>();
        String action = cmd["action"].as<String>();
        int relayPin = cmd["relay_pin"].as<int>();
        bool success = executeCommand(action, relayPin);
        confirmCommand(commandId, success);
      }
    }
  }
  http.end();
}

bool executeCommand(String action, int relayPin) {
  bool validPin = false;
  for (int i = 0; i < NUM_RELAYS; i++) { if (RELAY_PINS[i] == relayPin) { validPin = true; break; } }
  if (!validPin) return false;
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
    if (!hasWifi) {
      toast({
        title: "WiFi não configurado",
        description: "Configure o SSID e senha do WiFi nas configurações antes de gerar o firmware.",
        variant: "destructive",
      });
      return;
    }

    setDownloading(true);

    const firmware = FIRMWARE_TEMPLATE
      .replace("{{WIFI_SSID}}", settings!.wifi_ssid!)
      .replace("{{WIFI_PASSWORD}}", settings!.wifi_password!)
      .replace("{{LAUNDRY_ID}}", currentLaundry.id)
      .replace("{{SUPABASE_URL}}", import.meta.env.VITE_SUPABASE_URL || "")
      .replace("{{SUPABASE_KEY}}", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "");

    const blob = new Blob([firmware], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ESP32_TopLav_v4_${currentLaundry.name?.replace(/\s+/g, "_") || "laundry"}.ino`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Firmware gerado!",
      description: "Abra o arquivo no Arduino IDE e faça upload para o ESP32.",
    });

    setDownloading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-primary" />
          Firmware ESP32 (Plug-and-Play)
        </CardTitle>
        <CardDescription>
          Gere o firmware pré-configurado para seus ESP32. Basta gravar e ligar — o dispositivo aparecerá automaticamente nos pendentes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {!hasWifi && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Configure o <strong>SSID e senha do WiFi</strong> na seção de configurações abaixo antes de gerar o firmware.
              </AlertDescription>
            </Alert>
          )}

          {hasWifi && (
            <Alert>
              <Wifi className="h-4 w-4" />
              <AlertDescription>
                WiFi configurado: <strong>{settings?.wifi_ssid}</strong> — O firmware será gerado com estas credenciais.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">Como usar:</p>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Clique em <strong>"Baixar Firmware"</strong> abaixo</li>
              <li>Abra o arquivo <code className="bg-muted px-1 rounded">.ino</code> no Arduino IDE</li>
              <li>Conecte o ESP32 via USB e faça upload</li>
              <li>O ESP32 conectará ao WiFi e aparecerá em <strong>"Pendentes"</strong> acima</li>
              <li>Dê um nome, escolha o tipo e aprove</li>
            </ol>
          </div>

          <Button
            onClick={generateFirmware}
            disabled={!hasWifi || downloading}
            className="w-full gap-2"
          >
            <Download className="h-4 w-4" />
            Baixar Firmware (.ino)
          </Button>

          <p className="text-xs text-muted-foreground">
            Laundry ID: <code className="bg-muted px-1 rounded text-xs">{currentLaundry.id}</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
