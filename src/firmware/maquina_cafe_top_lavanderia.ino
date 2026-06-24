/**
 * ESP32 Máquina de Café — Top Lavanderia
 * Perfil: coin_dispense — action "credito" via pending_commands (esp32-monitor)
 *
 * Placeholders: __LAUNDRY_ID__, __MACHINE_NAME__
 * Pinos moedeiro (MOSFET 2N7000): GPIO 19=R$1, 2=R$0,50, 23=R$0,10
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <cstdio>

#define FIRMWARE_VERSION "v1.0.0-toplav"

#define LAUNDRY_ID "__LAUNDRY_ID__"
#define MACHINE_NAME "__MACHINE_NAME__"

const char* supabaseUrl = "https://rkdybjzwiwwqqzjfmerm.supabase.co";
const char* supabaseApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZHlianp3aXd3cXF6amZtZXJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMDgxNjcsImV4cCI6MjA2ODg4NDE2N30.CnRP8lrmGmvcbHmWdy72ZWlfZ28cDdNoxdADnyFAOXg";

const char* WIFI_NAMESPACE = "wifi_cfg";
const char* AP_PASSWORD = "toplav123";
String configuredSsid = "";
String configuredPassword = "";

char ESP32_ID[16];
void buildEsp32Id() {
  uint8_t mac[6];
  WiFi.macAddress(mac);
  snprintf(ESP32_ID, sizeof(ESP32_ID), "esp32_%02x%02x%02x%02x", mac[2], mac[3], mac[4], mac[5]);
}

const int PINO_MOEDA_100 = 19;
const int PINO_MOEDA_050 = 2;
const int PINO_MOEDA_010 = 23;
const int VALOR_MOEDAS[] = {100, 50, 10};
const int PINOS_MOEDAS[] = {PINO_MOEDA_100, PINO_MOEDA_050, PINO_MOEDA_010};
const int NUM_MOEDAS = 3;
const int TEMPO_PULSO_MOEDA = 100;
const int TEMPO_ENTRE_MOEDAS = 300;

unsigned long lastHeartbeat = 0;
unsigned long lastPoll = 0;
const unsigned long HEARTBEAT_INTERVAL = 30000;
const unsigned long POLL_INTERVAL = 5000;

bool inserindoCredito = false;

bool loadWiFiCredentials() {
  Preferences preferences;
  preferences.begin(WIFI_NAMESPACE, true);
  configuredSsid = preferences.getString("ssid", "");
  configuredPassword = preferences.getString("pass", "");
  preferences.end();
  configuredSsid.trim();
  return configuredSsid.length() > 0;
}

void connectWiFi() {
  if (!loadWiFiCredentials()) {
    Serial.println("Configure Wi-Fi via portal Top Lavanderia (template lavadora).");
    return;
  }
  WiFi.mode(WIFI_STA);
  WiFi.begin(configuredSsid.c_str(), configuredPassword.c_str());
  Serial.printf("Conectando Wi-Fi: %s\n", configuredSsid.c_str());
  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 40) {
    delay(500);
    tries++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("Wi-Fi OK: %s\n", WiFi.localIP().toString().c_str());
  }
}

bool inserirCredito(int valor_centavos) {
  if (valor_centavos <= 0) return false;
  inserindoCredito = true;
  Serial.printf("Inserindo crédito: %d centavos\n", valor_centavos);

  int valor_restante = valor_centavos;
  int contagem_moedas[NUM_MOEDAS] = {0, 0, 0};

  for (int i = 0; i < NUM_MOEDAS; i++) {
    while (valor_restante >= VALOR_MOEDAS[i]) {
      contagem_moedas[i]++;
      valor_restante -= VALOR_MOEDAS[i];
    }
  }
  if (valor_restante > 0) {
    contagem_moedas[2] += (valor_restante + 9) / 10;
  }

  for (int i = 0; i < NUM_MOEDAS; i++) {
    for (int j = 0; j < contagem_moedas[i]; j++) {
      digitalWrite(PINOS_MOEDAS[i], HIGH);
      delay(TEMPO_PULSO_MOEDA);
      digitalWrite(PINOS_MOEDAS[i], LOW);
      delay(TEMPO_ENTRE_MOEDAS);
    }
  }

  inserindoCredito = false;
  return true;
}

void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(supabaseUrl) + "/functions/v1/esp32-monitor?action=heartbeat";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", supabaseApiKey);
  http.addHeader("Authorization", String("Bearer ") + supabaseApiKey);

  StaticJsonDocument<512> doc;
  doc["esp32_id"] = ESP32_ID;
  doc["laundry_id"] = LAUNDRY_ID;
  doc["device_name"] = MACHINE_NAME;
  doc["firmware_version"] = FIRMWARE_VERSION;
  doc["ip_address"] = WiFi.localIP().toString();
  doc["signal_strength"] = WiFi.RSSI();
  doc["network_status"] = "connected";
  doc["auto_register"] = true;
  doc["uptime_seconds"] = millis() / 1000;

  String body;
  serializeJson(doc, body);
  int code = http.POST(body);
  http.end();
  Serial.printf("Heartbeat HTTP %d\n", code);
}

void confirmCommand(const char* commandId) {
  HTTPClient http;
  String url = String(supabaseUrl) + "/functions/v1/esp32-monitor?action=confirm_command";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", supabaseApiKey);
  http.addHeader("Authorization", String("Bearer ") + supabaseApiKey);

  StaticJsonDocument<256> doc;
  doc["command_id"] = commandId;
  doc["esp32_id"] = ESP32_ID;
  String body;
  serializeJson(doc, body);
  int code = http.POST(body);
  http.end();
  Serial.printf("Confirm command %s HTTP %d\n", commandId, code);
}

void pollCommands() {
  if (WiFi.status() != WL_CONNECTED || inserindoCredito) return;

  HTTPClient http;
  String url = String(supabaseUrl) + "/functions/v1/esp32-monitor?action=poll_commands&esp32_id=" + ESP32_ID;
  http.begin(url);
  http.addHeader("apikey", supabaseApiKey);
  http.addHeader("Authorization", String("Bearer ") + supabaseApiKey);

  int code = http.GET();
  if (code != 200) {
    http.end();
    return;
  }

  String payload = http.getString();
  http.end();

  StaticJsonDocument<4096> doc;
  if (deserializeJson(doc, payload)) return;

  JsonArray commands = doc["commands"].as<JsonArray>();
  if (commands.isNull()) return;

  for (JsonObject cmd : commands) {
    const char* action = cmd["action"] | "";
    const char* cmdId = cmd["id"] | "";
    if (strcmp(action, "credito") != 0 || strlen(cmdId) == 0) continue;

    int valor = cmd["valor_centavos"] | 0;
    if (valor <= 0 && cmd.containsKey("payload")) {
      JsonObject payloadObj = cmd["payload"];
      valor = payloadObj["valor_centavos"] | 0;
    }

    if (valor > 0 && inserirCredito(valor)) {
      confirmCommand(cmdId);
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);
  buildEsp32Id();

  for (int i = 0; i < NUM_MOEDAS; i++) {
    pinMode(PINOS_MOEDAS[i], OUTPUT);
    digitalWrite(PINOS_MOEDAS[i], LOW);
  }

  connectWiFi();
  sendHeartbeat();
  lastHeartbeat = millis();
  lastPoll = millis();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    delay(2000);
    return;
  }

  unsigned long now = millis();
  if (now - lastHeartbeat >= HEARTBEAT_INTERVAL) {
    sendHeartbeat();
    lastHeartbeat = now;
  }
  if (now - lastPoll >= POLL_INTERVAL) {
    pollCommands();
    lastPoll = now;
  }
  delay(50);
}
