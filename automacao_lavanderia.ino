#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <SPIFFS.h>
#include <esp_task_wdt.h>

// Configurações
#define WDT_TIMEOUT 60  // Watchdog timeout em segundos

// Configurações de rede (edite conforme necessário)
const char* ssid = "SeuSSID";
const char* password = "SuaSenha";
const char* systemURL = "https://rkdybjzwiwwqqzjfmerm.supabase.co/functions/v1/esp32-monitor";

// Configurações das máquinas
#define RELAY_LAVADORA_01  2
#define RELAY_LAVADORA_02  4
#define RELAY_SECADORA_01  5
#define RELAY_SECADORA_02  18

WebServer server(80);
unsigned long lastHeartbeat = 0;
const unsigned long heartbeatInterval = 30000; // 30 segundos

// Estrutura para controlar máquinas
struct Machine {
  String id;
  int relayPin;
  bool isActive;
  unsigned long activationTime;
  unsigned long cycleDuration;
};

Machine machines[] = {
  {"lavadora_01", RELAY_LAVADORA_01, false, 0, 1800000}, // 30 min
  {"lavadora_02", RELAY_LAVADORA_02, false, 0, 1800000}, // 30 min
  {"secadora_01", RELAY_SECADORA_01, false, 0, 2700000}, // 45 min
  {"secadora_02", RELAY_SECADORA_02, false, 0, 2700000}  // 45 min
};
const int numMachines = 4;

void setup() {
  Serial.begin(115200);
  
  // Configurar pinos dos relés
  for (int i = 0; i < numMachines; i++) {
    pinMode(machines[i].relayPin, OUTPUT);
    digitalWrite(machines[i].relayPin, LOW);
  }
  
  // Configurar watchdog timer
  esp_task_wdt_config_t wdt_config = {
    .timeout_ms = WDT_TIMEOUT * 1000,
    .idle_core_mask = (1 << portNUM_PROCESSORS) - 1,
    .trigger_panic = true
  };
  esp_task_wdt_init(&wdt_config);
  esp_task_wdt_add(NULL);
  
  // Inicializar SPIFFS
  if (!SPIFFS.begin(true)) {
    Serial.println("Erro ao inicializar SPIFFS");
  }
  
  // Conectar ao WiFi
  WiFi.begin(ssid, password);
  Serial.print("Conectando ao WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.print(".");
    esp_task_wdt_reset();
  }
  Serial.println();
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
  
  // Configurar rotas do servidor
  server.on("/", HTTP_GET, handleRoot);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/release-credit", HTTP_POST, handleCreditRelease);
  server.on("/heartbeat", HTTP_POST, handleHeartbeat);
  server.on("/machines", HTTP_GET, handleMachines);
  server.onNotFound(handleNotFound);
  
  // Habilitar CORS
  server.enableCORS(true);
  
  server.begin();
  Serial.println("ESP32 iniciado!");
  Serial.println("Acesse: http://" + WiFi.localIP().toString());
}

void loop() {
  server.handleClient();
  
  // Reset watchdog
  esp_task_wdt_reset();
  
  // Verificar máquinas ativas
  checkMachineTimers();
  
  // Heartbeat automático
  if (millis() - lastHeartbeat > heartbeatInterval) {
    sendHeartbeat();
    lastHeartbeat = millis();
  }
  
  delay(100);
}

void handleRoot() {
  String html = "<!DOCTYPE html><html><head><meta charset='UTF-8'>";
  html += "<title>ESP32 Lavanderia</title>";
  html += "<style>";
  html += "body{font-family:Arial;margin:20px;background:#f5f5f5}";
  html += ".container{max-width:800px;margin:0 auto;background:white;padding:20px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.1)}";
  html += ".header{text-align:center;color:#333;margin-bottom:20px}";
  html += ".status{display:flex;justify-content:space-between;margin:10px 0;padding:10px;background:#f9f9f9;border-radius:5px}";
  html += ".btn{padding:10px 15px;margin:5px;border:none;border-radius:5px;cursor:pointer;color:white}";
  html += ".success{background:#28a745}.danger{background:#dc3545}.warning{background:#ffc107;color:#000}";
  html += ".machine{border:1px solid #ddd;margin:10px 0;padding:15px;border-radius:5px}";
  html += ".active{background:#d4edda;border-color:#c3e6cb}";
  html += ".inactive{background:#f8f9fa;border-color:#dee2e6}";
  html += "</style></head><body>";
  
  html += "<div class='container'>";
  html += "<h1 class='header'>ESP32 Lavanderia Control</h1>";
  
  // Status do sistema
  html += "<div class='status'>";
  html += "<span><strong>IP:</strong> " + WiFi.localIP().toString() + "</span>";
  html += "<span><strong>RSSI:</strong> " + String(WiFi.RSSI()) + " dBm</span>";
  html += "<span><strong>Uptime:</strong> " + String(millis() / 1000) + "s</span>";
  html += "</div>";
  
  // Botões de teste
  html += "<div style='text-align:center;margin:20px 0'>";
  html += "<button class='btn success' onclick='testHeartbeat()'>Testar Heartbeat</button>";
  html += "<button class='btn warning' onclick='restartDevice()'>Reiniciar</button>";
  html += "</div>";
  
  // Status das máquinas
  html += "<h2>Status das Máquinas</h2>";
  for (int i = 0; i < numMachines; i++) {
    html += "<div class='machine " + String(machines[i].isActive ? "active" : "inactive") + "'>";
    html += "<h3>" + machines[i].id + "</h3>";
    html += "<p>Status: " + String(machines[i].isActive ? "ATIVA" : "INATIVA") + "</p>";
    if (machines[i].isActive) {
      unsigned long remaining = (machines[i].activationTime + machines[i].cycleDuration - millis()) / 1000;
      html += "<p>Tempo restante: " + String(remaining / 60) + ":" + String(remaining % 60) + "</p>";
    }
    html += "<button class='btn " + String(machines[i].isActive ? "danger" : "success") + "' ";
    html += "onclick='" + String(machines[i].isActive ? "deactivate" : "activate") + "Machine(\"" + machines[i].id + "\")'>";
    html += String(machines[i].isActive ? "Desativar" : "Ativar") + "</button>";
    html += "</div>";
  }
  
  html += "</div>";
  
  // JavaScript
  html += "<script>";
  html += "function activateMachine(id){";
  html += "fetch('/release-credit',{method:'POST',headers:{'Content-Type':'application/json'},";
  html += "body:JSON.stringify({transaction_id:'test_'+Date.now(),amount:10.5,machine_id:id})})";
  html += ".then(r=>r.json()).then(d=>{alert('Resposta: '+d.message);location.reload()})";
  html += ".catch(e=>alert('Erro: '+e));}";
  
  html += "function deactivateMachine(id){";
  html += "if(confirm('Desativar '+id+'?')){";
  html += "fetch('/machines?action=deactivate&id='+id,{method:'POST'})";
  html += ".then(r=>r.json()).then(d=>{alert('Máquina desativada');location.reload()})";
  html += ".catch(e=>alert('Erro: '+e));}}";
  
  html += "function testHeartbeat(){";
  html += "fetch('/heartbeat',{method:'POST'})";
  html += ".then(r=>r.json()).then(d=>alert('Heartbeat OK: '+d.status))";
  html += ".catch(e=>alert('Erro no heartbeat: '+e));}";
  
  html += "function restartDevice(){";
  html += "if(confirm('Reiniciar ESP32?')){";
  html += "fetch('/restart',{method:'POST'})";
  html += ".then(()=>{alert('Reiniciando...');setTimeout(()=>location.reload(),5000)})";
  html += ".catch(e=>alert('Erro: '+e));}}";
  
  html += "setInterval(()=>location.reload(),30000);"; // Auto-refresh a cada 30s
  html += "</script>";
  
  html += "</body></html>";
  
  server.send(200, "text/html", html);
}

void handleStatus() {
  DynamicJsonDocument doc(1024);
  doc["esp32_id"] = "main";
  doc["ip_address"] = WiFi.localIP().toString();
  doc["signal_strength"] = WiFi.RSSI();
  doc["network_status"] = WiFi.status() == WL_CONNECTED ? "connected" : "disconnected";
  doc["firmware_version"] = "v1.2.3";
  doc["uptime_seconds"] = millis() / 1000;
  doc["free_heap"] = ESP.getFreeHeap();
  doc["wifi_ssid"] = WiFi.SSID();
  
  // Status das máquinas
  JsonArray machinesArray = doc.createNestedArray("machines");
  for (int i = 0; i < numMachines; i++) {
    JsonObject machine = machinesArray.createNestedObject();
    machine["id"] = machines[i].id;
    machine["is_active"] = machines[i].isActive;
    if (machines[i].isActive) {
      unsigned long remaining = (machines[i].activationTime + machines[i].cycleDuration - millis()) / 1000;
      machine["time_remaining"] = remaining;
    }
  }
  
  String response;
  serializeJson(doc, response);
  
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", response);
}

void handleCreditRelease() {
  if (server.method() == HTTP_OPTIONS) {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
    server.send(200);
    return;
  }
  
  DynamicJsonDocument doc(1024);
  DeserializationError error = deserializeJson(doc, server.arg("plain"));
  
  if (error) {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(400, "application/json", "{\"success\":false,\"message\":\"JSON inválido\"}");
    return;
  }
  
  String transactionId = doc["transaction_id"] | "unknown";
  float amount = doc["amount"] | 0.0;
  String machineId = doc["machine_id"] | "lavadora_01";
  
  bool success = activateMachine(machineId, amount);
  
  DynamicJsonDocument response(1024);
  response["success"] = success;
  response["message"] = success ? "Crédito liberado com sucesso" : "Falha na liberação";
  response["transaction_id"] = transactionId;
  response["amount"] = amount;
  response["activated_machine"] = machineId;
  response["activation_time"] = String(millis());
  
  String responseStr;
  serializeJson(response, responseStr);
  
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(success ? 200 : 500, "application/json", responseStr);
}

void handleHeartbeat() {
  DynamicJsonDocument response(512);
  response["status"] = "ok";
  response["timestamp"] = String(millis());
  response["next_heartbeat"] = heartbeatInterval / 1000;
  
  String responseStr;
  serializeJson(response, responseStr);
  
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", responseStr);
}

void handleMachines() {
  String action = server.arg("action");
  String id = server.arg("id");
  
  if (action == "deactivate" && id.length() > 0) {
    for (int i = 0; i < numMachines; i++) {
      if (machines[i].id == id) {
        machines[i].isActive = false;
        digitalWrite(machines[i].relayPin, LOW);
        break;
      }
    }
  }
  
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", "{\"status\":\"ok\"}");
}

void handleNotFound() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(404, "text/plain", "Endpoint não encontrado");
}

bool activateMachine(String machineId, float amount) {
  for (int i = 0; i < numMachines; i++) {
    if (machines[i].id == machineId) {
      if (machines[i].isActive) {
        Serial.println("Máquina " + machineId + " já está ativa");
        return false;
      }
      
      machines[i].isActive = true;
      machines[i].activationTime = millis();
      digitalWrite(machines[i].relayPin, HIGH);
      
      Serial.println("Máquina " + machineId + " ativada com R$ " + String(amount));
      return true;
    }
  }
  
  Serial.println("Máquina " + machineId + " não encontrada");
  return false;
}

void checkMachineTimers() {
  for (int i = 0; i < numMachines; i++) {
    if (machines[i].isActive) {
      if (millis() - machines[i].activationTime >= machines[i].cycleDuration) {
        machines[i].isActive = false;
        digitalWrite(machines[i].relayPin, LOW);
        Serial.println("Máquina " + machines[i].id + " finalizada automaticamente");
      }
    }
  }
}

void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  http.begin(String(systemURL) + "?action=heartbeat");
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);
  
  DynamicJsonDocument doc(1024);
  doc["esp32_id"] = "main";
  doc["ip_address"] = WiFi.localIP().toString();
  doc["signal_strength"] = WiFi.RSSI();
  doc["network_status"] = "connected";
  doc["firmware_version"] = "v1.2.3";
  doc["uptime_seconds"] = millis() / 1000;
  
  String payload;
  serializeJson(doc, payload);
  
  int httpResponseCode = http.POST(payload);
  
  if (httpResponseCode > 0) {
    Serial.println("Heartbeat enviado: " + String(httpResponseCode));
  } else {
    Serial.println("Erro no heartbeat: " + String(httpResponseCode));
  }
  
  http.end();
}