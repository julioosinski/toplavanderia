/**
 * ESP32 Lavadora Individual - Sistema de Controle
 * Versão: 2.0.2 - CORRIGIDA
 * 
 * CONFIGURAÇÃO OBRIGATÓRIA:
 * - Configure seu WiFi nas linhas 23-24
 * - Configure o LAUNDRY_ID na linha 31 (ID da sua lavanderia)
 * - Configure o ESP32_ID na linha 32 (identificador único deste ESP32)
 */

#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ================== CONFIGURAÇÕES WIFI ==================
// ⚠️ IMPORTANTE: Configure aqui suas credenciais WiFi
const char* ssid = "SEU_WIFI_AQUI";           // Trocar pelo nome da sua rede WiFi
const char* password = "SUA_SENHA_AQUI";      // Trocar pela senha do seu WiFi

// ================== IDENTIFICAÇÃO ==================
// ⚠️ IMPORTANTE: Configure aqui os IDs corretos
#define MACHINE_ID "lavadora_01"               // ID da máquina (não mudar sem necessidade)
#define MACHINE_NAME "Lavadora 01"             // Nome amigável da máquina
#define MACHINE_TYPE "lavadora"                // Tipo: "lavadora" ou "secadora"
#define LAUNDRY_ID "8ace0bcb-83a9-4555-a712-63ef5f52e709"  // ⚠️ ID DA SUA LAVANDERIA
#define ESP32_ID "main"                        // ⚠️ ID único deste ESP32

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
  Serial.println("\n\n========================================");
  Serial.println("ESP32 Lavadora Individual v2.0.2");
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
  Serial.println("========================================\n");
  
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
  Serial.printf("   SSID: %s\n", ssid);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi conectado com sucesso!");
    Serial.printf("   IP: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("   Sinal: %d dBm\n", WiFi.RSSI());
  } else {
    Serial.println("\n❌ Falha ao conectar WiFi!");
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
  html += "<div class='status'><span class='label'>Máquina:</span><span class='value'>" + String(MACHINE_ID) + "</span></div>";
  html += "<div class='status'><span class='label'>Tipo:</span><span class='value'>" + String(MACHINE_TYPE) + "</span></div>";
  html += "<div class='status'><span class='label'>Lavanderia:</span><span class='value'>" + String(LAUNDRY_ID) + "</span></div>";
  html += "<div class='status'><span class='label'>IP:</span><span class='value'>" + WiFi.localIP().toString() + "</span></div>";
  html += "<div class='status'><span class='label'>Sinal WiFi:</span><span class='value'>" + String(WiFi.RSSI()) + " dBm</span></div>";
  html += "<div class='status'><span class='label'>Status:</span><span class='value ";
  html += machineRunning ? "online'>▶️ RODANDO" : "offline'>⏹️ PARADA";
  html += "</span></div>";
  html += "<div class='status'><span class='label'>Relé:</span><span class='value'>" + String(relayState ? "LIGADO ✅" : "DESLIGADO ⭕") + "</span></div>";
  html += "<div style='margin-top:20px'>";
  html += "<button onclick=\"fetch('/start',{method:'POST'}).then(()=>location.reload())\">▶️ Iniciar</button>";
  html += "<button class='stop' onclick=\"fetch('/stop',{method:'POST'}).then(()=>location.reload())\">⏹️ Parar</button>";
  html += "</div></div></body></html>";
  
  server.send(200, "text/html", html);
}

void handleStatus() {
  StaticJsonDocument<512> doc;
  doc["esp32_id"] = ESP32_ID;
  doc["machine_id"] = MACHINE_ID;
  doc["machine_type"] = MACHINE_TYPE;
  doc["laundry_id"] = LAUNDRY_ID;
  doc["ip_address"] = WiFi.localIP().toString();
  doc["signal_strength"] = WiFi.RSSI();
  doc["network_status"] = "connected";
  doc["firmware_version"] = "v2.0.2";
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
  
  server.send(200, "application/json", "{\"success\":true,\"message\":\"Máquina iniciada\"}");
  Serial.println("✅ Máquina iniciada com sucesso");
  sendHeartbeat();  // Enviar status atualizado imediatamente
}

void handleStop() {
  Serial.println("⏹️ Comando STOP recebido");
  relayState = false;
  machineRunning = false;
  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(LED_PIN, LOW);
  
  server.send(200, "application/json", "{\"success\":true,\"message\":\"Máquina parada\"}");
  Serial.println("✅ Máquina parada com sucesso");
  sendHeartbeat();  // Enviar status atualizado imediatamente
}

void handleNotFound() {
  server.send(404, "application/json", "{\"error\":\"Rota não encontrada\"}");
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
  
  Serial.println("\n📡 Enviando heartbeat...");
  Serial.println("URL: " + url);
  
  // Preparar JSON
  StaticJsonDocument<512> doc;
  doc["esp32_id"] = ESP32_ID;
  doc["laundry_id"] = LAUNDRY_ID;
  doc["machine_type"] = MACHINE_TYPE;
  doc["ip_address"] = WiFi.localIP().toString();
  doc["signal_strength"] = WiFi.RSSI();
  doc["network_status"] = "connected";
  doc["firmware_version"] = "v2.0.2";
  doc["uptime_seconds"] = millis() / 1000;
  doc["is_active"] = machineRunning;
  doc["relay_status"] = relayState ? "on" : "off";
  
  String payload;
  serializeJson(doc, payload);
  Serial.println("Payload: " + payload);
  
  // Fazer requisição
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", supabaseApiKey);
  
  int httpCode = http.POST(payload);
  
  if (httpCode > 0) {
    Serial.printf("✅ Heartbeat enviado - HTTP %d\n", httpCode);
    String response = http.getString();
    Serial.println("Resposta: " + response);
    lastHeartbeat = millis();
  } else {
    Serial.printf("❌ Erro no heartbeat - HTTP %d\n", httpCode);
    Serial.println("Erro: " + http.errorToString(httpCode));
  }
  
  http.end();
  Serial.println();
}
