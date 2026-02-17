/**
 * ESP32 AutoConfig v3.0 - Top Lavanderia
 * 
 * PLUG AND PLAY - Nenhuma configuração manual necessária!
 * 
 * Como funciona:
 * 1. Faça upload deste código em qualquer ESP32
 * 2. No primeiro boot, o ESP32 ativa BLE e AP WiFi para configuração
 * 3. Configure WiFi e Laundry ID pelo celular (BLE) ou navegador (AP)
 * 4. O ESP32 se registra automaticamente no sistema
 * 5. No painel admin, aprove o ESP32 e associe a uma máquina
 * 
 * Bibliotecas necessárias (já incluídas no ESP32 Arduino Core):
 * - WiFi.h, WebServer.h, HTTPClient.h, ArduinoJson.h
 * - BLEDevice.h, Preferences.h
 */

#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Preferences.h>

// ================== SUPABASE (fixo, não muda) ==================
const char* supabaseUrl = "https://rkdybjzwiwwqqzjfmerm.supabase.co";
const char* supabaseApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZHlianp3aXd3cXF6amZtZXJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMDgxNjcsImV4cCI6MjA2ODg4NDE2N30.CnRP8lrmGmvcbHmWdy72ZWlfZ28cDdNoxdADnyFAOXg";

// ================== HARDWARE ==================
#define RELAY_PIN 2
#define LED_PIN 2
#define RESET_BUTTON_PIN 0  // Boot button para reset de fábrica

// ================== BLE UUIDs ==================
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHAR_WIFI_CONFIG    "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define CHAR_STATUS         "beb5483e-36e1-4688-b7f5-ea07361b26a9"

// ================== VARIÁVEIS GLOBAIS ==================
Preferences preferences;
WebServer server(80);
BLEServer* pServer = NULL;
BLECharacteristic* pStatusChar = NULL;

// Configurações salvas na flash
String savedSSID = "";
String savedPass = "";
String savedLaundryId = "";
bool isConfigured = false;

// Estado do dispositivo
String esp32Id = "";
String deviceName = "";
bool wifiConnected = false;
bool relayState = false;
bool machineRunning = false;
unsigned long lastHeartbeat = 0;
unsigned long lastCommandPoll = 0;
unsigned long machineStartTime = 0;
const unsigned long HEARTBEAT_INTERVAL = 30000;
const unsigned long COMMAND_POLL_INTERVAL = 5000;
bool bleActive = false;
bool apActive = false;
bool deviceConnected = false;

// ================== GERAR ESP32 ID A PARTIR DO MAC ==================
String generateESP32Id() {
  uint8_t mac[6];
  WiFi.macAddress(mac);
  char id[16];
  sprintf(id, "esp32_%02X%02X%02X", mac[3], mac[4], mac[5]);
  return String(id);
}

String generateDeviceName() {
  uint8_t mac[6];
  WiFi.macAddress(mac);
  char name[16];
  sprintf(name, "TopLav_%02X%02X%02X", mac[3], mac[4], mac[5]);
  return String(name);
}

// ================== PREFERENCES (Flash) ==================
void loadPreferences() {
  preferences.begin("toplav", true);  // read-only
  isConfigured = preferences.getBool("configured", false);
  savedSSID = preferences.getString("wifi_ssid", "");
  savedPass = preferences.getString("wifi_pass", "");
  savedLaundryId = preferences.getString("laundry_id", "");
  preferences.end();
  
  Serial.println("📦 Configurações carregadas da flash:");
  Serial.printf("   Configurado: %s\n", isConfigured ? "SIM" : "NÃO");
  Serial.printf("   SSID: %s\n", savedSSID.c_str());
  Serial.printf("   Laundry ID: %s\n", savedLaundryId.c_str());
}

void savePreferences(String ssid, String pass, String laundryId) {
  preferences.begin("toplav", false);  // read-write
  preferences.putString("wifi_ssid", ssid);
  preferences.putString("wifi_pass", pass);
  preferences.putString("laundry_id", laundryId);
  preferences.putBool("configured", true);
  preferences.end();
  
  savedSSID = ssid;
  savedPass = pass;
  savedLaundryId = laundryId;
  isConfigured = true;
  
  Serial.println("💾 Configurações salvas na flash!");
}

void factoryReset() {
  Serial.println("🗑️ RESET DE FÁBRICA!");
  preferences.begin("toplav", false);
  preferences.clear();
  preferences.end();
  Serial.println("   Configurações apagadas. Reiniciando...");
  delay(1000);
  ESP.restart();
}

// ================== BLE CALLBACKS ==================
class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* server) {
    deviceConnected = true;
    Serial.println("📱 Dispositivo BLE conectado!");
  }
  void onDisconnect(BLEServer* server) {
    deviceConnected = false;
    Serial.println("📱 Dispositivo BLE desconectado");
    // Reiniciar advertising
    server->getAdvertising()->start();
  }
};

class WiFiConfigCallback : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pCharacteristic) {
    String value = pCharacteristic->getValue().c_str();
    Serial.println("📥 Dados BLE recebidos: " + value);
    
    // Parse JSON: {"ssid":"rede","pass":"senha","laundry_id":"uuid"}
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, value);
    
    if (error) {
      Serial.println("❌ Erro ao parsear JSON BLE");
      updateBLEStatus("error:invalid_json");
      return;
    }
    
    String ssid = doc["ssid"] | "";
    String pass = doc["pass"] | "";
    String laundryId = doc["laundry_id"] | "";
    
    if (ssid.length() == 0 || laundryId.length() == 0) {
      Serial.println("❌ SSID ou Laundry ID vazio");
      updateBLEStatus("error:missing_fields");
      return;
    }
    
    Serial.printf("📝 Configurando: SSID=%s, LaundryID=%s\n", ssid.c_str(), laundryId.c_str());
    updateBLEStatus("configuring");
    
    // Salvar na flash
    savePreferences(ssid, pass, laundryId);
    
    // Tentar conectar WiFi
    updateBLEStatus("connecting_wifi");
    
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid.c_str(), pass.c_str());
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
      delay(500);
      attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
      wifiConnected = true;
      String statusMsg = "connected:" + WiFi.localIP().toString();
      updateBLEStatus(statusMsg);
      Serial.println("✅ WiFi conectado via BLE! IP: " + WiFi.localIP().toString());
      
      // Aguardar um pouco para o celular ler o status
      delay(2000);
      
      // Reiniciar para modo normal
      Serial.println("🔄 Reiniciando para modo normal...");
      delay(1000);
      ESP.restart();
    } else {
      updateBLEStatus("error:wifi_failed");
      Serial.println("❌ Falha ao conectar WiFi via BLE");
    }
  }
};

void updateBLEStatus(String status) {
  if (pStatusChar) {
    pStatusChar->setValue(status.c_str());
    pStatusChar->notify();
  }
}

// ================== INICIAR BLE ==================
void startBLE() {
  Serial.println("🔵 Iniciando Bluetooth (BLE)...");
  
  BLEDevice::init(deviceName.c_str());
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());
  
  BLEService* pService = pServer->createService(SERVICE_UUID);
  
  // Característica para receber config WiFi
  BLECharacteristic* pWifiChar = pService->createCharacteristic(
    CHAR_WIFI_CONFIG,
    BLECharacteristic::PROPERTY_WRITE
  );
  pWifiChar->setCallbacks(new WiFiConfigCallback());
  
  // Característica para enviar status
  pStatusChar = pService->createCharacteristic(
    CHAR_STATUS,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  pStatusChar->addDescriptor(new BLE2902());
  
  String initialStatus = isConfigured ? "configured:no_wifi" : "unconfigured";
  pStatusChar->setValue(initialStatus.c_str());
  
  pService->start();
  
  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->start();
  
  bleActive = true;
  Serial.printf("✅ BLE ativo! Nome: %s\n", deviceName.c_str());
  Serial.println("   Aguardando conexão do celular...");
}

// ================== ACCESS POINT (Fallback) ==================
void startAccessPoint() {
  Serial.println("📡 Iniciando Access Point WiFi...");
  
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(deviceName.c_str());  // Sem senha
  
  apActive = true;
  Serial.printf("✅ AP ativo! Nome: %s\n", deviceName.c_str());
  Serial.printf("   IP: %s\n", WiFi.softAPIP().toString().c_str());
  Serial.println("   Acesse http://192.168.4.1 no navegador");
  
  // Configurar rotas do AP
  setupConfigRoutes();
  server.begin();
}

void setupConfigRoutes() {
  server.on("/", HTTP_GET, handleConfigPage);
  server.on("/configure", HTTP_POST, handleConfigure);
  server.on("/status", HTTP_GET, handleAPStatus);
}

void handleConfigPage() {
  String html = "<!DOCTYPE html><html><head><meta charset='UTF-8'>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1.0'>";
  html += "<title>Configurar " + deviceName + "</title>";
  html += "<style>";
  html += "body{font-family:Arial;margin:0;padding:20px;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh}";
  html += ".card{background:white;padding:30px;border-radius:15px;max-width:400px;margin:0 auto;box-shadow:0 10px 40px rgba(0,0,0,0.2)}";
  html += "h1{color:#333;text-align:center;margin-bottom:5px}";
  html += ".subtitle{text-align:center;color:#888;margin-bottom:25px;font-size:14px}";
  html += "label{display:block;margin-bottom:5px;color:#555;font-weight:bold;font-size:14px}";
  html += "input{width:100%;padding:12px;margin-bottom:15px;border:2px solid #e0e0e0;border-radius:8px;box-sizing:border-box;font-size:16px}";
  html += "input:focus{border-color:#667eea;outline:none}";
  html += "button{width:100%;padding:14px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:8px;cursor:pointer;font-size:16px;font-weight:bold}";
  html += "button:hover{opacity:0.9}";
  html += ".id{text-align:center;color:#aaa;font-size:12px;margin-top:15px}";
  html += ".status{padding:10px;border-radius:8px;margin-bottom:15px;text-align:center;font-size:14px;display:none}";
  html += ".success{background:#e8f5e9;color:#2e7d32;display:block}";
  html += ".error{background:#ffebee;color:#c62828;display:block}";
  html += "</style></head><body>";
  html += "<div class='card'>";
  html += "<h1>🔧 " + deviceName + "</h1>";
  html += "<p class='subtitle'>Configure a conexão WiFi e lavanderia</p>";
  html += "<div id='status' class='status'></div>";
  html += "<form id='form' onsubmit='return configure(event)'>";
  html += "<label>📡 Rede WiFi (SSID)</label>";
  html += "<input type='text' id='ssid' placeholder='Nome da rede WiFi' required>";
  html += "<label>🔒 Senha do WiFi</label>";
  html += "<input type='password' id='pass' placeholder='Senha da rede'>";
  html += "<label>🏢 ID da Lavanderia</label>";
  html += "<input type='text' id='laundry_id' placeholder='Cole o UUID da lavanderia' required>";
  html += "<p style='font-size:12px;color:#888;margin-top:-10px;margin-bottom:15px'>Encontre no painel Admin → Configurações → QR Code</p>";
  html += "<button type='submit'>💾 Salvar e Conectar</button>";
  html += "</form>";
  html += "<p class='id'>ID: " + esp32Id + "</p>";
  html += "</div>";
  html += "<script>";
  html += "async function configure(e){";
  html += "e.preventDefault();";
  html += "document.getElementById('status').className='status';";
  html += "let r=await fetch('/configure',{method:'POST',headers:{'Content-Type':'application/json'},";
  html += "body:JSON.stringify({ssid:document.getElementById('ssid').value,";
  html += "pass:document.getElementById('pass').value,";
  html += "laundry_id:document.getElementById('laundry_id').value})});";
  html += "let d=await r.json();";
  html += "let s=document.getElementById('status');";
  html += "if(d.success){s.className='status success';s.textContent='✅ '+d.message;}";
  html += "else{s.className='status error';s.textContent='❌ '+d.message;}}";
  html += "</script></body></html>";
  
  server.send(200, "text/html", html);
}

void handleConfigure() {
  String body = server.arg("plain");
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, body);
  
  if (error) {
    server.send(400, "application/json", "{\"success\":false,\"message\":\"JSON inválido\"}");
    return;
  }
  
  String ssid = doc["ssid"] | "";
  String pass = doc["pass"] | "";
  String laundryId = doc["laundry_id"] | "";
  
  if (ssid.length() == 0 || laundryId.length() == 0) {
    server.send(400, "application/json", "{\"success\":false,\"message\":\"SSID e Laundry ID são obrigatórios\"}");
    return;
  }
  
  // Salvar na flash
  savePreferences(ssid, pass, laundryId);
  
  server.send(200, "application/json", "{\"success\":true,\"message\":\"Configurado! Reiniciando em 3 segundos...\"}");
  
  delay(3000);
  ESP.restart();
}

void handleAPStatus() {
  StaticJsonDocument<256> doc;
  doc["esp32_id"] = esp32Id;
  doc["device_name"] = deviceName;
  doc["configured"] = isConfigured;
  doc["wifi_connected"] = wifiConnected;
  
  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

// ================== MODO NORMAL (WiFi conectado) ==================
void setupNormalRoutes() {
  server.on("/", HTTP_GET, handleRoot);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/start", HTTP_POST, handleStart);
  server.on("/stop", HTTP_POST, handleStop);
  server.on("/reset", HTTP_POST, []() {
    server.send(200, "application/json", "{\"success\":true,\"message\":\"Resetando...\"}");
    delay(1000);
    factoryReset();
  });
  server.onNotFound([]() {
    server.send(404, "application/json", "{\"error\":\"Rota não encontrada\"}");
  });
}

void handleRoot() {
  String html = "<!DOCTYPE html><html><head><meta charset='UTF-8'>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1.0'>";
  html += "<title>" + deviceName + "</title>";
  html += "<style>body{font-family:Arial;margin:20px;background:#f0f0f0}";
  html += ".container{background:white;padding:20px;border-radius:10px;box-shadow:0 2px 5px rgba(0,0,0,0.1);max-width:500px;margin:0 auto}";
  html += "h1{color:#333;border-bottom:2px solid #4CAF50;padding-bottom:10px}";
  html += ".s{display:flex;justify-content:space-between;margin:10px 0;padding:10px;background:#f9f9f9;border-radius:5px}";
  html += ".l{font-weight:bold;color:#666}.v{color:#333}";
  html += ".on{color:#4CAF50;font-weight:bold}.off{color:#f44336;font-weight:bold}";
  html += "button{background:#4CAF50;color:white;border:none;padding:12px 24px;border-radius:5px;cursor:pointer;font-size:16px;margin:5px}";
  html += "button:hover{opacity:0.9}button.stop{background:#f44336}button.reset{background:#ff9800;font-size:12px;padding:8px 16px}</style></head><body>";
  html += "<div class='container'><h1>🔧 " + deviceName + "</h1>";
  html += "<div class='s'><span class='l'>ESP32 ID:</span><span class='v'>" + esp32Id + "</span></div>";
  html += "<div class='s'><span class='l'>Lavanderia:</span><span class='v'>" + savedLaundryId.substring(0, 8) + "...</span></div>";
  html += "<div class='s'><span class='l'>IP:</span><span class='v'>" + WiFi.localIP().toString() + "</span></div>";
  html += "<div class='s'><span class='l'>WiFi:</span><span class='v'>" + String(WiFi.RSSI()) + " dBm</span></div>";
  html += "<div class='s'><span class='l'>Status:</span><span class='v " + String(machineRunning ? "on'>▶️ RODANDO" : "off'>⏹️ PARADA") + "</span></div>";
  html += "<div class='s'><span class='l'>Relé:</span><span class='v'>" + String(relayState ? "LIGADO ✅" : "DESLIGADO ⭕") + "</span></div>";
  html += "<div style='margin-top:20px;text-align:center'>";
  html += "<button onclick=\"fetch('/start',{method:'POST'}).then(()=>location.reload())\">▶️ Iniciar</button>";
  html += "<button class='stop' onclick=\"fetch('/stop',{method:'POST'}).then(()=>location.reload())\">⏹️ Parar</button><br><br>";
  html += "<button class='reset' onclick=\"if(confirm('Apagar todas as configurações?'))fetch('/reset',{method:'POST'}).then(()=>alert('Reiniciando...'))\">🗑️ Reset Fábrica</button>";
  html += "</div></div></body></html>";
  
  server.send(200, "text/html", html);
}

void handleStatus() {
  StaticJsonDocument<512> doc;
  doc["esp32_id"] = esp32Id;
  doc["device_name"] = deviceName;
  doc["laundry_id"] = savedLaundryId;
  doc["ip_address"] = WiFi.localIP().toString();
  doc["signal_strength"] = WiFi.RSSI();
  doc["network_status"] = "connected";
  doc["firmware_version"] = "v3.0.0-autoconfig";
  doc["uptime_seconds"] = millis() / 1000;
  doc["is_active"] = machineRunning;
  doc["relay_status"] = relayState ? "on" : "off";
  doc["configured"] = true;
  
  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

void handleStart() {
  Serial.println("▶️ Comando START recebido");
  relayState = true;
  machineRunning = true;
  machineStartTime = millis();
  digitalWrite(RELAY_PIN, HIGH);
  digitalWrite(LED_PIN, HIGH);
  
  server.send(200, "application/json", "{\"success\":true,\"message\":\"Máquina iniciada\"}");
  sendHeartbeat();
}

void handleStop() {
  Serial.println("⏹️ Comando STOP recebido");
  relayState = false;
  machineRunning = false;
  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(LED_PIN, LOW);
  
  server.send(200, "application/json", "{\"success\":true,\"message\":\"Máquina parada\"}");
  sendHeartbeat();
}

// ================== HEARTBEAT COM AUTO-REGISTRO ==================
void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ WiFi desconectado, tentando reconectar...");
    connectWiFi();
    return;
  }
  
  HTTPClient http;
  String url = String(supabaseUrl) + "/functions/v1/esp32-monitor?action=heartbeat";
  
  Serial.println("\n📡 Enviando heartbeat (auto-registro)...");
  
  StaticJsonDocument<512> doc;
  doc["esp32_id"] = esp32Id;
  doc["laundry_id"] = savedLaundryId;
  doc["ip_address"] = WiFi.localIP().toString();
  doc["signal_strength"] = WiFi.RSSI();
  doc["network_status"] = "connected";
  doc["firmware_version"] = "v3.0.0-autoconfig";
  doc["uptime_seconds"] = millis() / 1000;
  doc["is_active"] = machineRunning;
  doc["auto_register"] = true;  // Flag para auto-registro
  doc["device_name"] = deviceName;
  
  JsonObject relayStatusObj = doc.createNestedObject("relay_status");
  relayStatusObj["relay_1"] = relayState ? "on" : "off";
  
  String payload;
  serializeJson(doc, payload);
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", supabaseApiKey);
  
  int httpCode = http.POST(payload);
  
  if (httpCode > 0) {
    Serial.printf("✅ Heartbeat enviado - HTTP %d\n", httpCode);
    String response = http.getString();
    Serial.println("Resposta: " + response);
    
    // Parsear resposta para obter configurações do servidor
    StaticJsonDocument<256> respDoc;
    if (!deserializeJson(respDoc, response)) {
      int interval = respDoc["next_interval"] | 30;
      // Poderia ajustar HEARTBEAT_INTERVAL dinamicamente
    }
    
    lastHeartbeat = millis();
  } else {
    Serial.printf("❌ Erro no heartbeat - HTTP %d\n", httpCode);
  }
  
  http.end();
}

// ================== POLLING DE COMANDOS PENDENTES ==================
void pollPendingCommands() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  String url = String(supabaseUrl) + "/functions/v1/esp32-monitor?action=poll_commands&esp32_id=" + esp32Id;
  
  http.begin(url);
  http.addHeader("apikey", supabaseApiKey);
  http.addHeader("Content-Type", "application/json");
  
  int httpCode = http.GET();
  
  if (httpCode == 200) {
    String response = http.getString();
    
    StaticJsonDocument<1024> doc;
    if (deserializeJson(doc, response)) {
      http.end();
      return;
    }
    
    JsonArray commands = doc["commands"].as<JsonArray>();
    
    for (JsonObject cmd : commands) {
      String cmdId = cmd["id"].as<String>();
      int pin = cmd["relay_pin"] | RELAY_PIN;
      String cmdAction = cmd["action"].as<String>();
      
      Serial.printf("⚡ Executando comando: relay %d → %s\n", pin, cmdAction.c_str());
      
      if (cmdAction == "on") {
        digitalWrite(pin, HIGH);
        relayState = true;
        machineRunning = true;
        machineStartTime = millis();
        digitalWrite(LED_PIN, HIGH);
      } else {
        digitalWrite(pin, LOW);
        relayState = false;
        machineRunning = false;
        digitalWrite(LED_PIN, LOW);
      }
      
      // Confirmar execução
      confirmCommand(cmdId);
    }
  }
  
  http.end();
  lastCommandPoll = millis();
}

void confirmCommand(String commandId) {
  HTTPClient http;
  String url = String(supabaseUrl) + "/functions/v1/esp32-monitor?action=confirm_command";
  
  StaticJsonDocument<256> doc;
  doc["command_id"] = commandId;
  doc["esp32_id"] = esp32Id;
  
  String payload;
  serializeJson(doc, payload);
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", supabaseApiKey);
  
  int httpCode = http.POST(payload);
  
  if (httpCode == 200) {
    Serial.printf("✅ Comando %s confirmado\n", commandId.c_str());
  } else {
    Serial.printf("❌ Erro ao confirmar comando: HTTP %d\n", httpCode);
  }
  
  http.end();
}

// ================== CONEXÃO WIFI ==================
bool connectWiFi() {
  Serial.printf("📡 Conectando ao WiFi: %s\n", savedSSID.c_str());
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(savedSSID.c_str(), savedPass.c_str());
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println("\n✅ WiFi conectado!");
    Serial.printf("   IP: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("   Sinal: %d dBm\n", WiFi.RSSI());
    return true;
  } else {
    wifiConnected = false;
    Serial.println("\n❌ Falha ao conectar WiFi!");
    return false;
  }
}

// ================== CHECK BOTÃO RESET ==================
void checkResetButton() {
  // Segurar o botão BOOT por 5 segundos faz reset de fábrica
  if (digitalRead(RESET_BUTTON_PIN) == LOW) {
    unsigned long pressStart = millis();
    while (digitalRead(RESET_BUTTON_PIN) == LOW) {
      if (millis() - pressStart > 5000) {
        // Piscar LED para indicar reset
        for (int i = 0; i < 10; i++) {
          digitalWrite(LED_PIN, !digitalRead(LED_PIN));
          delay(100);
        }
        factoryReset();
      }
      delay(50);
    }
  }
}

// ================== SETUP ==================
void setup() {
  Serial.begin(115200);
  Serial.println("\n\n========================================");
  Serial.println("ESP32 AutoConfig v3.0 - Top Lavanderia");
  Serial.println("========================================");
  
  // Configurar hardware
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(RESET_BUTTON_PIN, INPUT_PULLUP);
  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(LED_PIN, LOW);
  
  // Gerar IDs a partir do MAC
  esp32Id = generateESP32Id();
  deviceName = generateDeviceName();
  Serial.printf("🆔 ESP32 ID: %s\n", esp32Id.c_str());
  Serial.printf("📛 Device Name: %s\n", deviceName.c_str());
  
  // Carregar configurações da flash
  loadPreferences();
  
  if (isConfigured && savedSSID.length() > 0) {
    // Modo configurado: tentar conectar WiFi
    Serial.println("\n🔄 Tentando conectar WiFi salvo...");
    
    if (connectWiFi()) {
      // WiFi conectado: modo normal
      Serial.println("\n🟢 MODO NORMAL - Operando normalmente");
      setupNormalRoutes();
      server.begin();
      sendHeartbeat();  // Primeiro heartbeat (com auto_register)
    } else {
      // WiFi falhou: ativar BLE + AP para reconfigurar
      Serial.println("\n🟡 WiFi falhou! Ativando BLE + AP para reconfigurar...");
      startBLE();
      startAccessPoint();
    }
  } else {
    // Primeiro boot ou reset: ativar BLE + AP
    Serial.println("\n🔵 PRIMEIRO BOOT - Aguardando configuração...");
    Serial.println("   Use BLE ou acesse o WiFi do dispositivo");
    startBLE();
    startAccessPoint();
  }
  
  Serial.println("========================================\n");
}

// ================== LOOP ==================
void loop() {
  server.handleClient();
  
  // Verificar botão de reset
  checkResetButton();
  
  // Se estiver no modo normal, enviar heartbeats
  if (wifiConnected && isConfigured) {
    // Polling de comandos pendentes a cada 5 segundos
    if (millis() - lastCommandPoll > COMMAND_POLL_INTERVAL) {
      pollPendingCommands();
    }
    
    if (millis() - lastHeartbeat > HEARTBEAT_INTERVAL) {
      sendHeartbeat();
    }
    
    // Verificar se WiFi caiu
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("⚠️ WiFi perdido! Tentando reconectar...");
      wifiConnected = false;
      
      if (!connectWiFi()) {
        // Se falhar 3 vezes seguidas, ativar BLE
        static int reconnectFails = 0;
        reconnectFails++;
        if (reconnectFails >= 3) {
          Serial.println("🔵 Muitas falhas WiFi. Ativando BLE para reconfigurar...");
          startBLE();
          startAccessPoint();
          reconnectFails = 0;
        }
      }
    }
  }
  
  // LED indica estado
  if (!isConfigured || !wifiConnected) {
    // Piscar LED lentamente quando aguardando config
    static unsigned long lastBlink = 0;
    if (millis() - lastBlink > 1000) {
      digitalWrite(LED_PIN, !digitalRead(LED_PIN));
      lastBlink = millis();
    }
  }
  
  delay(10);
}
