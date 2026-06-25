/**
 * ESP32 Máquina de Café — Top Lavanderia
 * Perfil: coin_dispense — action "credito" via pending_commands (esp32-monitor)
 *
 * Placeholders: __LAUNDRY_ID__, __MACHINE_NAME__
 * Pinos moedeiro (MOSFET 2N7000 → GND no moedeiro):
 *   GPIO 19 = R$ 1,00 (pino 10) | GPIO 2 = R$ 0,50 (pino 9)
 *   GPIO 23 = R$ 0,10 (pino 7)  | GPIO 4 = R$ 0,25 (pino 8, inutilizado)
 * Pulso: 100 ms | intervalo entre moedas: 300 ms
 *
 * Wi-Fi: portal TopLavanderia-{ESP32_ID} (senha toplav123) — /wifi — reconexão + OTA remoto
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <cstring>
#include <cstdio>

#include "esp32_wifi_ota_common.h"

#define FIRMWARE_VERSION "v1.1.0-toplav-cafe"

#define LAUNDRY_ID "__LAUNDRY_ID__"
#define MACHINE_NAME "__MACHINE_NAME__"

const char* supabaseUrl = "https://rkdybjzwiwwqqzjfmerm.supabase.co";
const char* supabaseApiKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZHlianp3aXd3cXF6amZtZXJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMDgxNjcsImV4cCI6MjA2ODg4NDE2N30.CnRP8lrmGmvcbHmWdy72ZWlfZ28cDdNoxdADnyFAOXg";

const unsigned long HTTP_TIMEOUT_MS = 15000;

char ESP32_ID[16];

unsigned long lastHeartbeat = 0;
unsigned long lastPoll = 0;
const unsigned long HEARTBEAT_INTERVAL_MS = 30000;
const unsigned long POLL_INTERVAL_MS = 5000;

bool inserindoCredito = false;

// Cada MOSFET conecta o pino do moedeiro ao GND (HIGH = moeda, LOW = repouso)
const int PINO_MOEDA_010 = 23;  // R$ 0,10 (pino 7 do moedeiro)
const int PINO_MOEDA_025 = 4;   // R$ 0,25 (pino 8 — inutilizado no algoritmo)
const int PINO_MOEDA_050 = 2;   // R$ 0,50 (pino 9 do moedeiro)
const int PINO_MOEDA_100 = 19;  // R$ 1,00 (pino 10 do moedeiro)

// Moeda de R$ 0,25 inutilizada — combinação ótima só com 100, 50 e 10 centavos
const int VALOR_MOEDAS[] = {100, 50, 10};
const int PINOS_MOEDAS[] = {PINO_MOEDA_100, PINO_MOEDA_050, PINO_MOEDA_010};
const int NUM_MOEDAS = 3;
const int TEMPO_PULSO_MOEDA = 100;   // 100 ms por pulso (simula inserção)
const int TEMPO_ENTRE_MOEDAS = 300;  // 300 ms entre moedas

void buildEsp32Id() {
  // WiFi deve estar inicializado antes de ler o MAC (senão vira esp32_03000000).
  WiFi.mode(WIFI_STA);
  delay(100);
  uint8_t mac[6];
  WiFi.macAddress(mac);
  snprintf(ESP32_ID, sizeof(ESP32_ID), "esp32_%02x%02x%02x%02x", mac[2], mac[3], mac[4], mac[5]);
}

void initMoedeiroPins() {
  for (int i = 0; i < NUM_MOEDAS; i++) {
    pinMode(PINOS_MOEDAS[i], OUTPUT);
    digitalWrite(PINOS_MOEDAS[i], LOW);
  }
  pinMode(PINO_MOEDA_025, OUTPUT);
  digitalWrite(PINO_MOEDA_025, LOW);
  Serial.println("Pinos moedeiro OK:");
  Serial.println("   GPIO 19 -> R$ 1,00 (Moeda D)");
  Serial.println("   GPIO 2  -> R$ 0,50 (Moeda C)");
  Serial.println("   GPIO 23 -> R$ 0,10 (Moeda A)");
  Serial.println("   GPIO 4  -> R$ 0,25 (Moeda B) — nao utilizada");
}

void setupDeviceHttpRoutes() {
  esp32HttpServer().on("/status", HTTP_GET, []() {
    StaticJsonDocument<384> doc;
    doc["esp32_id"] = ESP32_ID;
    doc["device"] = MACHINE_NAME;
    doc["firmware_version"] = FIRMWARE_VERSION;
    doc["device_profile"] = "coin_dispense";
    doc["ip"] = WiFi.localIP().toString();
    doc["rssi"] = WiFi.RSSI();
    doc["online"] = true;
    String out;
    serializeJson(doc, out);
    esp32HttpServer().sendHeader("Access-Control-Allow-Origin", "*");
    esp32HttpServer().send(200, "application/json", out);
  });
}

bool inserirCredito(int valor_centavos) {
  if (valor_centavos <= 0) {
    Serial.println("Valor invalido para insercao de credito");
    return false;
  }

  inserindoCredito = true;
  Serial.printf("\nINSERINDO CREDITO: R$ %.2f (%d centavos)\n",
                valor_centavos / 100.0, valor_centavos);

  int valor_restante = valor_centavos;
  int total_inserido = 0;
  int contagem_moedas[NUM_MOEDAS] = {0, 0, 0};

  for (int i = 0; i < NUM_MOEDAS; i++) {
    while (valor_restante >= VALOR_MOEDAS[i]) {
      contagem_moedas[i]++;
      valor_restante -= VALOR_MOEDAS[i];
    }
  }
  if (valor_restante > 0) {
    Serial.printf("Restam %d centavos — arredondando com moedas de R$ 0,10\n", valor_restante);
    contagem_moedas[2] += (valor_restante + 9) / 10;
    valor_restante = 0;
  }

  Serial.println("Plano de insercao:");
  if (contagem_moedas[0] > 0) Serial.printf("   %dx R$ 1,00 (GPIO %d)\n", contagem_moedas[0], PINO_MOEDA_100);
  if (contagem_moedas[1] > 0) Serial.printf("   %dx R$ 0,50 (GPIO %d)\n", contagem_moedas[1], PINO_MOEDA_050);
  if (contagem_moedas[2] > 0) Serial.printf("   %dx R$ 0,10 (GPIO %d)\n", contagem_moedas[2], PINO_MOEDA_010);

  for (int i = 0; i < NUM_MOEDAS; i++) {
    for (int j = 0; j < contagem_moedas[i]; j++) {
      Serial.printf("Pulso R$ %.2f: GPIO %d HIGH %dms\n",
                    VALOR_MOEDAS[i] / 100.0, PINOS_MOEDAS[i], TEMPO_PULSO_MOEDA);
      digitalWrite(PINOS_MOEDAS[i], HIGH);
      delay(TEMPO_PULSO_MOEDA);
      digitalWrite(PINOS_MOEDAS[i], LOW);
      total_inserido += VALOR_MOEDAS[i];
      delay(TEMPO_ENTRE_MOEDAS);
    }
  }

  Serial.printf("Credito inserido: R$ %.2f\n\n", total_inserido / 100.0);
  inserindoCredito = false;
  return true;
}

void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(supabaseUrl) + "/functions/v1/esp32-monitor?action=heartbeat";
  http.begin(url);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", supabaseApiKey);
  http.addHeader("Authorization", String("Bearer ") + supabaseApiKey);

  StaticJsonDocument<512> doc;
  doc["esp32_id"] = ESP32_ID;
  doc["laundry_id"] = LAUNDRY_ID;
  doc["device_name"] = MACHINE_NAME;
  doc["firmware_version"] = FIRMWARE_VERSION;
  doc["device_profile"] = "coin_dispense";
  doc["ip_address"] = WiFi.localIP().toString();
  doc["signal_strength"] = WiFi.RSSI();
  doc["network_status"] = "connected";
  doc["auto_register"] = true;
  doc["uptime_seconds"] = millis() / 1000UL;

  String body;
  serializeJson(doc, body);
  int code = http.POST(body);
  String response = http.getString();
  http.end();

  Serial.printf("Heartbeat HTTP %d", code);
  if (code == 200) {
    Serial.println(" — registrado/pending no painel");
  } else {
    Serial.printf(" — resposta: %s\n", response.substring(0, 120).c_str());
  }
}

void confirmCommand(const char* commandId) {
  HTTPClient http;
  String url = String(supabaseUrl) + "/functions/v1/esp32-monitor?action=confirm_command";
  http.begin(url);
  http.setTimeout(HTTP_TIMEOUT_MS);
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
  Serial.printf("Confirm %s HTTP %d\n", commandId, code);
}

void pollCommands() {
  if (WiFi.status() != WL_CONNECTED || inserindoCredito) return;

  HTTPClient http;
  String url = String(supabaseUrl) + "/functions/v1/esp32-monitor?action=poll_commands&esp32_id=" + ESP32_ID;
  http.begin(url);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("apikey", supabaseApiKey);
  http.addHeader("Authorization", String("Bearer ") + supabaseApiKey);

  int code = http.GET();
  if (code != 200) {
    Serial.printf("Poll comandos HTTP %d\n", code);
    http.end();
    return;
  }

  String payload = http.getString();
  http.end();

  StaticJsonDocument<4096> doc;
  if (deserializeJson(doc, payload)) return;

  JsonArray commands = doc["commands"].as<JsonArray>();
  if (commands.isNull() || commands.size() == 0) return;

  for (JsonObject cmd : commands) {
    const char* action = cmd["action"] | "";
    const char* cmdId = cmd["id"] | "";
    if ((strcmp(action, "credito") != 0 && strcmp(action, "liberar") != 0) || strlen(cmdId) == 0) {
      continue;
    }

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
  delay(1500);

  Serial.println();
  Serial.println("=================================");
  Serial.println(" ESP32 Cafe — Top Lavanderia");
  Serial.printf(" Firmware %s\n", FIRMWARE_VERSION);
  Serial.println("=================================");

  buildEsp32Id();
  Serial.printf(" ESP32_ID: %s\n", ESP32_ID);
  Serial.printf(" LAUNDRY_ID: %s\n", LAUNDRY_ID);
  Serial.printf(" Nome: %s\n", MACHINE_NAME);

  initMoedeiroPins();
  esp32WifiOtaRegisterPortalRoutes();
  setupDeviceHttpRoutes();
  esp32WifiOtaBegin();

  Serial.println("Enviando heartbeat inicial...");
  sendHeartbeat();
  lastHeartbeat = millis();
  lastPoll = millis();
  Serial.println("Sistema pronto.\n");
}

void loop() {
  if (!esp32WifiOtaMaintain()) {
    delay(10);
    return;
  }

  unsigned long now = millis();
  if (now - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
    sendHeartbeat();
    lastHeartbeat = now;
  }
  if (now - lastPoll >= POLL_INTERVAL_MS) {
    pollCommands();
    lastPoll = now;
  }
  delay(50);
}
