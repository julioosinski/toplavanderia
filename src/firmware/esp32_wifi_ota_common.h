/**
 * Wi-Fi persistente + portal cativo + OTA remoto (Supabase esp32-firmware-ota).
 * Mesmo padrão das lavadoras/secadoras (esp32LavadoraTemplate.ino v2.2.4).
 *
 * Antes de incluir, defina: FIRMWARE_VERSION, MACHINE_NAME (opcional no rodapé)
 * e declare: extern char ESP32_ID[16]; extern const char* supabaseUrl; extern const char* supabaseApiKey;
 */

#ifndef ESP32_WIFI_OTA_COMMON_H
#define ESP32_WIFI_OTA_COMMON_H

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPUpdate.h>
#include <DNSServer.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <cstdio>

#ifndef FIRMWARE_VERSION
#error "Defina FIRMWARE_VERSION antes de incluir esp32_wifi_ota_common.h"
#endif

#ifndef MACHINE_NAME
#define MACHINE_NAME "Top Lavanderia"
#endif

extern char ESP32_ID[16];
extern const char* supabaseUrl;
extern const char* supabaseApiKey;

static const char* WIFI_NAMESPACE = "wifi_cfg";
static const char* AP_PASSWORD = "toplav123";
static WebServer esp32Server(80);
static DNSServer esp32DnsServer;
static const byte ESP32_DNS_PORT = 53;
static Preferences esp32Preferences;

static String configuredSsid = "";
static String configuredPassword = "";
static bool configModeActive = false;
static bool configPortalSticky = false;
static unsigned long lastWifiRetry = 0;
static unsigned long staConnectStartedAt = 0;
static unsigned long disconnectStartedAt = 0;
static unsigned long lastOtaPoll = 0;

static const unsigned long WIFI_RETRY_INTERVAL = 15000;
static const unsigned long STA_CONNECT_TIMEOUT_MS = 12000;
static const unsigned long CONFIG_PORTAL_HINT_AFTER_MS = 120000;
static const unsigned long OTA_POLL_INTERVAL_MS = 300000; // 5 min (economia; OTA agendado no admin)

static String esp32GetConfigApSsid() {
  String suffix = String(ESP32_ID);
  suffix.replace(" ", "");
  suffix.toUpperCase();
  return "TopLavanderia-" + suffix;
}

static String esp32EscapeHtml(const String& raw) {
  String out;
  out.reserve(raw.length() + 8);
  for (unsigned i = 0; i < raw.length(); i++) {
    char c = raw[i];
    if (c == '&') out += "&amp;";
    else if (c == '"') out += "&quot;";
    else if (c == '<') out += "&lt;";
    else if (c == '>') out += "&gt;";
    else out += c;
  }
  return out;
}

static String esp32ConfigPortalUrl() {
  return String("http://") + WiFi.softAPIP().toString() + "/wifi";
}

static String esp32UrlEncodeQueryValue(const char* in) {
  String out;
  for (size_t i = 0; in[i]; i++) {
    unsigned char c = (unsigned char)in[i];
    if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') ||
        c == '-' || c == '_' || c == '.' || c == '~') {
      out += (char)c;
    } else {
      char buf[4];
      snprintf(buf, sizeof(buf), "%%%02X", c);
      out += buf;
    }
  }
  return out;
}

static void esp32StopConfigPortal() {
  if (!configModeActive) return;
  esp32DnsServer.stop();
  WiFi.softAPdisconnect(true);
  configModeActive = false;
  Serial.println("Portal Wi-Fi encerrado");
}

static bool esp32LoadWiFiCredentials() {
  esp32Preferences.begin(WIFI_NAMESPACE, true);
  configuredSsid = esp32Preferences.getString("ssid", "");
  configuredPassword = esp32Preferences.getString("pass", "");
  esp32Preferences.end();
  configuredSsid.trim();
  configuredPassword.trim();
  return configuredSsid.length() > 0;
}

static void esp32SaveWiFiCredentials(const String& ssid, const String& password) {
  esp32Preferences.begin(WIFI_NAMESPACE, false);
  esp32Preferences.putString("ssid", ssid);
  esp32Preferences.putString("pass", password);
  esp32Preferences.end();
  configuredSsid = ssid;
  configuredPassword = password;
}

static void esp32StartConfigPortal() {
  WiFi.mode(WIFI_AP_STA);
  String apSsid = esp32GetConfigApSsid();
  WiFi.softAP(apSsid.c_str(), AP_PASSWORD);
  delay(120);
  configModeActive = true;
  esp32DnsServer.stop();
  esp32DnsServer.start(ESP32_DNS_PORT, "*", WiFi.softAPIP());
  Serial.println("\nModo configuracao Wi-Fi ativo");
  Serial.printf("   AP: %s | senha: %s\n", apSsid.c_str(), AP_PASSWORD);
  Serial.printf("   Abra: http://%s/wifi\n", WiFi.softAPIP().toString().c_str());
}

static void esp32EnterConfigPortalSticky(const char* reason) {
  configPortalSticky = true;
  if (reason) Serial.println(reason);
  esp32StartConfigPortal();
}

static String esp32BuildConfigPortalHtml() {
  String ssidEsc = esp32EscapeHtml(configuredSsid);
  String h;
  h.reserve(3500);
  h += "<!DOCTYPE html><html lang='pt-BR'><head><meta charset='UTF-8'>";
  h += "<meta name='viewport' content='width=device-width,initial-scale=1'>";
  h += "<title>Top Lavanderia — Wi-Fi</title>";
  h += "<style>body{font-family:system-ui;background:#0f172a;color:#f8fafc;padding:24px}";
  h += ".wrap{max-width:400px;margin:0 auto}h1{font-size:1.3rem;text-align:center}";
  h += ".card{background:#1e293b;border-radius:16px;padding:20px;border:1px solid #334155}";
  h += "label{display:block;font-size:.8rem;color:#94a3b8;margin:0 0 6px}";
  h += ".nets{list-style:none;margin:0 0 16px;padding:0;max-height:220px;overflow-y:auto;border:1px solid #334155;border-radius:12px}";
  h += ".nets li{padding:12px 14px;border-bottom:1px solid #334155;cursor:pointer}";
  h += ".nets li.sel{background:rgba(56,189,248,.15);color:#38bdf8;font-weight:600}";
  h += "input{width:100%;padding:14px;border-radius:12px;border:1px solid #334155;background:#0f172a;color:#f8fafc}";
  h += "button{margin-top:18px;width:100%;padding:16px;border:0;border-radius:12px;background:#2563eb;color:#fff;font-weight:700}";
  h += ".rescan{margin-top:10px;width:100%;padding:12px;border:1px solid #334155;border-radius:12px;background:transparent;color:#38bdf8}";
  h += "</style></head><body><div class='wrap'>";
  h += "<h1>Configurar Wi-Fi</h1>";
  h += "<div class='card'><form method='POST' action='/wifi/save'>";
  h += "<input type='hidden' id='in_ssid' name='ssid' value='" + ssidEsc + "'/>";
  h += "<label>Redes disponíveis</label><div id='netbox'>Buscando...</div>";
  h += "<button type='button' class='rescan' onclick='scan()'>Buscar novamente</button>";
  h += "<label style='margin-top:16px'>Senha</label>";
  h += "<input id='in_pass' name='password' type='password' maxlength='64'/>";
  h += "<button type='submit' id='btn' disabled>Conectar</button></form>";
  h += "<form method='POST' action='/wifi/reset' style='margin-top:12px'>";
  h += "<button type='submit' class='rescan' style='color:#fca5a5'>Esquecer rede e reconfigurar</button>";
  h += "</form></div>";
  h += "<p style='text-align:center;font-size:.75rem;color:#64748b;margin-top:16px'>" + String(MACHINE_NAME) + " · " + String(ESP32_ID) + "</p>";
  h += "<script>var sel='';function pick(s){sel=s;document.getElementById('in_ssid').value=s;document.getElementById('btn').disabled=false;";
  h += "document.querySelectorAll('.nets li').forEach(function(l){l.classList.toggle('sel',l.dataset.s===s)});}";
  h += "function scan(){fetch('/wifi/scan').then(r=>r.json()).then(d=>{";
  h += "if(!d.length){document.getElementById('netbox').innerHTML='Nenhuma rede';return;}";
  h += "var u='<ul class=\"nets\">';d.forEach(function(n){u+='<li data-s=\"'+n.s+'\" onclick=\"pick(\\''+n.s.replace(/'/g,\"\\\\'\")+'\\')\">'+n.s+' ('+n.r+'dBm)</li>';});";
  h += "u+='</ul>';document.getElementById('netbox').innerHTML=u;});}";
  h += "scan();</script></body></html>";
  return h;
}

static void esp32SendConfigPortalPage() {
  esp32Server.sendHeader("Cache-Control", "no-store");
  esp32Server.send(200, "text/html", esp32BuildConfigPortalHtml());
}

static void esp32HandleCaptive302ToPortal() {
  esp32Server.sendHeader("Location", esp32ConfigPortalUrl(), true);
  esp32Server.send(302, "text/plain", "");
}

static void esp32ConnectWiFi(bool waitForResult) {
  if (configuredSsid.length() == 0) {
    esp32EnterConfigPortalSticky("Nenhuma credencial Wi-Fi salva.");
    return;
  }

  Serial.printf("Conectando Wi-Fi: %s\n", configuredSsid.c_str());

  if (configModeActive || configPortalSticky) {
    WiFi.mode(WIFI_AP_STA);
    WiFi.softAP(esp32GetConfigApSsid().c_str(), AP_PASSWORD);
    if (configModeActive) {
      esp32DnsServer.stop();
      esp32DnsServer.start(ESP32_DNS_PORT, "*", WiFi.softAPIP());
    }
  } else {
    WiFi.mode(WIFI_STA);
  }

  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);
  WiFi.disconnect(false, true);
  delay(80);
  WiFi.begin(configuredSsid.c_str(), configuredPassword.c_str());
  staConnectStartedAt = millis();

  if (!waitForResult) return;

  unsigned long started = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - started) < STA_CONNECT_TIMEOUT_MS) {
    esp32Server.handleClient();
    if (configModeActive) esp32DnsServer.processNextRequest();
    delay(50);
  }

  if (WiFi.status() == WL_CONNECTED) {
    configPortalSticky = false;
    esp32StopConfigPortal();
    Serial.printf("Wi-Fi OK — IP %s RSSI %d\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
  } else {
    staConnectStartedAt = 0;
    Serial.println("Falha Wi-Fi — nova tentativa automatica em breve.");
  }
}

static void esp32ClearWiFiCredentials() {
  esp32Preferences.begin(WIFI_NAMESPACE, false);
  esp32Preferences.clear();
  esp32Preferences.end();
  configuredSsid = "";
  configuredPassword = "";
  configPortalSticky = true;
  WiFi.disconnect(true, true);
  esp32EnterConfigPortalSticky("Credenciais apagadas — selecione a nova rede.");
}

static void esp32ReportOtaResult(const String& jobId, bool success, const String& message) {
  if (WiFi.status() != WL_CONNECTED || jobId.length() == 0) return;

  HTTPClient http;
  http.begin(String(supabaseUrl) + "/functions/v1/esp32-firmware-ota?action=report");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", supabaseApiKey);
  http.addHeader("Authorization", String("Bearer ") + String(supabaseApiKey));

  StaticJsonDocument<512> doc;
  doc["job_id"] = jobId;
  doc["esp32_id"] = ESP32_ID;
  doc["success"] = success;
  if (success) doc["firmware_version"] = FIRMWARE_VERSION;
  else doc["error_message"] = message;

  String payload;
  serializeJson(doc, payload);
  int code = http.POST(payload);
  Serial.printf("OTA report HTTP %d (%s)\n", code, success ? "ok" : "fail");
  http.end();
}

static void esp32PollOtaUpdate() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String enc = esp32UrlEncodeQueryValue(ESP32_ID);
  String url = String(supabaseUrl) + "/functions/v1/esp32-firmware-ota?action=poll&esp32_id=" + enc;
  http.begin(url);
  http.addHeader("apikey", supabaseApiKey);
  http.addHeader("Authorization", String("Bearer ") + String(supabaseApiKey));

  int code = http.GET();
  if (code != 200) {
    Serial.printf("OTA poll HTTP %d\n", code);
    http.end();
    return;
  }

  String response = http.getString();
  http.end();

  DynamicJsonDocument doc(2048);
  if (deserializeJson(doc, response)) {
    Serial.println("OTA poll JSON invalido");
    return;
  }
  if (!doc["success"].as<bool>() || doc["ota"].isNull()) return;

  JsonObject ota = doc["ota"].as<JsonObject>();
  String jobId = ota["job_id"].as<String>();
  String targetVersion = ota["version"].as<String>();
  String otaUrl = ota["url"].as<String>();

  if (otaUrl.length() == 0 || jobId.length() == 0) return;

  Serial.printf("OTA %s -> %s (job %s)\n", FIRMWARE_VERSION, targetVersion.c_str(), jobId.c_str());

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(120000);

  httpUpdate.rebootOnUpdate(true);
  httpUpdate.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);

  t_httpUpdate_return ret = httpUpdate.update(client, otaUrl);
  if (ret == HTTP_UPDATE_OK) {
    Serial.println("OTA aplicado — reiniciando...");
  } else {
    String err = String(httpUpdate.getLastError()) + " " + httpUpdate.getLastErrorString().c_str();
    Serial.printf("OTA falhou: %s\n", err.c_str());
    esp32ReportOtaResult(jobId, false, err);
  }
}

static void esp32RegisterWifiPortalRoutes() {
  esp32Server.on("/wifi", HTTP_GET, esp32SendConfigPortalPage);
  esp32Server.on("/wifi/scan", HTTP_GET, []() {
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
      json += "{\"s\":\"" + esp32EscapeHtml(ssid) + "\",\"r\":" + String(WiFi.RSSI(i)) + "}";
    }
    json += "]";
    WiFi.scanDelete();
    esp32Server.sendHeader("Cache-Control", "no-store");
    esp32Server.send(200, "application/json", json);
  });
  esp32Server.on("/wifi/save", HTTP_POST, []() {
    String newSsid = esp32Server.arg("ssid");
    String newPassword = esp32Server.arg("password");
    newSsid.trim();
    newPassword.trim();
    if (newSsid.length() == 0) {
      esp32Server.send(400, "text/plain", "SSID obrigatorio");
      return;
    }
    esp32SaveWiFiCredentials(newSsid, newPassword);
    esp32Server.send(200, "text/html", "<html><body><h2>Wi-Fi salvo</h2><p>Conectando...</p></body></html>");
    delay(300);
    configPortalSticky = false;
    esp32ConnectWiFi(true);
  });
  esp32Server.on("/wifi/reset", HTTP_POST, []() {
    esp32ClearWiFiCredentials();
    esp32Server.sendHeader("Location", "/wifi", true);
    esp32Server.send(302, "text/plain", "");
  });
  esp32Server.on("/generate_204", HTTP_GET, esp32HandleCaptive302ToPortal);
  esp32Server.on("/gen_204", HTTP_GET, esp32HandleCaptive302ToPortal);
  esp32Server.on("/hotspot-detect.html", HTTP_GET, esp32SendConfigPortalPage);
  esp32Server.on("/library/test/success.html", HTTP_GET, esp32HandleCaptive302ToPortal);
  esp32Server.on("/connecttest.txt", HTTP_GET, esp32HandleCaptive302ToPortal);
  esp32Server.on("/redirect", HTTP_GET, esp32HandleCaptive302ToPortal);
}

/** Registra rotas /wifi — chamar antes das rotas do equipamento e de esp32WifiOtaBegin(). */
static void esp32WifiOtaRegisterPortalRoutes() {
  esp32RegisterWifiPortalRoutes();
}

/** Inicia servidor HTTP (rotas já registradas) e conecta Wi-Fi salvo. */
static void esp32WifiOtaBegin() {
  WiFi.mode(WIFI_AP_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);
  delay(100);

  esp32Server.begin();
  Serial.println("Servidor HTTP porta 80");

  if (!esp32LoadWiFiCredentials()) {
    esp32EnterConfigPortalSticky("Sem Wi-Fi salvo — configure pelo portal.");
    return;
  }

  esp32ConnectWiFi(true);
  if (WiFi.status() != WL_CONNECTED) {
    disconnectStartedAt = millis();
  }
}

/** Atalho: portal + begin (sem rotas do equipamento). Prefira RegisterPortalRoutes + rotas + Begin. */
static void esp32WifiOtaSetup() {
  esp32WifiOtaRegisterPortalRoutes();
  esp32WifiOtaBegin();
}

/**
 * Manutenção Wi-Fi + portal + OTA. Chamar no início de loop().
 * Retorna true se Wi-Fi conectado (pode executar lógica do equipamento).
 */
static bool esp32WifiOtaMaintain() {
  esp32Server.handleClient();
  if (configModeActive) {
    esp32DnsServer.processNextRequest();
  }

  unsigned long now = millis();

  if (WiFi.status() != WL_CONNECTED) {
    if (disconnectStartedAt == 0) {
      disconnectStartedAt = now;
      Serial.println("Wi-Fi caiu — reconexao automatica.");
    }

    if (configuredSsid.length() > 0 && (now - lastWifiRetry >= WIFI_RETRY_INTERVAL)) {
      lastWifiRetry = now;
      esp32ConnectWiFi(false);
    }

    if (configPortalSticky && !configModeActive) {
      esp32StartConfigPortal();
    } else if (
      configuredSsid.length() > 0 &&
      !configPortalSticky &&
      (now - disconnectStartedAt >= CONFIG_PORTAL_HINT_AFTER_MS) &&
      !configModeActive
    ) {
      Serial.println("Portal auxiliar aberto — reconexao continua.");
      esp32StartConfigPortal();
    }

    return false;
  }

  if (disconnectStartedAt != 0) {
    Serial.println("Wi-Fi reconectado.");
  }
  disconnectStartedAt = 0;
  configPortalSticky = false;
  staConnectStartedAt = 0;
  if (configModeActive) {
    esp32StopConfigPortal();
  }

  if (now - lastOtaPoll >= OTA_POLL_INTERVAL_MS) {
    esp32PollOtaUpdate();
    lastOtaPoll = now;
  }

  return true;
}

static WebServer& esp32HttpServer() {
  return esp32Server;
}

#endif
