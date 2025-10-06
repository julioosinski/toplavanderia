/*
 * ESP32 Lavanderia - Lavadora Individual
 * Controle de 1 relé para lavadora
 * Versão: v2.0.1 - CORRIGIDO PARA SUPABASE
 * 
 * Configuração:
 * - Pino do relé: GPIO 2
 * - Ciclo padrão: 30 minutos (1800000ms)
 * - Interface web para monitoramento
 * - Integração com sistema Supabase
 * 
 * IMPORTANTE: Configure as variáveis abaixo antes de usar!
 */

#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <esp_task_wdt.h>

// ==================== CONFIGURAÇÕES ====================
// CONFIGURE AQUI SUAS INFORMAÇÕES DE REDE
const char* ssid = "2G Osinski";
const char* password = "10203040";

// URL do sistema Supabase
const char* systemURL = "https://rkdybjzwiwwqqzjfmerm.supabase.co/functions/v1/esp32-monitor";

// ⚠️ CONFIGURE A SUA API KEY DO SUPABASE AQUI ⚠️
const char* supabaseApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZHliand3aXd3cXF6amZtZXJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzczODI1OTgsImV4cCI6MjA1Mjk1ODU5OH0.t1wXTIwQqKUFWiLWr9i2Apu0fhC6gH6FpFDHyoJ6KfY";

// ⚠️ CONFIGURE O LAUNDRY_ID DO SEU SISTEMA ⚠️
const char* laundryId = "8ace0bcb-83a9-4555-a712-63ef5f52e709";

// Configurações da máquina
#define RELAY_PIN 2                    // Pino do relé (GPIO 2)
#define MACHINE_TYPE "lavadora"        // Tipo da máquina
#define MACHINE_ID "lavadora_01"       // ID da máquina individual
#define ESP32_ID "main"                // ID único do ESP32 (use "main" para o principal)
#define CYCLE_DURATION 1800000         // Duração do ciclo em ms (30 minutos)
#define WDT_TIMEOUT 60                 // Watchdog timeout em segundos

// ==================== VARIÁVEIS GLOBAIS ====================
WebServer server(80);
bool machineActive = false;
unsigned long activationTime = 0;
unsigned long lastHeartbeat = 0;
const unsigned long heartbeatInterval = 30000; // 30 segundos

// ==================== SETUP ====================
void setup() {
  Serial.begin(115200);
  Serial.println("\n=== ESP32 Lavanderia - Lavadora ===");
  Serial.println("Versão: v2.0.1 - CORRIGIDO");
  Serial.println("Máquina: " + String(MACHINE_ID));
  Serial.println("ESP32 ID: " + String(ESP32_ID));
  Serial.println("Laundry ID: " + String(laundryId));
  
  // Configurar pino do relé
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
  Serial.println("Relé configurado no pino: " + String(RELAY_PIN));
  
  // Configurar watchdog timer
  setupWatchdog();
  
  // Conectar ao WiFi
  connectToWiFi();
  
  // Configurar rotas do servidor web
  setupWebServer();
  
  Serial.println("ESP32 Lavadora iniciado com sucesso!");
  Serial.println("IP: " + WiFi.localIP().toString());
  Serial.println("Acesse: http://" + WiFi.localIP().toString());
}

// ==================== LOOP PRINCIPAL ====================
void loop() {
  server.handleClient();
  esp_task_wdt_reset(); // Reset watchdog
  
  // Verificar se o ciclo terminou
  checkMachineTimer();
  
  // Enviar heartbeat periódico
  if (millis() - lastHeartbeat > heartbeatInterval) {
    sendHeartbeat();
    lastHeartbeat = millis();
  }
  
  delay(100);
}

// ==================== FUNÇÕES DE CONFIGURAÇÃO ====================
void setupWatchdog() {
  esp_task_wdt_config_t wdt_config = {
    .timeout_ms = WDT_TIMEOUT * 1000,
    .idle_core_mask = (1 << portNUM_PROCESSORS) - 1,
    .trigger_panic = true
  };
  esp_task_wdt_init(&wdt_config);
  esp_task_wdt_add(NULL);
  Serial.println("Watchdog configurado: " + String(WDT_TIMEOUT) + "s");
}

void connectToWiFi() {
  WiFi.begin(ssid, password);
  Serial.print("Conectando ao WiFi");
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(1000);
    Serial.print(".");
    attempts++;
    esp_task_wdt_reset();
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi conectado!");
    Serial.println("IP: " + WiFi.localIP().toString());
    Serial.println("RSSI: " + String(WiFi.RSSI()) + " dBm");
  } else {
    Serial.println("\nFalha na conexão WiFi!");
    Serial.println("Reiniciando em 10 segundos...");
    delay(10000);
    ESP.restart();
  }
}

void setupWebServer() {
  // Rotas principais
  server.on("/", HTTP_GET, handleRoot);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/activate", HTTP_POST, handleActivate);
  server.on("/deactivate", HTTP_POST, handleDeactivate);
  server.on("/heartbeat", HTTP_POST, handleHeartbeat);
  server.onNotFound(handleNotFound);
  
  // Habilitar CORS
  server.enableCORS(true);
  
  server.begin();
  Serial.println("Servidor web iniciado na porta 80");
}

// ==================== HANDLERS DO SERVIDOR WEB ====================
void handleRoot() {
  String html = generateMainPage();
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "text/html", html);
}

void handleStatus() {
  DynamicJsonDocument doc(1024);
  doc["machine_id"] = MACHINE_ID;
  doc["machine_type"] = MACHINE_TYPE;
  doc["esp32_id"] = ESP32_ID;
  doc["laundry_id"] = laundryId;
  doc["ip_address"] = WiFi.localIP().toString();
  doc["signal_strength"] = WiFi.RSSI();
  doc["network_status"] = WiFi.status() == WL_CONNECTED ? "connected" : "disconnected";
  doc["firmware_version"] = "v2.0.1";
  doc["uptime_seconds"] = millis() / 1000;
  doc["free_heap"] = ESP.getFreeHeap();
  doc["wifi_ssid"] = WiFi.SSID();
  doc["is_active"] = machineActive;
  doc["relay_status"] = machineActive ? "on" : "off";
  
  if (machineActive) {
    unsigned long remaining = (activationTime + CYCLE_DURATION - millis()) / 1000;
    doc["time_remaining"] = remaining;
    doc["activation_time"] = activationTime;
  }
  
  String response;
  serializeJson(doc, response);
  
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", response);
}

void handleActivate() {
  if (server.method() == HTTP_OPTIONS) {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
    server.send(200);
    return;
  }
  
  DynamicJsonDocument doc(512);
  DeserializationError error = deserializeJson(doc, server.arg("plain"));
  
  if (error) {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(400, "application/json", "{\"success\":false,\"message\":\"JSON inválido\"}");
    return;
  }
  
  String transactionId = doc["transaction_id"] | "unknown";
  float amount = doc["amount"] | 0.0;
  
  bool success = activateMachine(transactionId, amount);
  
  DynamicJsonDocument response(512);
  response["success"] = success;
  response["message"] = success ? "Lavadora ativada com sucesso" : "Falha na ativação";
  response["transaction_id"] = transactionId;
  response["amount"] = amount;
  response["machine_id"] = MACHINE_ID;
  response["activation_time"] = String(millis());
  
  String responseStr;
  serializeJson(response, responseStr);
  
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(success ? 200 : 500, "application/json", responseStr);
}

void handleDeactivate() {
  machineActive = false;
  digitalWrite(RELAY_PIN, LOW);
  
  Serial.println("Lavadora desativada manualmente");
  
  DynamicJsonDocument response(512);
  response["success"] = true;
  response["message"] = "Lavadora desativada";
  response["machine_id"] = MACHINE_ID;
  response["deactivation_time"] = String(millis());
  
  String responseStr;
  serializeJson(response, responseStr);
  
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", responseStr);
}

void handleHeartbeat() {
  DynamicJsonDocument response(512);
  response["status"] = "ok";
  response["machine_id"] = MACHINE_ID;
  response["timestamp"] = String(millis());
  response["next_heartbeat"] = heartbeatInterval / 1000;
  
  String responseStr;
  serializeJson(response, responseStr);
  
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", responseStr);
}

void handleNotFound() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(404, "text/plain", "Endpoint não encontrado");
}

// ==================== FUNÇÕES DE CONTROLE ====================
bool activateMachine(String transactionId, float amount) {
  if (machineActive) {
    Serial.println("Lavadora já está ativa");
    return false;
  }
  
  machineActive = true;
  activationTime = millis();
  digitalWrite(RELAY_PIN, HIGH);
  
  Serial.println("=== LAVADORA ATIVADA ===");
  Serial.println("ID: " + String(MACHINE_ID));
  Serial.println("Transação: " + transactionId);
  Serial.println("Valor: R$ " + String(amount));
  Serial.println("Tempo: " + String(millis()));
  
  return true;
}

void checkMachineTimer() {
  if (machineActive && (millis() - activationTime >= CYCLE_DURATION)) {
    machineActive = false;
    digitalWrite(RELAY_PIN, LOW);
    
    Serial.println("=== CICLO FINALIZADO ===");
    Serial.println("Lavadora desativada automaticamente");
    Serial.println("Duração total: " + String(CYCLE_DURATION / 1000) + " segundos");
  }
}

// ==================== HEARTBEAT CORRIGIDO ====================
void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ WiFi desconectado - heartbeat cancelado");
    return;
  }
  
  HTTPClient http;
  http.begin(String(systemURL) + "?action=heartbeat");
  
  // ✅ ADICIONADO: Header com API Key do Supabase
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", supabaseApiKey);
  http.addHeader("Authorization", "Bearer " + String(supabaseApiKey));
  http.setTimeout(5000);
  
  DynamicJsonDocument doc(1024);
  
  // ✅ CORRIGIDO: Usando ESP32_ID ao invés de MACHINE_ID
  doc["esp32_id"] = ESP32_ID;
  
  // ✅ ADICIONADO: laundry_id obrigatório
  doc["laundry_id"] = laundryId;
  
  doc["machine_type"] = MACHINE_TYPE;
  doc["ip_address"] = WiFi.localIP().toString();
  doc["signal_strength"] = WiFi.RSSI();
  doc["network_status"] = "connected";
  doc["firmware_version"] = "v2.0.1";
  doc["uptime_seconds"] = millis() / 1000;
  doc["is_active"] = machineActive;
  
  // ✅ ADICIONADO: relay_status
  doc["relay_status"] = machineActive ? "on" : "off";
  
  if (machineActive) {
    unsigned long remaining = (activationTime + CYCLE_DURATION - millis()) / 1000;
    doc["time_remaining"] = remaining;
  }
  
  String payload;
  serializeJson(doc, payload);
  
  Serial.println("\n📡 Enviando heartbeat...");
  Serial.println("URL: " + String(systemURL) + "?action=heartbeat");
  Serial.println("Payload: " + payload);
  
  int httpResponseCode = http.POST(payload);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println("✅ Heartbeat enviado com sucesso!");
    Serial.println("Código: " + String(httpResponseCode));
    Serial.println("Resposta: " + response);
  } else {
    Serial.println("❌ Erro no heartbeat!");
    Serial.println("Código: " + String(httpResponseCode));
    Serial.println("Erro: " + http.errorToString(httpResponseCode));
  }
  
  http.end();
}

// ==================== INTERFACE WEB ====================
String generateMainPage() {
  String html = "<!DOCTYPE html><html><head>";
  html += "<meta charset='UTF-8'>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1.0'>";
  html += "<title>ESP32 Lavadora - " + String(MACHINE_ID) + "</title>";
  html += "<style>";
  html += "body{font-family:Arial,sans-serif;margin:0;padding:20px;background:#f0f2f5;}";
  html += ".container{max-width:800px;margin:0 auto;background:white;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.1);overflow:hidden;}";
  html += ".header{background:#2c3e50;color:white;padding:20px;text-align:center;}";
  html += ".status-card{margin:20px;padding:20px;border-radius:8px;border-left:4px solid #3498db;}";
  html += ".status-card.active{border-left-color:#27ae60;background:#d5f4e6;}";
  html += ".status-card.inactive{border-left-color:#e74c3c;background:#fdf2f2;}";
  html += ".btn{padding:12px 24px;margin:10px;border:none;border-radius:5px;cursor:pointer;font-size:16px;transition:all 0.3s;}";
  html += ".btn-primary{background:#3498db;color:white;}";
  html += ".btn-success{background:#27ae60;color:white;}";
  html += ".btn-danger{background:#e74c3c;color:white;}";
  html += ".btn:hover{opacity:0.8;transform:translateY(-2px);}";
  html += ".info-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px;margin:20px;}";
  html += ".info-item{background:#f8f9fa;padding:15px;border-radius:5px;text-align:center;}";
  html += ".info-label{font-weight:bold;color:#666;font-size:14px;}";
  html += ".info-value{font-size:18px;color:#333;margin-top:5px;}";
  html += ".config-info{background:#fff3cd;border-left:4px solid:#ffc107;padding:15px;margin:20px;border-radius:5px;}";
  html += "</style></head><body>";
  
  html += "<div class='container'>";
  html += "<div class='header'>";
  html += "<h1>🏠 ESP32 Lavadora</h1>";
  html += "<p>Máquina: " + String(MACHINE_ID) + " | ESP32: " + String(ESP32_ID) + "</p>";
  html += "<p>IP: " + WiFi.localIP().toString() + "</p>";
  html += "</div>";
  
  // Informações de configuração
  html += "<div class='config-info'>";
  html += "<strong>⚙️ Configuração:</strong><br>";
  html += "Laundry ID: " + String(laundryId) + "<br>";
  html += "Supabase URL: " + String(systemURL) + "<br>";
  html += "API Key: " + String(supabaseApiKey).substring(0, 20) + "...";
  html += "</div>";
  
  // Status da máquina
  html += "<div class='status-card " + String(machineActive ? "active" : "inactive") + "'>";
  html += "<h2>" + String(machineActive ? "🟢 LAVADORA ATIVA" : "🔴 LAVADORA INATIVA") + "</h2>";
  if (machineActive) {
    unsigned long remaining = (activationTime + CYCLE_DURATION - millis()) / 1000;
    html += "<p><strong>Tempo restante:</strong> " + String(remaining / 60) + ":" + String(remaining % 60).substring(0,2) + "</p>";
    html += "<p><strong>Ativada em:</strong> " + String(activationTime) + "</p>";
  }
  html += "</div>";
  
  // Informações do sistema
  html += "<div class='info-grid'>";
  html += "<div class='info-item'><div class='info-label'>RSSI</div><div class='info-value'>" + String(WiFi.RSSI()) + " dBm</div></div>";
  html += "<div class='info-item'><div class='info-label'>Uptime</div><div class='info-value'>" + String(millis() / 1000) + "s</div></div>";
  html += "<div class='info-item'><div class='info-label'>Memória Livre</div><div class='info-value'>" + String(ESP.getFreeHeap()) + " bytes</div></div>";
  html += "<div class='info-item'><div class='info-label'>Versão</div><div class='info-value'>v2.0.1</div></div>";
  html += "</div>";
  
  // Botões de controle
  html += "<div style='text-align:center;padding:20px;'>";
  if (machineActive) {
    html += "<button class='btn btn-danger' onclick='deactivateMachine()'>⏹️ Desativar Lavadora</button>";
  } else {
    html += "<button class='btn btn-success' onclick='activateMachine()'>▶️ Ativar Lavadora</button>";
  }
  html += "<button class='btn btn-primary' onclick='testHeartbeat()'>💓 Testar Heartbeat</button>";
  html += "<button class='btn btn-danger' onclick='restartDevice()'>🔄 Reiniciar</button>";
  html += "</div>";
  
  html += "</div>";
  
  // JavaScript
  html += "<script>";
  html += "function activateMachine(){";
  html += "if(confirm('Ativar lavadora?')){";
  html += "fetch('/activate',{method:'POST',headers:{'Content-Type':'application/json'},";
  html += "body:JSON.stringify({transaction_id:'test_'+Date.now(),amount:15.0})})";
  html += ".then(r=>r.json()).then(d=>{alert('Resposta: '+d.message);location.reload()})";
  html += ".catch(e=>alert('Erro: '+e));}}";
  
  html += "function deactivateMachine(){";
  html += "if(confirm('Desativar lavadora?')){";
  html += "fetch('/deactivate',{method:'POST'})";
  html += ".then(r=>r.json()).then(d=>{alert('Lavadora desativada');location.reload()})";
  html += ".catch(e=>alert('Erro: '+e));}}";
  
  html += "function testHeartbeat(){";
  html += "fetch('/heartbeat',{method:'POST'})";
  html += ".then(r=>r.json()).then(d=>alert('Heartbeat OK: '+d.status))";
  html += ".catch(e=>alert('Erro: '+e));}";
  
  html += "function restartDevice(){";
  html += "if(confirm('Reiniciar ESP32?')){";
  html += "alert('Reiniciando...');location.reload();}}";
  
  html += "setInterval(()=>location.reload(),30000);"; // Auto-refresh a cada 30s
  html += "</script>";
  
  html += "</body></html>";
  return html;
}