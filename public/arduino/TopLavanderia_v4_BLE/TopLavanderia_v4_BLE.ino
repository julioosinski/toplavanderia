/**
 * TopLavanderia v4.1-BLE — ESP32 Lavanderia
 *
 * WiFi (STA + portal cativo), BLE sempre ativo, polling Supabase e heartbeat.
 * Alinhado ao app React/Capacitor (useBLEDiagnostics) e à função esp32-monitor.
 *
 * Bibliotecas: WiFi, WebServer, DNSServer, HTTPClient, Preferences, BLE*, ArduinoJson 7+
 */

#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ========================= CONFIGURAÇÃO FIXA =========================
static const char* SUPABASE_URL = "https://rkdybjzwiwwqqzjfmerm.supabase.co";
static const char* SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZHlianp3aXd3cXF6amZtZXJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMDgxNjcsImV4cCI6MjA2ODg4NDE2N30.CnRP8lrmGmvcbHmWdy72ZWlfZ28cDdNoxdADnyFAOXg";

/** Troque pelo UUID da lavanderia no Supabase (Preferences pode sobrescrever após configurar no portal). */
static const char* LAUNDRY_ID_DEFAULT = "INSERIR_LAUNDRY_ID";

/** GPIO do relé principal (comandos remotos usam relay_pin 2 no banco). */
#ifndef RELAY_PIN
#define RELAY_PIN 2
#endif

static const char* FIRMWARE_VERSION = "v4.1-BLE";

// Chaves Preferences (NVS)
static const char* PREF_NS = "toplav";
static const char* KEY_SSID = "wifi_ssid";
static const char* KEY_PASS = "wifi_pass";
static const char* KEY_LAUNDRY = "laundry_id";

// UUIDs BLE — não alterar (app Android)
#define SERVICE_UUID "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHAR_STATUS_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define CHAR_COMMAND_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a9"
#define CHAR_CONFIG_UUID "beb5483e-36e1-4688-b7f5-ea07361b26aa"

// Intervalos
static const unsigned long POLL_MS = 5000;
static const unsigned long HEARTBEAT_MS = 30000;
static const unsigned long LOOP_DELAY_MS = 100;
static const int WIFI_CONNECT_ATTEMPTS = 40;  // ~20 s (500 ms cada)

// Objetos globais
Preferences prefs;
WebServer webServer(80);
DNSServer dnsServer;
BLEServer* bleServer = nullptr;
BLECharacteristic* charStatus = nullptr;
BLECharacteristic* charCommand = nullptr;
BLECharacteristic* charConfig = nullptr;

String gEsp32Id;
String gBleName;
String gApName;       // TopLav_Config_XXXXXX (últimos 6 hex do MAC)
String gLaundryId;
String gWifiSsid;
String gWifiPass;

String gPollUrl;
String gHeartbeatUrl;
String gConfirmUrl;

bool gPortalAtivo = false;
bool gWifiConectado = false;
unsigned long gUltimoPoll = 0;
unsigned long gUltimoHeartbeat = 0;
unsigned long gBootMs = 0;
unsigned long gWifiDownSince = 0;  // millis() quando WiFi caiu (0 = OK)

// Estado do relé: true = energizado (máquina ligada)
bool gRelayOn = false;

// ========================= Utilitários =========================

String macFullHex12() {
  uint8_t m[6];
  WiFi.macAddress(m);
  char buf[14];
  snprintf(buf, sizeof(buf), "%02X%02X%02X%02X%02X%02X", m[0], m[1], m[2], m[3], m[4], m[5]);
  return String(buf);
}

String macSuffix6() {
  uint8_t m[6];
  WiFi.macAddress(m);
  char buf[8];
  snprintf(buf, sizeof(buf), "%02X%02X%02X", m[3], m[4], m[5]);
  return String(buf);
}

void setRelay(bool on) {
  gRelayOn = on;
  digitalWrite(RELAY_PIN, on ? HIGH : LOW);
}

String buildStatusJson() {
  JsonDocument doc;
  doc["esp32_id"] = gEsp32Id;
  doc["firmware_version"] = FIRMWARE_VERSION;
  doc["wifi_ssid"] = (WiFi.status() == WL_CONNECTED) ? WiFi.SSID() : gWifiSsid;
  doc["wifi_connected"] = (WiFi.status() == WL_CONNECTED);
  doc["ip_address"] = (WiFi.status() == WL_CONNECTED) ? WiFi.localIP().toString() : "";
  doc["uptime_seconds"] = (millis() - gBootMs) / 1000;
  doc["signal_strength"] = (WiFi.status() == WL_CONNECTED) ? WiFi.RSSI() : 0;
  doc["laundry_id"] = gLaundryId;

  JsonObject rs = doc["relay_status"].to<JsonObject>();
  // relay_2 = pin físico 2 (esp32-monitor / pending_commands); relay_1 = alias para o app “Relé 1”
  const char* v = gRelayOn ? "on" : "off";
  rs["relay_1"] = v;
  rs["relay_2"] = v;

  String out;
  serializeJson(doc, out);
  return out;
}

void pushBleStatusNotify() {
  if (!charStatus) return;
  String j = buildStatusJson();
  charStatus->setValue(j.c_str());
  charStatus->notify();
}

void loadPrefs() {
  gWifiSsid = prefs.getString(KEY_SSID, "");
  gWifiPass = prefs.getString(KEY_PASS, "");
  gLaundryId = prefs.getString(KEY_LAUNDRY, LAUNDRY_ID_DEFAULT);
  if (gLaundryId.length() == 0) gLaundryId = LAUNDRY_ID_DEFAULT;
}

void saveWifiPrefs(const String& ssid, const String& pass) {
  prefs.putString(KEY_SSID, ssid);
  prefs.putString(KEY_PASS, pass);
  gWifiSsid = ssid;
  gWifiPass = pass;
}

void saveLaundryPref(const String& id) {
  if (id.length() == 0) return;
  prefs.putString(KEY_LAUNDRY, id);
  gLaundryId = id;
}

// ========================= HTTP Supabase =========================

bool httpSupabasePost(const String& url, JsonDocument& body) {
  if (WiFi.status() != WL_CONNECTED) return false;
  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  String payload;
  serializeJson(body, payload);
  int code = http.POST(payload);
  http.end();
  if (code == 200) {
    Serial.println("✅ POST OK");
    return true;
  }
  Serial.printf("❌ POST falhou: %d\n", code);
  return false;
}

void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;

  JsonDocument doc;
  doc["esp32_id"] = gEsp32Id;
  doc["laundry_id"] = gLaundryId;
  doc["device_name"] = gBleName;
  doc["ip_address"] = WiFi.localIP().toString();
  doc["signal_strength"] = WiFi.RSSI();
  doc["network_status"] = "connected";
  doc["firmware_version"] = FIRMWARE_VERSION;
  doc["uptime_seconds"] = (millis() - gBootMs) / 1000;
  doc["auto_register"] = true;

  JsonObject rs = doc["relay_status"].to<JsonObject>();
  const char* v = gRelayOn ? "on" : "off";
  rs["relay_1"] = v;
  rs["relay_2"] = v;

  httpSupabasePost(gHeartbeatUrl, doc);
  Serial.println("💓 Heartbeat enviado");
}

void confirmCommand(const String& commandId) {
  if (WiFi.status() != WL_CONNECTED || commandId.length() == 0) return;
  JsonDocument doc;
  doc["command_id"] = commandId;
  doc["esp32_id"] = gEsp32Id;
  httpSupabasePost(gConfirmUrl, doc);
  Serial.println("✅ Comando confirmado: " + commandId);
}

void pollCommands() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(gPollUrl);
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  int code = http.GET();
  if (code != 200) {
    Serial.printf("❌ poll_commands HTTP %d\n", code);
    http.end();
    return;
  }

  String response = http.getString();
  http.end();

  JsonDocument doc(4096);
  DeserializationError err = deserializeJson(doc, response);
  if (err) {
    Serial.println("❌ JSON poll inválido");
    return;
  }

  if (!doc["success"].as<bool>()) return;

  JsonArray cmds = doc["commands"].as<JsonArray>();
  for (JsonObject c : cmds) {
    String id = c["id"].as<String>();
    int pin = c["relay_pin"] | RELAY_PIN;
    String action = c["action"].as<String>();
    if (pin != RELAY_PIN) {
      Serial.printf("⚡ Ignorado: relay_pin %d (esperado %d)\n", pin, RELAY_PIN);
      confirmCommand(id);
      continue;
    }
    if (action == "on") {
      setRelay(true);
      Serial.println("⚡ Comando: ON");
    } else if (action == "off") {
      setRelay(false);
      Serial.println("⚡ Comando: OFF");
    } else {
      Serial.println("⚡ Ação desconhecida: " + action);
    }
    confirmCommand(id);
    pushBleStatusNotify();
  }
}

// ========================= Comandos BLE (COMMAND) =========================

void handleBleCommandLine(const String& line) {
  String s = line;
  s.trim();
  if (s.length() == 0) return;

  JsonDocument jd;
  DeserializationError je = deserializeJson(jd, s);
  if (!je && jd["cmd"].is<const char*>()) {
    String cmd = jd["cmd"].as<String>();
    cmd.toLowerCase();
    if (cmd == "relay_on") {
      setRelay(true);
      Serial.println("⚡ BLE: relay_on");
    } else if (cmd == "relay_off") {
      setRelay(false);
      Serial.println("⚡ BLE: relay_off");
    } else if (cmd == "reset") {
      Serial.println("⚡ BLE: reset");
      delay(200);
      ESP.restart();
      return;
    } else if (cmd == "status") {
      Serial.println("📡 BLE: status");
    } else {
      Serial.println("❌ BLE cmd desconhecido: " + cmd);
    }
    pushBleStatusNotify();
    return;
  }

  // Texto puro — compatível com useBLEDiagnostics / BLEDiagnostics.tsx
  s.toLowerCase();
  if (s == "relay_1_on" || s == "relay_on") {
    setRelay(true);
    Serial.println("⚡ BLE: relay_1_on");
  } else if (s == "relay_1_off" || s == "relay_off") {
    setRelay(false);
    Serial.println("⚡ BLE: relay_1_off");
  } else if (s == "restart" || s == "reset") {
    Serial.println("⚡ BLE: restart");
    delay(200);
    ESP.restart();
    return;
  } else if (s == "status") {
    Serial.println("📡 BLE: status (texto)");
  } else {
    Serial.println("❌ BLE comando texto desconhecido: " + line);
  }
  pushBleStatusNotify();
}

// ========================= Config BLE (CONFIG) =========================

void handleBleConfigPayload(const String& raw) {
  JsonDocument jd;
  if (deserializeJson(jd, raw)) {
    Serial.println("❌ CONFIG JSON inválido");
    return;
  }

  String ssid, pass;
  if (jd["wifi_ssid"].is<const char*>()) ssid = jd["wifi_ssid"].as<String>();
  if (jd["wifi_password"].is<const char*>()) pass = jd["wifi_password"].as<String>();
  // App atual envia { "ssid", "password" }
  if (ssid.length() == 0 && jd["ssid"].is<const char*>()) ssid = jd["ssid"].as<String>();
  if (pass.length() == 0 && jd["password"].is<const char*>()) pass = jd["password"].as<String>();

  if (ssid.length() == 0) {
    Serial.println("❌ CONFIG sem SSID");
    return;
  }

  saveWifiPrefs(ssid, pass);
  Serial.println("💾 WiFi salvo via BLE. Reiniciando…");
  delay(500);
  ESP.restart();
}

// ========================= BLE =========================

class CmdCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* p) override {
    String v = p->getValue().c_str();
    if (v.length()) handleBleCommandLine(v);
  }
};

class CfgCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* p) override {
    String v = p->getValue().c_str();
    if (v.length()) handleBleConfigPayload(v);
  }
};

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* s) override {
    Serial.println("📡 BLE cliente conectado");
    pushBleStatusNotify();
  }
  void onDisconnect(BLEServer* s) override {
    Serial.println("📡 BLE cliente desconectado");
    BLEDevice::startAdvertising();
  }
};

void setupBLE() {
  BLEDevice::init(gBleName.c_str());
  bleServer = BLEDevice::createServer();
  bleServer->setCallbacks(new ServerCallbacks());

  BLEService* svc = bleServer->createService(SERVICE_UUID);

  charStatus = svc->createCharacteristic(CHAR_STATUS_UUID,
                                         BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  charStatus->addDescriptor(new BLE2902());
  charStatus->setValue(buildStatusJson().c_str());

  charCommand = svc->createCharacteristic(CHAR_COMMAND_UUID, BLECharacteristic::PROPERTY_WRITE);
  charCommand->setCallbacks(new CmdCallbacks());

  charConfig = svc->createCharacteristic(CHAR_CONFIG_UUID, BLECharacteristic::PROPERTY_WRITE);
  charConfig->setCallbacks(new CfgCallbacks());

  svc->start();
  BLEAdvertising* adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(SERVICE_UUID);
  adv->setScanResponse(true);
  adv->setMinPreferred(0x06);
  BLEDevice::startAdvertising();

  Serial.printf("📡 BLE ativo — nome: %s\n", gBleName.c_str());
}

// ========================= Portal cativo =========================

const char CONFIG_PAGE[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Top Lavanderia — WiFi</title>
<style>
body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center}
.card{background:#1e293b;border-radius:16px;padding:28px;max-width:420px;width:92%}
h1{color:#60a5fa;font-size:1.35rem}
label{display:block;margin-top:14px;font-size:.85rem;color:#94a3b8}
input{width:100%;padding:10px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;box-sizing:border-box}
button{margin-top:20px;width:100%;padding:12px;border:none;border-radius:8px;background:#3b82f6;color:#fff;font-weight:600;cursor:pointer}
.muted{font-size:.75rem;color:#64748b;margin-top:16px}
</style>
</head><body>
<div class="card">
<h1>Top Lavanderia</h1>
<p>Configure o WiFi do ESP32.</p>
<form method="POST" action="/save">
<label>SSID</label><input name="ssid" required>
<label>Senha</label><input name="password" type="password" placeholder="(vazio se aberta)">
<label>ID da lavanderia (UUID) — opcional</label><input name="laundry_id" placeholder="deixe vazio para manter">
<button type="submit">Salvar e reiniciar</button>
</form>
<p class="muted">Dispositivo: %DEVICE_ID%</p>
</div>
</body></html>
)rawliteral";

void iniciarPortalCativo() {
  gPortalAtivo = true;
  gWifiConectado = false;
  WiFi.disconnect(true, true);
  delay(200);
  WiFi.mode(WIFI_AP);
  WiFi.softAP(gApName.c_str());
  IPAddress apIP(192, 168, 4, 1);
  WiFi.softAPConfig(apIP, apIP, IPAddress(255, 255, 255, 0));

  dnsServer.start(53, "*", apIP);

  webServer.on("/", HTTP_GET, []() {
    String html = String(CONFIG_PAGE);
    html.replace("%DEVICE_ID%", gEsp32Id);
    webServer.send(200, "text/html", html);
  });

  webServer.on("/save", HTTP_POST, []() {
    String ssid = webServer.arg("ssid");
    String pass = webServer.arg("password");
    String lid = webServer.arg("laundry_id");
    lid.trim();
    if (ssid.length() == 0) {
      webServer.send(400, "text/plain", "SSID obrigatório");
      return;
    }
    saveWifiPrefs(ssid, pass);
    if (lid.length() > 0) saveLaundryPref(lid);
    webServer.send(200, "text/html",
                   "<html><body style='background:#0f172a;color:#34d399;text-align:center;padding:2rem;font-family:sans-serif'>"
                   "<h1>Salvo</h1><p>Reiniciando…</p></body></html>");
    delay(800);
    ESP.restart();
  });

  webServer.onNotFound([]() {
    webServer.sendHeader("Location", "http://192.168.4.1/", true);
    webServer.send(302, "text/plain", "");
  });

  webServer.begin();
  Serial.println("📡 Portal cativo: http://192.168.4.1");
  Serial.println("   AP: " + gApName);
}

bool conectarWiFi() {
  if (gWifiSsid.length() == 0) return false;

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(gWifiSsid.c_str(), gWifiPass.c_str());

  Serial.print("📡 Conectando WiFi");
  for (int i = 0; i < WIFI_CONNECT_ATTEMPTS; i++) {
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\n✅ WiFi OK — IP: " + WiFi.localIP().toString());
      gWifiConectado = true;
      gPortalAtivo = false;
      return true;
    }
    Serial.print(".");
    delay(500);
  }
  Serial.println("\n❌ Falha WiFi");
  gWifiConectado = false;
  return false;
}

unsigned long gUltimaTentativaWifi = 0;

void tentarReconectarWifi() {
  if (gPortalAtivo) return;
  if (WiFi.status() == WL_CONNECTED) {
    gWifiConectado = true;
    return;
  }
  gWifiConectado = false;
  const unsigned long agora = millis();
  if (agora - gUltimaTentativaWifi < 10000) return;
  gUltimaTentativaWifi = agora;
  Serial.println("📡 WiFi desconectado — nova tentativa de conexão…");
  WiFi.disconnect(false);
  delay(200);
  WiFi.begin(gWifiSsid.c_str(), gWifiPass.c_str());
}

// ========================= Arduino =========================

void setup() {
  Serial.begin(115200);
  delay(300);
  gBootMs = millis();

  Serial.println("\n========================================");
  Serial.println("TopLavanderia " + String(FIRMWARE_VERSION));
  Serial.println("========================================");

  pinMode(RELAY_PIN, OUTPUT);
  setRelay(false);

  prefs.begin(PREF_NS, false);
  loadPrefs();

  WiFi.mode(WIFI_STA);
  gEsp32Id = "esp32_" + macFullHex12();
  gApName = "TopLav_Config_" + macSuffix6();
  gBleName = "TopLav_" + gEsp32Id;

  gPollUrl = String(SUPABASE_URL) + "/functions/v1/esp32-monitor?action=poll_commands&esp32_id=" + gEsp32Id;
  gHeartbeatUrl = String(SUPABASE_URL) + "/functions/v1/esp32-monitor?action=heartbeat";
  gConfirmUrl = String(SUPABASE_URL) + "/functions/v1/esp32-monitor?action=confirm_command";

  Serial.println("🆔 " + gEsp32Id);

  setupBLE();

  if (!conectarWiFi()) {
    iniciarPortalCativo();
  } else {
    sendHeartbeat();
    gUltimoHeartbeat = millis();
    gUltimoPoll = millis();
  }

  Serial.println("✅ Setup concluído\n");
}

void loop() {
  if (gPortalAtivo) {
    dnsServer.processNextRequest();
    webServer.handleClient();
    delay(LOOP_DELAY_MS);
    return;
  }

  if (WiFi.status() != WL_CONNECTED) {
    tentarReconectarWifi();
    if (gWifiDownSince == 0) gWifiDownSince = millis();
    if (millis() - gWifiDownSince > 120000) {
      gWifiDownSince = 0;
      Serial.println("❌ WiFi indisponível — portal de configuração");
      webServer.stop();
      dnsServer.stop();
      iniciarPortalCativo();
    }
    delay(LOOP_DELAY_MS);
    return;
  }
  gWifiDownSince = 0;

  unsigned long now = millis();

  if (now - gUltimoPoll >= POLL_MS) {
    pollCommands();
    gUltimoPoll = now;
  }

  if (now - gUltimoHeartbeat >= HEARTBEAT_MS) {
    sendHeartbeat();
    pushBleStatusNotify();
    gUltimoHeartbeat = now;
  }

  delay(LOOP_DELAY_MS);
}
