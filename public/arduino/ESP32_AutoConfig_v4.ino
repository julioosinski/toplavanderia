/*
 * ========================================
 * ESP32 AutoConfig v4.0 - Top Lavanderia
 * Plug-and-Play (sem AP/BLE)
 * ========================================
 * 
 * Este firmware é gerado automaticamente pelo painel admin.
 * WiFi e Laundry ID já vêm pré-configurados.
 * 
 * Fluxo:
 * 1. Liga → Conecta WiFi automaticamente
 * 2. Envia heartbeat com auto_register=true
 * 3. Aparece no painel admin como "Pendente"
 * 4. Admin aprova e cria máquina automaticamente
 * 5. ESP32 começa polling de comandos
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ============================================
// CONFIGURAÇÕES PRÉ-DEFINIDAS (geradas pelo painel)
// NÃO EDITE MANUALMENTE - use o painel admin
// ============================================
const char* WIFI_SSID     = "{{WIFI_SSID}}";
const char* WIFI_PASSWORD = "{{WIFI_PASSWORD}}";
const char* LAUNDRY_ID    = "{{LAUNDRY_ID}}";
const char* SUPABASE_URL  = "{{SUPABASE_URL}}";
const char* SUPABASE_KEY  = "{{SUPABASE_KEY}}";
// ============================================

// Gerar ESP32 ID a partir do MAC (inicializa WiFi primeiro!)
String esp32_id = "";
String deviceName = "";

// URLs das edge functions
String heartbeatUrl = "";
String pollUrl = "";
String confirmUrl = "";

// Configurações de timing
const unsigned long HEARTBEAT_INTERVAL = 30000;  // 30s
const unsigned long POLL_INTERVAL = 5000;         // 5s
const unsigned long WIFI_RETRY_INTERVAL = 10000;  // 10s
const int MAX_WIFI_RETRIES = 50;

// Variáveis de controle
unsigned long lastHeartbeat = 0;
unsigned long lastPoll = 0;
bool isRegistered = false;

// Pinos de relé (até 4 por ESP32)
const int RELAY_PINS[] = {2, 4, 5, 18};
const int NUM_RELAYS = 4;

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("========================================");
  Serial.println("ESP32 AutoConfig v4.0 - Top Lavanderia");
  Serial.println("Modo: Plug-and-Play (sem AP)");
  Serial.println("========================================");
  
  // Inicializar pinos de relé
  for (int i = 0; i < NUM_RELAYS; i++) {
    pinMode(RELAY_PINS[i], OUTPUT);
    digitalWrite(RELAY_PINS[i], LOW);
  }
  
  // IMPORTANTE: Inicializar WiFi ANTES de gerar o ID
  // Isso corrige o bug esp32_000000
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  // Gerar ESP32 ID pelo MAC (agora o MAC está correto)
  uint8_t mac[6];
  WiFi.macAddress(mac);
  char macStr[7];
  sprintf(macStr, "%02X%02X%02X", mac[3], mac[4], mac[5]);
  esp32_id = "esp32_" + String(macStr);
  deviceName = "TopLav_" + String(macStr);
  
  Serial.println("🆔 ESP32 ID: " + esp32_id);
  Serial.println("📛 Device: " + deviceName);
  Serial.println("📡 WiFi SSID: " + String(WIFI_SSID));
  Serial.println("🏭 Laundry ID: " + String(LAUNDRY_ID));
  
  // Montar URLs
  String baseUrl = String(SUPABASE_URL) + "/functions/v1/";
  heartbeatUrl = baseUrl + "esp32-monitor?action=heartbeat";
  pollUrl = baseUrl + "esp32-monitor?action=poll_commands&esp32_id=" + esp32_id;
  confirmUrl = baseUrl + "esp32-monitor?action=confirm_command";
  
  // Aguardar conexão WiFi
  Serial.print("🔌 Conectando ao WiFi");
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < MAX_WIFI_RETRIES) {
    delay(500);
    Serial.print(".");
    retries++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi conectado!");
    Serial.println("   IP: " + WiFi.localIP().toString());
    Serial.println("   RSSI: " + String(WiFi.RSSI()) + " dBm");
    
    // Enviar primeiro heartbeat imediatamente (com auto_register)
    sendHeartbeat(true);
  } else {
    Serial.println("\n❌ Falha no WiFi. Tentando novamente no loop...");
  }
  
  Serial.println("========================================");
}

void loop() {
  unsigned long now = millis();
  
  // Verificar WiFi
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ WiFi desconectado. Reconectando...");
    WiFi.reconnect();
    delay(WIFI_RETRY_INTERVAL);
    return;
  }
  
  // Heartbeat periódico
  if (now - lastHeartbeat >= HEARTBEAT_INTERVAL) {
    sendHeartbeat(false);
    lastHeartbeat = now;
  }
  
  // Polling de comandos
  if (now - lastPoll >= POLL_INTERVAL) {
    pollCommands();
    lastPoll = now;
  }
}

void sendHeartbeat(bool autoRegister) {
  HTTPClient http;
  http.begin(heartbeatUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
  
  // Montar JSON do heartbeat
  StaticJsonDocument<512> doc;
  doc["esp32_id"] = esp32_id;
  doc["laundry_id"] = LAUNDRY_ID;
  doc["device_name"] = deviceName;
  doc["ip_address"] = WiFi.localIP().toString();
  doc["signal_strength"] = WiFi.RSSI();
  doc["firmware_version"] = "v4.0";
  doc["uptime_seconds"] = millis() / 1000;
  doc["network_status"] = "connected";
  
  if (autoRegister) {
    doc["auto_register"] = true;
  }
  
  // Relay status
  JsonObject relays = doc.createNestedObject("relay_status");
  for (int i = 0; i < NUM_RELAYS; i++) {
    relays["pin_" + String(RELAY_PINS[i])] = digitalRead(RELAY_PINS[i]) == HIGH ? "on" : "off";
  }
  
  String jsonStr;
  serializeJson(doc, jsonStr);
  
  int httpCode = http.POST(jsonStr);
  
  if (httpCode == 200) {
    String response = http.getString();
    Serial.println("💓 Heartbeat OK" + String(autoRegister ? " (auto_register)" : ""));
    
    // Verificar se foi aprovado
    StaticJsonDocument<256> respDoc;
    if (deserializeJson(respDoc, response) == DeserializationError::Ok) {
      if (respDoc.containsKey("registration_status")) {
        String status = respDoc["registration_status"].as<String>();
        isRegistered = (status == "approved");
        if (!isRegistered) {
          Serial.println("⏳ Status: " + status + " (aguardando aprovação)");
        }
      }
    }
  } else {
    Serial.println("❌ Heartbeat falhou: " + String(httpCode));
  }
  
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
      
      if (commands.size() > 0) {
        Serial.println("📨 " + String(commands.size()) + " comando(s) recebido(s)");
      }
      
      for (JsonObject cmd : commands) {
        String commandId = cmd["id"].as<String>();
        String action = cmd["action"].as<String>();
        int relayPin = cmd["relay_pin"].as<int>();
        
        Serial.println("⚡ Executando: " + action + " no pino " + String(relayPin));
        
        bool success = executeCommand(action, relayPin);
        confirmCommand(commandId, success);
      }
    }
  }
  
  http.end();
}

bool executeCommand(String action, int relayPin) {
  // Verificar se o pino é válido
  bool validPin = false;
  for (int i = 0; i < NUM_RELAYS; i++) {
    if (RELAY_PINS[i] == relayPin) {
      validPin = true;
      break;
    }
  }
  
  if (!validPin) {
    Serial.println("❌ Pino inválido: " + String(relayPin));
    return false;
  }
  
  if (action == "activate" || action == "turn_on") {
    digitalWrite(relayPin, HIGH);
    Serial.println("✅ Relé " + String(relayPin) + " LIGADO");
    return true;
  } else if (action == "deactivate" || action == "turn_off") {
    digitalWrite(relayPin, LOW);
    Serial.println("✅ Relé " + String(relayPin) + " DESLIGADO");
    return true;
  }
  
  Serial.println("❌ Ação desconhecida: " + action);
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
  
  int httpCode = http.POST(jsonStr);
  
  if (httpCode == 200) {
    Serial.println("✅ Comando " + commandId + " confirmado");
  } else {
    Serial.println("❌ Falha ao confirmar comando: " + String(httpCode));
  }
  
  http.end();
}
