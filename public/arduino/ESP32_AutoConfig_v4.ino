/*
 * ========================================
 * ESP32 AutoConfig v4.1 - Top Lavanderia
 * Plug-and-Play com Portal de Configuração
 * ========================================
 * 
 * Fluxo:
 * 1. Liga → Tenta WiFi salvo no SPIFFS (ou hardcoded)
 * 2. Se falhar em 10s → Abre AP "TopLav_Config_XXXXXX"
 * 3. Usuário acessa http://192.168.4.1 e configura WiFi
 * 4. ESP32 reinicia → Conecta → Auto-registro
 * 5. Aparece no painel admin como "Pendente"
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WebServer.h>
#include <SPIFFS.h>

// ============================================
// CONFIGURAÇÕES PRÉ-DEFINIDAS (geradas pelo painel)
// Usadas como fallback se SPIFFS estiver vazio
// ============================================
const char* DEFAULT_SSID     = "{{WIFI_SSID}}";
const char* DEFAULT_PASSWORD = "{{WIFI_PASSWORD}}";
const char* LAUNDRY_ID       = "{{LAUNDRY_ID}}";
const char* SUPABASE_URL     = "{{SUPABASE_URL}}";
const char* SUPABASE_KEY     = "{{SUPABASE_KEY}}";
// ============================================

// WiFi credentials (loaded from SPIFFS or defaults)
String wifiSSID = "";
String wifiPassword = "";

// Device identity
String esp32_id = "";
String deviceName = "";
String apName = "";

// URLs
String heartbeatUrl = "";
String pollUrl = "";
String confirmUrl = "";

// Timing
const unsigned long HEARTBEAT_INTERVAL = 30000;
const unsigned long POLL_INTERVAL = 5000;
const int WIFI_CONNECT_TIMEOUT = 20; // 10 seconds (20 * 500ms)

unsigned long lastHeartbeat = 0;
unsigned long lastPoll = 0;
bool isAPMode = false;

// Relay pins
const int RELAY_PINS[] = {2, 4, 5, 18};
const int NUM_RELAYS = 4;

// Web server for AP config portal
WebServer server(80);

// ============================================
// SPIFFS: Save/Load WiFi credentials
// ============================================

void initSPIFFS() {
  if (!SPIFFS.begin(true)) {
    Serial.println("❌ SPIFFS falhou!");
    return;
  }
  Serial.println("✅ SPIFFS OK");
}

void saveWiFiCredentials(String ssid, String password) {
  File f = SPIFFS.open("/wifi_ssid.txt", "w");
  if (f) { f.print(ssid); f.close(); }
  f = SPIFFS.open("/wifi_pass.txt", "w");
  if (f) { f.print(password); f.close(); }
  Serial.println("💾 WiFi salvo no SPIFFS");
}

void loadWiFiCredentials() {
  if (SPIFFS.exists("/wifi_ssid.txt")) {
    File f = SPIFFS.open("/wifi_ssid.txt", "r");
    if (f) { wifiSSID = f.readString(); f.close(); }
    f = SPIFFS.open("/wifi_pass.txt", "r");
    if (f) { wifiPassword = f.readString(); f.close(); }
    Serial.println("📂 WiFi carregado do SPIFFS: " + wifiSSID);
  } else {
    wifiSSID = String(DEFAULT_SSID);
    wifiPassword = String(DEFAULT_PASSWORD);
    Serial.println("📂 Usando WiFi padrão (hardcoded): " + wifiSSID);
  }
}

// ============================================
// Captive Portal HTML
// ============================================

const char CONFIG_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TopLav - Config WiFi</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center}
    .card{background:#1e293b;border-radius:16px;padding:32px;max-width:400px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,.4)}
    h1{text-align:center;color:#60a5fa;font-size:24px;margin-bottom:8px}
    .sub{text-align:center;color:#94a3b8;font-size:14px;margin-bottom:24px}
    label{display:block;color:#94a3b8;font-size:13px;margin-bottom:4px;margin-top:16px}
    input{width:100%;padding:12px;border:1px solid #334155;border-radius:8px;background:#0f172a;color:#e2e8f0;font-size:16px;outline:none}
    input:focus{border-color:#60a5fa}
    button{width:100%;padding:14px;border:none;border-radius:8px;background:#3b82f6;color:#fff;font-size:16px;font-weight:bold;cursor:pointer;margin-top:24px}
    button:hover{background:#2563eb}
    .id{text-align:center;color:#475569;font-size:11px;margin-top:16px}
    .status{text-align:center;padding:12px;border-radius:8px;margin-top:16px;font-size:14px;display:none}
    .ok{background:#065f4620;color:#34d399;display:block}
  </style>
</head>
<body>
  <div class="card">
    <h1>🧺 Top Lavanderia</h1>
    <p class="sub">Configure a rede WiFi do dispositivo</p>
    <form action="/save" method="POST" id="form">
      <label>Nome da Rede (SSID)</label>
      <input type="text" name="ssid" required placeholder="Ex: MinhaRede_2.4G">
      <label>Senha do WiFi</label>
      <input type="password" name="password" required placeholder="Senha da rede">
      <button type="submit">Salvar e Conectar</button>
    </form>
    <div class="status" id="status"></div>
    <p class="id">Dispositivo: %DEVICE_ID%</p>
  </div>
  <script>
    document.getElementById('form').addEventListener('submit',function(e){
      var s=document.getElementById('status');
      s.textContent='Salvando... O dispositivo vai reiniciar.';
      s.className='status ok';
    });
  </script>
</body>
</html>
)rawliteral";

// ============================================
// AP Mode: Start config portal
// ============================================

void startAPMode() {
  isAPMode = true;
  WiFi.disconnect();
  WiFi.mode(WIFI_AP);
  WiFi.softAP(apName.c_str());
  
  Serial.println("========================================");
  Serial.println("📡 MODO CONFIGURAÇÃO ATIVO");
  Serial.println("   Rede: " + apName);
  Serial.println("   IP: 192.168.4.1");
  Serial.println("   Acesse http://192.168.4.1");
  Serial.println("========================================");

  // Serve config page
  server.on("/", HTTP_GET, []() {
    String html = String(CONFIG_HTML);
    html.replace("%DEVICE_ID%", esp32_id);
    server.send(200, "text/html", html);
  });

  // Handle save
  server.on("/save", HTTP_POST, []() {
    String newSSID = server.arg("ssid");
    String newPass = server.arg("password");
    
    if (newSSID.length() > 0) {
      saveWiFiCredentials(newSSID, newPass);
      server.send(200, "text/html", 
        "<html><body style='background:#0f172a;color:#34d399;display:flex;align-items:center;justify-content:center;height:100vh;font-family:Arial'>"
        "<div style='text-align:center'><h1>✅ Salvo!</h1><p>Reiniciando em 3 segundos...</p></div>"
        "</body></html>");
      delay(3000);
      ESP.restart();
    } else {
      server.send(400, "text/plain", "SSID obrigatório");
    }
  });

  // Captive portal redirect
  server.onNotFound([]() {
    server.sendHeader("Location", "http://192.168.4.1", true);
    server.send(302, "text/plain", "");
  });

  server.begin();
}

// ============================================
// Setup
// ============================================

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("========================================");
  Serial.println("ESP32 AutoConfig v4.1 - Top Lavanderia");
  Serial.println("========================================");
  
  // Init relay pins
  for (int i = 0; i < NUM_RELAYS; i++) {
    pinMode(RELAY_PINS[i], OUTPUT);
    digitalWrite(RELAY_PINS[i], LOW);
  }
  
  // Generate device ID from MAC
  WiFi.mode(WIFI_STA);
  uint8_t mac[6];
  WiFi.macAddress(mac);
  char macStr[7];
  sprintf(macStr, "%02X%02X%02X", mac[3], mac[4], mac[5]);
  esp32_id = "esp32_" + String(macStr);
  deviceName = "TopLav_" + String(macStr);
  apName = "TopLav_Config_" + String(macStr);
  
  Serial.println("🆔 ID: " + esp32_id);
  
  // Init SPIFFS and load WiFi
  initSPIFFS();
  loadWiFiCredentials();
  
  // Build URLs
  String baseUrl = String(SUPABASE_URL) + "/functions/v1/";
  heartbeatUrl = baseUrl + "esp32-monitor?action=heartbeat";
  pollUrl = baseUrl + "esp32-monitor?action=poll_commands&esp32_id=" + esp32_id;
  confirmUrl = baseUrl + "esp32-monitor?action=confirm_command";
  
  // Try connecting to WiFi
  if (wifiSSID.length() == 0 || wifiSSID == "{{WIFI_SSID}}") {
    Serial.println("⚠️ Nenhum WiFi configurado");
    startAPMode();
    return;
  }
  
  Serial.println("📡 Conectando: " + wifiSSID);
  WiFi.begin(wifiSSID.c_str(), wifiPassword.c_str());
  
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < WIFI_CONNECT_TIMEOUT) {
    delay(500);
    Serial.print(".");
    retries++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi OK! IP: " + WiFi.localIP().toString());
    Serial.println("   RSSI: " + String(WiFi.RSSI()) + " dBm");
    sendHeartbeat(true);
  } else {
    Serial.println("\n❌ WiFi falhou! Abrindo portal de configuração...");
    startAPMode();
  }
}

// ============================================
// Loop
// ============================================

void loop() {
  // AP mode: handle web server
  if (isAPMode) {
    server.handleClient();
    return;
  }
  
  unsigned long now = millis();
  
  // Check WiFi
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ WiFi perdido. Reconectando...");
    WiFi.reconnect();
    delay(5000);
    // If reconnect fails for too long, go to AP mode
    static int failCount = 0;
    failCount++;
    if (failCount > 12) { // ~60 seconds
      Serial.println("❌ WiFi indisponível. Abrindo portal...");
      startAPMode();
      failCount = 0;
    }
    return;
  }
  
  // Heartbeat
  if (now - lastHeartbeat >= HEARTBEAT_INTERVAL) {
    sendHeartbeat(false);
    lastHeartbeat = now;
  }
  
  // Poll commands
  if (now - lastPoll >= POLL_INTERVAL) {
    pollCommands();
    lastPoll = now;
  }
}

// ============================================
// Heartbeat
// ============================================

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

  String jsonStr;
  serializeJson(doc, jsonStr);
  int httpCode = http.POST(jsonStr);
  if (httpCode == 200) Serial.println("💓 Heartbeat OK");
  else Serial.println("❌ Heartbeat: " + String(httpCode));
  http.end();
}

// ============================================
// Poll Commands
// ============================================

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
        Serial.println("⚡ " + action + " pino " + String(relayPin));
        bool success = executeCommand(action, relayPin);
        confirmCommand(commandId, success);
      }
    }
  }
  http.end();
}

// ============================================
// Execute & Confirm
// ============================================

bool executeCommand(String action, int relayPin) {
  action.toLowerCase();
  // Índice lógico 1..N → GPIO em RELAY_PINS (app / esp32-control usam "on"/"off")
  int gpio = -1;
  if (relayPin >= 1 && relayPin <= NUM_RELAYS) {
    gpio = RELAY_PINS[relayPin - 1];
  } else {
    for (int i = 0; i < NUM_RELAYS; i++) {
      if (RELAY_PINS[i] == relayPin) { gpio = relayPin; break; }
    }
  }
  if (gpio < 0) return false;
  if (action == "on" || action == "activate" || action == "turn_on") {
    digitalWrite(gpio, HIGH);
    return true;
  }
  if (action == "off" || action == "deactivate" || action == "turn_off") {
    digitalWrite(gpio, LOW);
    return true;
  }
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
  String jsonStr;
  serializeJson(doc, jsonStr);
  http.POST(jsonStr);
  http.end();
}
