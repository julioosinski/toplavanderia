/**
 * ESP32 Lavadora Individual — template gerado pelo admin (Configurar ESP32).
 * Fonte única: este arquivo. Placeholders __LAUNDRY_ID__, __MACHINE_NAME__, etc.
 * Firmware gerado fica em: public/arduino/generated/
 *
 * Versão: 2.2.0 — pulso de crédito 100ms no relé; contagem de ciclo via machineRunning
 */

#include <WiFi.h>
#include <DNSServer.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <cstdio>

// ================== CONFIGURAÇÕES WIFI ==================
// Wi-Fi é configurado via rede AP do próprio ESP32 e salvo em memória persistente (NVS).
const char* WIFI_NAMESPACE = "wifi_cfg";
const char* AP_PASSWORD = "toplav123";
String configuredSsid = "";
String configuredPassword = "";
bool configModeActive = false;
unsigned long lastWifiRetry = 0;
const unsigned long WIFI_RETRY_INTERVAL = 15000;

// ================== IDENTIFICAÇÃO ==================
#define LAUNDRY_ID "__LAUNDRY_ID__"
#define MACHINE_NAME "__MACHINE_NAME__"
// ESP32_ID gerado automaticamente a partir do MAC Address (único por chip).
// Formato: "esp32_AABBCCDD" (últimos 4 bytes do MAC em hex minúsculo).
char ESP32_ID[16];
void buildEsp32Id() {
  uint8_t mac[6];
  WiFi.macAddress(mac);
  snprintf(ESP32_ID, sizeof(ESP32_ID), "esp32_%02x%02x%02x%02x", mac[2], mac[3], mac[4], mac[5]);
}

// ================== CONFIGURAÇÕES SUPABASE ==================
const char* supabaseUrl = "https://rkdybjzwiwwqqzjfmerm.supabase.co";
const char* supabaseApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZHlianp3aXd3cXF6amZtZXJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMDgxNjcsImV4cCI6MjA2ODg4NDE2N30.CnRP8lrmGmvcbHmWdy72ZWlfZ28cDdNoxdADnyFAOXg";

// ================== CONFIGURAÇÕES HARDWARE ==================
#define RELAY_PIN 2                // Pino físico do relé na placa (GPIO2)
#define LED_PIN 2                  // LED embutido (GPIO2)
/** Índice lógico no Supabase (relay_1, relay_2…) — substituído pelo painel "Configurar ESP32" */
#define RELAY_LOGICAL_PIN __RELAY_LOGICAL_PIN__
/** Valor inicial do painel — atualizado dinamicamente pela resposta do heartbeat */
int cycleTimeMinutes = __CYCLE_TIME_MINUTES__;

// ================== VARIÁVEIS DE CONTROLE ==================
WebServer server(80);
DNSServer dnsServer;
const byte DNS_PORT = 53;
Preferences preferences;
unsigned long lastHeartbeat = 0;
unsigned long lastPoll = 0;
const unsigned long HEARTBEAT_INTERVAL = 30000;  // 30 segundos
const unsigned long POLL_INTERVAL = 5000;        // fila pending_commands (esp32-control)
/** Pulso no relé = 1 crédito na lavadora/secadora (PLC); não mantém relé ligado pelo tempo do ciclo */
const unsigned long RELAY_PULSE_MS = 100;
bool relayState = false;
unsigned long machineStartTime = 0;
bool machineRunning = false;
bool registeredWithServer = false;

String getConfigApSsid() {
  String suffix = String(ESP32_ID);
  suffix.replace(" ", "");
  suffix.toUpperCase();
  return "TopLavanderia-" + suffix;
}

void stopConfigPortal() {
  if (!configModeActive) return;
  dnsServer.stop();
  WiFi.softAPdisconnect(true);
  configModeActive = false;
  Serial.println("✅ Modo configuração encerrado (AP desligado)");
}

bool loadWiFiCredentials() {
  preferences.begin(WIFI_NAMESPACE, true);
  configuredSsid = preferences.getString("ssid", "");
  configuredPassword = preferences.getString("pass", "");
  preferences.end();

  configuredSsid.trim();
  configuredPassword.trim();
  return configuredSsid.length() > 0;
}

/** Aciona relé por RELAY_PULSE_MS e inicia contagem do ciclo (machineRunning). */
void pulseCreditRelay() {
  digitalWrite(RELAY_PIN, HIGH);
  digitalWrite(LED_PIN, HIGH);
  delay(RELAY_PULSE_MS);
  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(LED_PIN, LOW);
  relayState = false;
  machineRunning = true;
  machineStartTime = millis();
  Serial.printf("⚡ Pulso de crédito (%lu ms); ciclo: %d min\n", RELAY_PULSE_MS, cycleTimeMinutes);
}

void saveWiFiCredentials(const String& ssid, const String& password) {
  preferences.begin(WIFI_NAMESPACE, false);
  preferences.putString("ssid", ssid);
  preferences.putString("pass", password);
  preferences.end();

  configuredSsid = ssid;
  configuredPassword = password;
}

void startConfigPortal() {
  String apSsid = getConfigApSsid();
  WiFi.mode(WIFI_AP);
  WiFi.softAP(apSsid.c_str(), AP_PASSWORD);
  delay(120);
  configModeActive = true;
  dnsServer.stop();
  dnsServer.start(DNS_PORT, "*", WiFi.softAPIP());

  Serial.println("\n⚙️ Modo configuração WiFi ativo (portal cativo)");
  Serial.printf("   AP SSID: %s\n", apSsid.c_str());
  Serial.printf("   AP Senha: %s\n", AP_PASSWORD);
  Serial.printf("   Abra no celular: http://%s\n", WiFi.softAPIP().toString().c_str());
  Serial.println("   (Android/iOS costumam abrir sozinhos após conectar no Wi-Fi do ESP)\n");
}

/** Escapa texto para uso seguro em HTML (SSID etc.) */
String escapeHtml(const String& raw) {
  String out;
  out.reserve(raw.length() + 8);
  for (unsigned i = 0; i < raw.length(); i++) {
    char c = raw[i];
    if (c == '&')
      out += "&amp;";
    else if (c == '"')
      out += "&quot;";
    else if (c == '<')
      out += "&lt;";
    else if (c == '>')
      out += "&gt;";
    else
      out += c;
  }
  return out;
}

String configPortalUrl() {
  return String("http://") + WiFi.softAPIP().toString() + "/wifi";
}

/** Página principal do modo configuração — apenas seleção de rede + senha. */
String buildConfigPortalHtml() {
  String ssidEsc = escapeHtml(configuredSsid);
  String h;
  h.reserve(3500);
  h += "<!DOCTYPE html><html lang='pt-BR'><head><meta charset='UTF-8'>";
  h += "<meta name='viewport' content='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no'>";
  h += "<meta name='theme-color' content='#0f172a'>";
  h += "<title>Top Lavanderia — Wi-Fi</title>";
  h += "<style>";
  h += ":root{--bg1:#0f172a;--bg2:#1e3a5f;--card:rgba(30,41,59,.92);--line:#334155;--txt:#f8fafc;--muted:#94a3b8;--acc:#38bdf8;--ok:#4ade80;}";
  h += "*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;";
  h += "background:linear-gradient(165deg,var(--bg1),var(--bg2));color:var(--txt);padding:24px 16px 40px;}";
  h += ".wrap{max-width:400px;margin:0 auto}";
  h += "h1{font-size:1.3rem;margin:0 0 4px;font-weight:700;text-align:center}";
  h += ".sub{color:var(--muted);font-size:.85rem;text-align:center;margin-bottom:20px}";
  h += ".card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;box-shadow:0 12px 40px rgba(0,0,0,.35)}";
  h += "label{display:block;font-size:.8rem;font-weight:600;color:var(--muted);margin:0 0 6px}";
  h += ".nets{list-style:none;margin:0 0 16px;padding:0;max-height:220px;overflow-y:auto;border:1px solid var(--line);border-radius:12px}";
  h += ".nets li{padding:12px 14px;border-bottom:1px solid var(--line);cursor:pointer;display:flex;justify-content:space-between;align-items:center;font-size:.95rem}";
  h += ".nets li:last-child{border-bottom:none}";
  h += ".nets li:active,.nets li.sel{background:rgba(56,189,248,.15)}";
  h += ".nets li.sel{color:var(--acc);font-weight:600}";
  h += ".rssi{font-size:.75rem;color:var(--muted)}";
  h += ".scanning{text-align:center;padding:18px;color:var(--muted);font-size:.9rem}";
  h += "input{width:100%;padding:14px;border-radius:12px;border:1px solid var(--line);background:#0f172a;color:var(--txt);font-size:1rem;margin-top:6px}";
  h += "input:focus{outline:2px solid var(--acc);outline-offset:2px}";
  h += "button{margin-top:18px;width:100%;padding:16px;border:0;border-radius:12px;background:linear-gradient(135deg,#0ea5e9,#2563eb);";
  h += "color:#fff;font-size:1.05rem;font-weight:700;cursor:pointer}";
  h += "button:active{transform:scale(.98)}";
  h += "button:disabled{opacity:.5;cursor:not-allowed}";
  h += ".rescan{margin-top:10px;width:100%;padding:12px;border:1px solid var(--line);border-radius:12px;background:transparent;color:var(--acc);font-size:.9rem;font-weight:600;cursor:pointer}";
  h += ".foot{margin-top:16px;font-size:.75rem;color:var(--muted);text-align:center}";
  h += "</style></head><body><div class='wrap'>";
  h += "<h1>Configurar Wi-Fi</h1>";
  h += "<p class='sub'>Selecione a rede da lavanderia</p>";
  h += "<div class='card'>";
  h += "<form id='wf' method='POST' action='/wifi/save'>";
  h += "<input type='hidden' id='in_ssid' name='ssid' value='" + ssidEsc + "'/>";
  h += "<label>Redes disponíveis</label>";
  h += "<div id='netbox'><div class='scanning'>Buscando redes...</div></div>";
  h += "<button type='button' class='rescan' onclick='scan()'>Buscar novamente</button>";
  h += "<label style='margin-top:16px'>Senha da rede</label>";
  h += "<input id='in_pass' name='password' type='password' maxlength='64' placeholder='Digite a senha do Wi-Fi'/>";
  h += "<button type='submit' id='btn' disabled>Conectar</button>";
  h += "</form></div>";
  h += "<p class='foot'>Top Lavanderia · Equipamento: " + String(ESP32_ID) + "</p>";
  h += "<script>";
  h += "var sel='';";
  h += "function pick(s){sel=s;document.getElementById('in_ssid').value=s;document.getElementById('btn').disabled=false;";
  h += "document.querySelectorAll('.nets li').forEach(function(l){l.classList.toggle('sel',l.dataset.s===s)});}";
  h += "function bars(r){if(r>=-50)return'▂▄▆█';if(r>=-65)return'▂▄▆';if(r>=-75)return'▂▄';return'▂';}";
  h += "function scan(){";
  h += "document.getElementById('netbox').innerHTML='<div class=\"scanning\">Buscando redes...</div>';";
  h += "fetch('/wifi/scan').then(function(r){return r.json()}).then(function(d){";
  h += "if(!d.length){document.getElementById('netbox').innerHTML='<div class=\"scanning\">Nenhuma rede encontrada</div>';return;}";
  h += "var u='<ul class=\"nets\">';";
  h += "d.forEach(function(n){u+='<li data-s=\"'+n.s+'\" onclick=\"pick(\\''+n.s.replace(/'/g,\"\\\\'\")+'\\')\">';";
  h += "u+='<span>'+n.s+'</span><span class=\"rssi\">'+bars(n.r)+' '+n.r+'dBm</span></li>';});";
  h += "u+='</ul>';document.getElementById('netbox').innerHTML=u;";
  h += "if(sel){document.querySelectorAll('.nets li').forEach(function(l){l.classList.toggle('sel',l.dataset.s===sel)});}";
  h += "}).catch(function(){document.getElementById('netbox').innerHTML='<div class=\"scanning\">Erro ao buscar redes</div>';});}";
  h += "scan();";
  h += "</script>";
  h += "</div></body></html>";
  return h;
}

void sendConfigPortalPage() {
  server.sendHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  server.send(200, "text/html", buildConfigPortalHtml());
}

/** Android / alguns probes: redireciona para a página de configuração (abre aviso de “login na rede”). */
void handleCaptive302ToPortal() {
  server.sendHeader("Location", configPortalUrl(), true);
  server.send(302, "text/plain", "");
}

/** Codifica valor para query string (?esp32_id=...) — espaços em "lavadora teste 2" quebravam o GET (HTTP 400). */
String urlEncodeQueryValue(const char* in) {
  String out;
  for (size_t i = 0; in[i]; i++) {
    unsigned char c = (unsigned char)in[i];
    if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-' || c == '_' || c == '.' || c == '~') {
      out += (char)c;
    } else {
      char buf[4];
      snprintf(buf, sizeof(buf), "%%%02X", c);
      out += buf;
    }
  }
  return out;
}

void setup() {
  Serial.begin(115200);
  Serial.println("\n\n========================================");
  Serial.println("ESP32 Lavadora Individual v2.1.3");

  // Configurar hardware
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(LED_PIN, LOW);

  // WiFi precisa estar inicializado ANTES de ler o MAC e antes de server.begin()
  WiFi.mode(WIFI_AP_STA);
  delay(100);

  buildEsp32Id();
  Serial.printf("ESP32 ID (auto MAC): %s\n", ESP32_ID);
  Serial.println("========================================");
  
  // Configurar rotas HTTP
  setupRoutes();
  
  // Iniciar servidor
  server.begin();
  Serial.println("🌐 Servidor web iniciado na porta 80");
  Serial.println("========================================\n");

  if (!loadWiFiCredentials()) {
    Serial.println("⚠️ Sem Wi-Fi salvo. Iniciando configuração via AP.");
    startConfigPortal();
    return;
  }

  // Conectar WiFi usando credenciais salvas
  connectWiFi();
  
  // Enviar primeiro heartbeat
  sendHeartbeat();
}

void loop() {
  server.handleClient();
  if (configModeActive) {
    dnsServer.processNextRequest();
  }

  unsigned long now = millis();

  if (WiFi.status() != WL_CONNECTED) {
    if (!configModeActive) {
      startConfigPortal();
    }
    if (configuredSsid.length() > 0 && (now - lastWifiRetry >= WIFI_RETRY_INTERVAL)) {
      lastWifiRetry = now;
      Serial.println("🔄 Tentando reconectar ao Wi-Fi salvo...");
      connectWiFi();
    }
    delay(10);
    return;
  }

  if (configModeActive) {
    stopConfigPortal();
  }

  // Fim do ciclo: contagem local (relé já está desligado após o pulso de crédito)
  if (machineRunning && cycleTimeMinutes > 0) {
    unsigned long cycleMs = (unsigned long)cycleTimeMinutes * 60UL * 1000UL;
    if (now - machineStartTime >= cycleMs) {
      Serial.printf("⏱️ Ciclo concluído (%d min)\n", cycleTimeMinutes);
      machineRunning = false;
      sendHeartbeat();
    }
  }

  // Buscar comandos enfileirados pelo totem (esp32-control → pending_commands)
  if (now - lastPoll >= POLL_INTERVAL) {
    pollSupabaseCommands();
    lastPoll = now;
  }

  // Enviar heartbeat periódico
  if (now - lastHeartbeat > HEARTBEAT_INTERVAL) {
    sendHeartbeat();
  }

  delay(10);
}

// ================== CONEXÃO WIFI ==================
void connectWiFi() {
  if (configuredSsid.length() == 0) {
    Serial.println("❌ Nenhuma credencial Wi-Fi salva.");
    startConfigPortal();
    return;
  }

  Serial.println("📡 Conectando ao WiFi...");
  Serial.printf("   SSID: %s\n", configuredSsid.c_str());
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(configuredSsid.c_str(), configuredPassword.c_str());
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    stopConfigPortal();
    Serial.println("\n✅ WiFi conectado com sucesso!");
    Serial.printf("   IP: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("   Sinal: %d dBm\n", WiFi.RSSI());
  } else {
    Serial.println("\n❌ Falha ao conectar WiFi!");
    Serial.println("   Entre no AP de configuração para revisar SSID/senha.");
    startConfigPortal();
  }
}

// ================== ROTAS HTTP ==================
void setupRoutes() {
  server.on("/", HTTP_GET, handleRoot);
  server.on("/wifi", HTTP_GET, handleRoot);
  server.on("/wifi/scan", HTTP_GET, []() {
    int n = WiFi.scanNetworks();
    String json = "[";
    for (int i = 0; i < n; i++) {
      String ssid = WiFi.SSID(i);
      if (ssid.length() == 0) continue;
      bool dup = false;
      for (int j = 0; j < i; j++) {
        if (WiFi.SSID(j) == ssid) { dup = true; break; }
      }
      if (dup) continue;
      if (json.length() > 1) json += ",";
      json += "{\"s\":\"" + escapeHtml(ssid) + "\",\"r\":" + String(WiFi.RSSI(i)) + "}";
    }
    json += "]";
    WiFi.scanDelete();
    server.sendHeader("Cache-Control", "no-store");
    server.send(200, "application/json", json);
  });
  server.on("/wifi/save", HTTP_POST, []() {
    String newSsid = server.arg("ssid");
    String newPassword = server.arg("password");
    newSsid.trim();
    newPassword.trim();

    if (newSsid.length() == 0) {
      server.send(400, "text/html",
                  "<!DOCTYPE html><html><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
                  "<title>Erro</title></head><body style='font-family:system-ui;padding:24px'>"
                  "<h2>Informe o nome da rede</h2><p>O campo <strong>SSID</strong> é obrigatório.</p>"
                  "<p><a href='/wifi'>Voltar</a></p></body></html>");
      return;
    }

    saveWiFiCredentials(newSsid, newPassword);
    Serial.println("💾 Novo Wi-Fi salvo via portal de configuração.");

    String ok =
        "<!DOCTYPE html><html lang='pt-BR'><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
        "<meta http-equiv='refresh' content='8;url=/wifi'><title>Salvo</title>"
        "<style>body{font-family:system-ui;background:#0f172a;color:#f8fafc;padding:24px;text-align:center}"
        ".box{max-width:420px;margin:40px auto;background:#1e293b;border-radius:16px;padding:24px;border:1px solid #334155}"
        "a{color:#38bdf8}</style></head><body><div class='box'>"
        "<h2>Wi-Fi salvo</h2><p>O equipamento está tentando conectar na rede <strong>" +
        escapeHtml(newSsid) +
        "</strong>.</p>"
        "<p>Daqui a pouco <strong>reconecte o celular ao Wi-Fi normal da lavanderia</strong> (saiu do Wi-Fi do ESP).</p>"
        "<p><a href='/wifi'>Ver status / tentar de novo</a></p></div></body></html>";
    server.send(200, "text/html", ok);
    delay(300);
    connectWiFi();
  });

  // Detecção de “rede sem internet” — ajuda o celular a abrir o portal automaticamente
  server.on("/generate_204", HTTP_GET, handleCaptive302ToPortal);
  server.on("/gen_204", HTTP_GET, handleCaptive302ToPortal);
  server.on("/hotspot-detect.html", HTTP_GET, sendConfigPortalPage);
  server.on("/library/test/success.html", HTTP_GET, handleCaptive302ToPortal);
  server.on("/connecttest.txt", HTTP_GET, handleCaptive302ToPortal);
  server.on("/redirect", HTTP_GET, handleCaptive302ToPortal);
  server.on("/ncsi.txt", HTTP_GET, []() {
    server.send(200, "text/plain", "TopLavanderia captive portal");
  });

  server.on("/status", HTTP_GET, handleStatus);
  server.on("/start", HTTP_POST, handleStart);
  server.on("/stop", HTTP_POST, handleStop);
  server.onNotFound(handleNotFound);
}

void handleRoot() {
  if (configModeActive || WiFi.status() != WL_CONNECTED) {
    sendConfigPortalPage();
    return;
  }

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
  html += "<div class='status'><span class='label'>Nome:</span><span class='value'>" + String(MACHINE_NAME) + "</span></div>";
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
  doc["machine_name"] = MACHINE_NAME;
  doc["laundry_id"] = LAUNDRY_ID;
  doc["ip_address"] = WiFi.localIP().toString();
  doc["signal_strength"] = WiFi.RSSI();
  doc["network_status"] = "connected";
  doc["firmware_version"] = "v2.2.0";
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
  pulseCreditRelay();
  server.send(200, "application/json", "{\"success\":true,\"message\":\"Crédito enviado (pulso)\"}");
  Serial.println("✅ Pulso de crédito enviado");
  sendHeartbeat();
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
  if (configModeActive || WiFi.status() != WL_CONNECTED) {
    sendConfigPortalPage();
    return;
  }
  server.send(404, "application/json", "{\"error\":\"Rota não encontrada\"}");
}

// ================== POLL (pagamento totem → pending_commands) ==================
void confirmSupabaseCommand(const String& commandId) {
  if (WiFi.status() != WL_CONNECTED || commandId.length() == 0) return;
  HTTPClient http;
  String url = String(supabaseUrl) + "/functions/v1/esp32-monitor?action=confirm_command";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", supabaseApiKey);
  http.addHeader("Authorization", String("Bearer ") + String(supabaseApiKey));
  StaticJsonDocument<256> doc;
  doc["command_id"] = commandId;
  doc["esp32_id"] = ESP32_ID;
  String payload;
  serializeJson(doc, payload);
  int code = http.POST(payload);
  if (code == 200) {
    Serial.println("✅ confirm_command OK: " + commandId);
  } else {
    Serial.printf("❌ confirm_command HTTP %d\n", code);
  }
  http.end();
}

void pollSupabaseCommands() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String enc = urlEncodeQueryValue(ESP32_ID);
  String url = String(supabaseUrl) + "/functions/v1/esp32-monitor?action=poll_commands&esp32_id=" + enc;
  http.begin(url);
  http.addHeader("apikey", supabaseApiKey);
  http.addHeader("Authorization", String("Bearer ") + String(supabaseApiKey));
  int code = http.GET();
  if (code != 200) {
    Serial.printf("❌ poll_commands HTTP %d\n", code);
    http.end();
    return;
  }
  String response = http.getString();
  http.end();

  DynamicJsonDocument doc(4096);
  if (deserializeJson(doc, response)) {
    Serial.println("❌ JSON poll inválido");
    return;
  }
  if (!doc["success"].as<bool>()) return;

  JsonArray cmds = doc["commands"].as<JsonArray>();
  if (cmds.size() == 0) return;

  Serial.printf("📋 poll_commands: %d comando(s)\n", cmds.size());

  for (size_t i = 0; i < cmds.size(); i++) {
    JsonObject c = cmds[i];
    String cid = c["id"].as<String>();
    String action = c["action"].as<String>();
    action.toLowerCase();
    int cmdRelay = c["relay_pin"] | RELAY_LOGICAL_PIN;
    Serial.printf("📌 Comando relay_%d → GPIO físico %d\n", cmdRelay, RELAY_PIN);

    if (action == "on" || action == "activate" || action == "turn_on") {
      if (c.containsKey("cycle_time_minutes") && !c["cycle_time_minutes"].isNull()) {
        int newCycle = c["cycle_time_minutes"].as<int>();
        if (newCycle > 0 && newCycle != cycleTimeMinutes) {
          Serial.printf("🔄 cycle_time atualizado via comando: %d → %d min\n", cycleTimeMinutes, newCycle);
          cycleTimeMinutes = newCycle;
        }
      }
      pulseCreditRelay();
      Serial.printf("⚡ Fila Supabase: crédito (pulso %lu ms, ciclo: %d min)\n", RELAY_PULSE_MS, cycleTimeMinutes);
    } else if (action == "off" || action == "deactivate" || action == "turn_off") {
      relayState = false;
      machineRunning = false;
      digitalWrite(RELAY_PIN, LOW);
      digitalWrite(LED_PIN, LOW);
      Serial.println("⚡ Fila Supabase: OFF");
    } else {
      Serial.println("⚡ Ação desconhecida: " + action);
    }
    confirmSupabaseCommand(cid);
    sendHeartbeat();
  }
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
  
  // Preparar JSON simplificado
  StaticJsonDocument<768> doc;
  doc["esp32_id"] = ESP32_ID;
  doc["laundry_id"] = LAUNDRY_ID;
  doc["ip_address"] = WiFi.localIP().toString();
  doc["signal_strength"] = WiFi.RSSI();
  doc["network_status"] = "connected";
  doc["firmware_version"] = "v2.2.0";
  doc["uptime_seconds"] = millis() / 1000;
  doc["is_active"] = machineRunning;
  doc["device_name"] = MACHINE_NAME;
  if (!registeredWithServer) {
    doc["auto_register"] = true;
  }
  
  // relay_N: estado lógico do ciclo (relé físico só pulsa 100ms; machineRunning = crédito ativo)
  JsonObject relayStatusObj = doc.createNestedObject("relay_status");
  String relayKey = "relay_" + String(RELAY_LOGICAL_PIN);
  relayStatusObj[relayKey] = machineRunning ? "on" : "off";
  
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
    registeredWithServer = true;

    DynamicJsonDocument respDoc(1024);
    if (!deserializeJson(respDoc, response) && respDoc.containsKey("config")) {
      JsonObject cfg = respDoc["config"];
      if (cfg.containsKey("cycle_time_minutes") && !cfg["cycle_time_minutes"].isNull()) {
        int newCycle = cfg["cycle_time_minutes"].as<int>();
        if (newCycle > 0 && newCycle != cycleTimeMinutes) {
          Serial.printf("🔄 cycle_time atualizado via heartbeat: %d → %d min\n", cycleTimeMinutes, newCycle);
          cycleTimeMinutes = newCycle;
        }
      }
    }
  } else {
    Serial.printf("❌ Erro no heartbeat - HTTP %d\n", httpCode);
    Serial.println("Erro: " + http.errorToString(httpCode));
  }
  
  http.end();
  Serial.println();
}
