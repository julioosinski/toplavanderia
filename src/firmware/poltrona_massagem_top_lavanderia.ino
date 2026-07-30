/**
 * ESP32 Poltrona de Massagem — Top Lavanderia
 * Perfil: timed_session — pending_commands action "on" / "off" via esp32-monitor
 *
 * Placeholders:
 *   __LAUNDRY_ID__  __MACHINE_NAME__  __DEFAULT_CYCLE_MINUTES__
 *
 * Hardware: Relé GPIO 26 (BC547 HIGH=liga) | DFPlayer TX16 RX17
 *
 * v1.3.2 — ESTABILIDADE DE REDE (corrige offline + liberação que não chega):
 * - HTTPS com WiFiClientSecure + connect/response timeout; sem gpio_hold; watchdog
 * v1.3.3 — Resfriamento pós-massagem (não bloqueante):
 * - Após fim do tempo OU Parar manual: pausa 2s → relé ON 30s → OFF
 * - Sem delay() longo (Wi‑Fi/heartbeat continuam durante o resfriamento)
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DFRobotDFPlayerMini.h>
#include <esp_task_wdt.h>
#include <Preferences.h>
#include <cstdio>
#include <esp_system.h>

#define FIRMWARE_VERSION "v1.3.3-toplav-poltrona"

#define LAUNDRY_ID "__LAUNDRY_ID__"
#define MACHINE_NAME "__MACHINE_NAME__"
#define DEFAULT_CYCLE_MINUTES __DEFAULT_CYCLE_MINUTES__

#include "esp32_wifi_ota_common.h"

const char* supabaseUrl = "https://rkdybjzwiwwqqzjfmerm.supabase.co";
const char* supabaseApiKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZHlianp3aXd3cXF6amZtZXJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMDgxNjcsImV4cCI6MjA2ODg4NDE2N30.CnRP8lrmGmvcbHmWdy72ZWlfZ28cDdNoxdADnyFAOXg";

const int RELAY_PIN = 26;
const bool RELAY_LOGICA_INVERTIDA = false;

const unsigned long HEARTBEAT_INTERVAL_MS = 25000;
const unsigned long POLL_INTERVAL_MS = 8000;
const unsigned long HTTP_TIMEOUT_MS = 5000;
const unsigned long HTTP_CONNECT_TIMEOUT_MS = 4000;
const unsigned long RELAY_REASSERT_MS = 5000;
const int NET_FAIL_RECONNECT = 3;
const int NET_FAIL_RESTART = 8;

/** Resfriamento: pausa (relé off) → motor 30s → off. Sem delay bloqueante. */
const unsigned long COOL_PAUSE_MS = 2000;
const unsigned long COOL_RUN_MS = 30000;
const int COOL_IDLE = 0;
const int COOL_PAUSE = 1;
const int COOL_RUN = 2;

HardwareSerial dfSerial(2);
DFRobotDFPlayerMini dfPlayer;
bool dfplayerDisponivel = false;

int volume_audio_001 = 27;
int volume_audio_002 = 27;
int volume_audio_003 = 27;
int volume_audio_004 = 27;
int volume_audio_005 = 27;
int volume_audio_006 = 27;
int volume_audio_007 = 18;

unsigned long tempo_inicio_audios = 0;
unsigned long ultimo_play_audio_007 = 0;
int proximoAudioNum = 0;
const unsigned long AUDIO_007_LOOP_MS = 70000;
const unsigned long AUDIO_007_DURACAO_MS = 599000;

String statusAtual = "disponivel";
unsigned long tempoInicioCiclo = 0;
unsigned long tempoTotalSeg = 0;
unsigned long tempoRestanteSeg = 0;
unsigned long sessionEndsAtMs = 0;
unsigned long ultimoDesligamento = 0;
const unsigned long COOLDOWN_MS = 2000;
int coolPhase = COOL_IDLE;
unsigned long coolPhaseStartedAt = 0;

char ESP32_ID[16];
unsigned long lastHeartbeat = 0;
unsigned long lastPoll = 0;
unsigned long lastRelayReassert = 0;
unsigned long lastNetOkMs = 0;
int netFailCount = 0;
const char* lastResetReason = "unknown";
String lastExecutedCommandId = "";
Preferences sessionPrefs;
int relayAppliedLevel = -1;

bool sendHeartbeat();
bool confirmCommand(const char* commandId);

const char* describeResetReason() {
  switch (esp_reset_reason()) {
    case ESP_RST_POWERON: return "poweron";
    case ESP_RST_SW: return "software";
    case ESP_RST_PANIC: return "panic";
    case ESP_RST_INT_WDT: return "int_wdt";
    case ESP_RST_TASK_WDT: return "task_wdt";
    case ESP_RST_WDT: return "wdt";
    case ESP_RST_BROWNOUT: return "brownout";
    default: return "unknown";
  }
}

void noteNetOk() {
  lastNetOkMs = millis();
  netFailCount = 0;
}

void noteNetFail() {
  netFailCount++;
  Serial.printf("Falha de rede #%d\n", netFailCount);
}

void loadLastExecutedCommandId() {
  sessionPrefs.begin("poltrona_cmd", true);
  lastExecutedCommandId = sessionPrefs.getString("last_id", "");
  sessionPrefs.end();
}

void markCommandExecuted(const String& cmdId) {
  lastExecutedCommandId = cmdId;
  sessionPrefs.begin("poltrona_cmd", false);
  sessionPrefs.putString("last_id", cmdId);
  sessionPrefs.end();
}

bool peekPersistedSessionActive() {
  sessionPrefs.begin("poltrona_sess", true);
  bool active = sessionPrefs.getBool("active", false);
  unsigned long remain = sessionPrefs.getULong("remain_s", 0);
  sessionPrefs.end();
  return active && remain >= 15;
}

void clearPersistedSession() {
  sessionPrefs.begin("poltrona_sess", false);
  sessionPrefs.clear();
  sessionPrefs.end();
}

void persistActiveSession() {
  if (statusAtual != "em_uso" || tempoRestanteSeg == 0) {
    clearPersistedSession();
    return;
  }
  sessionPrefs.begin("poltrona_sess", false);
  sessionPrefs.putBool("active", true);
  sessionPrefs.putULong("remain_s", tempoRestanteSeg);
  sessionPrefs.putULong("saved_at_ms", millis());
  sessionPrefs.end();
}

void buildEsp32Id() {
  WiFi.mode(WIFI_STA);
  delay(50);
  uint8_t mac[6];
  WiFi.macAddress(mac);
  snprintf(ESP32_ID, sizeof(ESP32_ID), "esp32_%02x%02x%02x%02x", mac[2], mac[3], mac[4], mac[5]);
}

/** Relé simples — SEM gpio_hold (hold no GPIO26 ADC2 derruba o Wi‑Fi e o ESP fica offline). */
void acionarRele(bool ligar) {
  int nivel = ligar
    ? (RELAY_LOGICA_INVERTIDA ? LOW : HIGH)
    : (RELAY_LOGICA_INVERTIDA ? HIGH : LOW);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, nivel);
  relayAppliedLevel = nivel;
  lastRelayReassert = millis();
}

bool relayShouldBeOn() {
  return statusAtual == "em_uso" || coolPhase == COOL_RUN;
}

void reassertRelayIfSession() {
  if (!relayShouldBeOn()) return;
  unsigned long now = millis();
  if (lastRelayReassert != 0 && (now - lastRelayReassert) < RELAY_REASSERT_MS) return;
  digitalWrite(RELAY_PIN, RELAY_LOGICA_INVERTIDA ? LOW : HIGH);
  relayAppliedLevel = RELAY_LOGICA_INVERTIDA ? LOW : HIGH;
  lastRelayReassert = now;
}

void pararAudio() {
  proximoAudioNum = 0;
  tempo_inicio_audios = 0;
  ultimo_play_audio_007 = 0;
  if (dfplayerDisponivel) {
    dfPlayer.pause();
  }
}

void cancelCooling() {
  coolPhase = COOL_IDLE;
  coolPhaseStartedAt = 0;
}

void startCooling() {
  // Massagem já desligada → pausa 2s → liga 30s → desliga (tudo no loop, sem delay).
  coolPhase = COOL_PAUSE;
  coolPhaseStartedAt = millis();
  acionarRele(false);
  Serial.println("Resfriamento: pausa 2s, depois 30s ligados");
}

void atualizarResfriamento() {
  if (coolPhase == COOL_IDLE) return;
  unsigned long now = millis();
  if (coolPhase == COOL_PAUSE) {
    if (now - coolPhaseStartedAt >= COOL_PAUSE_MS) {
      coolPhase = COOL_RUN;
      coolPhaseStartedAt = now;
      acionarRele(true);
      Serial.println("Resfriamento: motor ON 30s");
    }
  } else if (coolPhase == COOL_RUN) {
    if (now - coolPhaseStartedAt >= COOL_RUN_MS) {
      acionarRele(false);
      cancelCooling();
      ultimoDesligamento = millis();
      Serial.println("Resfriamento concluído");
      sendHeartbeat();
      lastHeartbeat = millis();
    }
  }
}

/** Encerra a massagem. comResfriamento=true: ciclo pausa+30s (fim natural ou Parar). */
void pararPoltrona(bool comResfriamento) {
  pararAudio();
  clearPersistedSession();
  statusAtual = "disponivel";
  tempoTotalSeg = 0;
  tempoRestanteSeg = 0;
  tempoInicioCiclo = 0;
  sessionEndsAtMs = 0;
  acionarRele(false);
  if (comResfriamento) {
    startCooling();
  } else {
    cancelCooling();
    ultimoDesligamento = millis();
  }
}

bool restorePersistedSession() {
  sessionPrefs.begin("poltrona_sess", true);
  bool active = sessionPrefs.getBool("active", false);
  unsigned long remain = sessionPrefs.getULong("remain_s", 0);
  sessionPrefs.end();
  if (!active || remain < 15) {
    clearPersistedSession();
    return false;
  }
  tempoTotalSeg = remain;
  tempoRestanteSeg = remain;
  tempoInicioCiclo = millis();
  sessionEndsAtMs = millis() + (remain * 1000UL);
  statusAtual = "em_uso";
  acionarRele(true);
  proximoAudioNum = 7;
  tempo_inicio_audios = millis() > AUDIO_007_LOOP_MS ? (millis() - AUDIO_007_LOOP_MS) : 0;
  ultimo_play_audio_007 = millis();
  Serial.printf("Sessão restaurada — %lu s restantes\n", remain);
  return true;
}

bool iniciarPoltrona(int tempoMinutos) {
  if (tempoMinutos <= 0) tempoMinutos = DEFAULT_CYCLE_MINUTES;

  // Novo pagamento durante resfriamento: cancela o cool e inicia a sessão.
  if (coolPhase != COOL_IDLE) {
    cancelCooling();
    acionarRele(false);
  }

  if (statusAtual == "em_uso") {
    unsigned long adicional = (unsigned long)tempoMinutos * 60UL;
    tempoTotalSeg += adicional;
    tempoRestanteSeg += adicional;
    sessionEndsAtMs = (sessionEndsAtMs == 0)
      ? (millis() + tempoRestanteSeg * 1000UL)
      : (sessionEndsAtMs + adicional * 1000UL);
    persistActiveSession();
    acionarRele(true);
    return true;
  }

  if (ultimoDesligamento > 0 && (millis() - ultimoDesligamento) < COOLDOWN_MS) {
    delay(COOLDOWN_MS - (millis() - ultimoDesligamento));
  }

  tempoTotalSeg = (unsigned long)tempoMinutos * 60UL;
  if (tempoTotalSeg < 1150UL) tempoTotalSeg = 1150UL;

  acionarRele(true);
  statusAtual = "em_uso";
  tempoInicioCiclo = millis();
  tempoRestanteSeg = tempoTotalSeg;
  sessionEndsAtMs = millis() + (tempoTotalSeg * 1000UL);
  proximoAudioNum = 0;
  Serial.printf("Poltrona ON — %lu s (%d min)\n", tempoTotalSeg, tempoMinutos);
  persistActiveSession();
  return true;
}

void gerenciarAudios() {
  if (statusAtual != "em_uso" || !dfplayerDisponivel) return;

  if (proximoAudioNum == 0) {
    dfPlayer.volume(volume_audio_001);
    delay(80);
    dfPlayer.play(1);
    tempo_inicio_audios = millis();
    proximoAudioNum = 1;
    return;
  }

  unsigned long elapsed = millis() - tempo_inicio_audios;
  if (elapsed >= 4000 && proximoAudioNum == 1) {
    dfPlayer.volume(volume_audio_002); delay(50); dfPlayer.play(2); proximoAudioNum = 2;
  } else if (elapsed >= 10000 && proximoAudioNum == 2) {
    dfPlayer.volume(volume_audio_003); delay(50); dfPlayer.play(3); proximoAudioNum = 3;
  } else if (elapsed >= 20000 && proximoAudioNum == 3) {
    dfPlayer.volume(volume_audio_004); delay(50); dfPlayer.play(4); proximoAudioNum = 4;
  } else if (elapsed >= 30000 && proximoAudioNum == 4) {
    dfPlayer.volume(volume_audio_005); delay(50); dfPlayer.play(5); proximoAudioNum = 5;
  } else if (elapsed >= 50000 && proximoAudioNum == 5) {
    dfPlayer.volume(volume_audio_006); delay(50); dfPlayer.play(6); proximoAudioNum = 6;
  } else if (elapsed >= AUDIO_007_LOOP_MS && proximoAudioNum == 6) {
    dfPlayer.volume(volume_audio_007); delay(50); dfPlayer.play(7);
    proximoAudioNum = 7; ultimo_play_audio_007 = millis();
  } else if (proximoAudioNum == 7) {
    unsigned long loopElapsed = elapsed - AUDIO_007_LOOP_MS;
    if (loopElapsed >= 18UL * 60UL * 1000UL) {
      dfPlayer.pause();
      proximoAudioNum = 8;
    } else if (ultimo_play_audio_007 > 0 && (millis() - ultimo_play_audio_007) >= AUDIO_007_DURACAO_MS) {
      dfPlayer.volume(volume_audio_007); delay(50); dfPlayer.play(7);
      ultimo_play_audio_007 = millis();
    }
  }
}

void atualizarTimerSessao() {
  if (statusAtual != "em_uso" || sessionEndsAtMs == 0) return;
  unsigned long now = millis();
  if (now >= sessionEndsAtMs) {
    Serial.println("Tempo esgotado — resfriamento");
    pararPoltrona(true);
    sendHeartbeat();
    lastHeartbeat = millis();
    return;
  }
  tempoRestanteSeg = (sessionEndsAtMs - now) / 1000UL;
  static unsigned long lastPersistMs = 0;
  if (lastPersistMs == 0 || (now - lastPersistMs) >= 10000UL) {
    persistActiveSession();
    lastPersistMs = now;
  }
}

/** HTTPS com timeout de conexão — evita o travamento eterno que deixava o ESP "offline". */
bool httpsBegin(HTTPClient& http, WiFiClientSecure& client, const String& url) {
  client.setInsecure();
  client.setTimeout(HTTP_CONNECT_TIMEOUT_MS / 1000);
  http.setConnectTimeout(HTTP_CONNECT_TIMEOUT_MS);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.setReuse(false);
  return http.begin(client, url);
}

bool sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return false;

  WiFiClientSecure client;
  HTTPClient http;
  String url = String(supabaseUrl) + "/functions/v1/esp32-monitor?action=heartbeat";
  if (!httpsBegin(http, client, url)) {
    noteNetFail();
    return false;
  }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", supabaseApiKey);
  http.addHeader("Authorization", String("Bearer ") + supabaseApiKey);

  StaticJsonDocument<768> doc;
  doc["esp32_id"] = ESP32_ID;
  doc["laundry_id"] = LAUNDRY_ID;
  doc["device_name"] = MACHINE_NAME;
  doc["firmware_version"] = FIRMWARE_VERSION;
  doc["ip_address"] = WiFi.localIP().toString();
  doc["signal_strength"] = WiFi.RSSI();
  doc["network_status"] = String("connected|rst:") + lastResetReason;
  doc["auto_register"] = true;
  doc["uptime_seconds"] = millis() / 1000UL;
  doc["session_status"] = statusAtual;
  doc["session_remaining_sec"] = tempoRestanteSeg;
  doc["device_profile"] = "timed_session";
  doc["cooling"] = (coolPhase != COOL_IDLE);
  JsonObject relay = doc.createNestedObject("relay_status");
  relay["relay_1"] = relayShouldBeOn() ? "on" : "off";

  String body;
  serializeJson(doc, body);
  int code = http.POST(body);
  http.end();
  client.stop();

  if (code == 200) {
    noteNetOk();
    return true;
  }
  noteNetFail();
  return false;
}

bool confirmCommand(const char* commandId) {
  if (!commandId || strlen(commandId) == 0) return false;
  if (WiFi.status() != WL_CONNECTED) return false;

  WiFiClientSecure client;
  HTTPClient http;
  String url = String(supabaseUrl) + "/functions/v1/esp32-monitor?action=confirm_command";
  if (!httpsBegin(http, client, url)) {
    noteNetFail();
    return false;
  }
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
  client.stop();
  Serial.printf("confirm %s → %d\n", commandId, code);
  if (code == 200) noteNetOk();
  else noteNetFail();
  return code == 200;
}

int parseCycleMinutes(JsonObject cmd) {
  int minutes = 0;
  if (cmd["cycle_time_minutes"].is<int>()) minutes = cmd["cycle_time_minutes"].as<int>();
  else if (cmd["cycle_time_minutes"].is<float>()) minutes = (int)cmd["cycle_time_minutes"].as<float>();
  else if (cmd["cycle_time_minutes"].is<const char*>()) minutes = atoi(cmd["cycle_time_minutes"].as<const char*>());

  if (minutes <= 0 && cmd.containsKey("payload")) {
    JsonObject payload = cmd["payload"];
    if (!payload.isNull()) {
      if (payload["cycle_time_minutes"].is<int>()) minutes = payload["cycle_time_minutes"].as<int>();
      else if (payload["cycle_time_minutes"].is<float>()) minutes = (int)payload["cycle_time_minutes"].as<float>();
      else if (payload["cycle_time_minutes"].is<const char*>()) minutes = atoi(payload["cycle_time_minutes"].as<const char*>());
    }
  }
  if (minutes <= 0) minutes = DEFAULT_CYCLE_MINUTES;
  if (minutes > 24 * 60) minutes = 24 * 60;
  return minutes;
}

void aplicarVolumeSeValido(JsonObject src, const char* key, int* target) {
  if (!src.containsKey(key) || !target) return;
  int value = src[key] | *target;
  if (value < 0) value = 0;
  if (value > 30) value = 30;
  *target = value;
}

void applyRuntimeAudioConfig(JsonObject cmd) {
  if (!cmd.containsKey("payload")) return;
  JsonObject payload = cmd["payload"];
  if (payload.isNull()) return;
  JsonObject nested = payload["audio_volumes"];
  JsonObject source = nested.isNull() ? payload : nested;
  aplicarVolumeSeValido(source, "volume_audio_001", &volume_audio_001);
  aplicarVolumeSeValido(source, "volume_audio_002", &volume_audio_002);
  aplicarVolumeSeValido(source, "volume_audio_003", &volume_audio_003);
  aplicarVolumeSeValido(source, "volume_audio_004", &volume_audio_004);
  aplicarVolumeSeValido(source, "volume_audio_005", &volume_audio_005);
  aplicarVolumeSeValido(source, "volume_audio_006", &volume_audio_006);
  aplicarVolumeSeValido(source, "volume_audio_007", &volume_audio_007);
}

void processCommand(JsonObject cmd) {
  const char* action = cmd["action"] | "";
  const char* cmdId = cmd["id"] | "";
  if (strlen(cmdId) == 0) return;

  if (lastExecutedCommandId == cmdId) {
    confirmCommand(cmdId);
    return;
  }

  if (strcmp(action, "on") == 0 || strcmp(action, "activate") == 0 || strcmp(action, "turn_on") == 0) {
    applyRuntimeAudioConfig(cmd);
    if (!iniciarPoltrona(parseCycleMinutes(cmd))) return;
    markCommandExecuted(cmdId);
    confirmCommand(cmdId);
    sendHeartbeat();
    lastHeartbeat = millis();
    reassertRelayIfSession();
  } else if (strcmp(action, "off") == 0 || strcmp(action, "deactivate") == 0 || strcmp(action, "turn_off") == 0) {
    bool forceOff = false;
    if (cmd.containsKey("payload")) {
      JsonObject payload = cmd["payload"];
      if (!payload.isNull()) {
        forceOff = payload["force"] | false;
        if (!forceOff) forceOff = payload["remote_stop"] | false;
        if (!forceOff) forceOff = payload["admin_stop"] | false;
      }
    }
    if (statusAtual == "em_uso" && !forceOff) {
      markCommandExecuted(cmdId);
      confirmCommand(cmdId);
      reassertRelayIfSession();
      return;
    }
    markCommandExecuted(cmdId);
    // Parar manual também faz o resfriamento de 30s (não bloqueia a rede).
    pararPoltrona(true);
    confirmCommand(cmdId);
    sendHeartbeat();
    lastHeartbeat = millis();
  }
}

void pollCommands() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  HTTPClient http;
  String url = String(supabaseUrl) + "/functions/v1/esp32-monitor?action=poll_commands&esp32_id=" + ESP32_ID;
  if (!httpsBegin(http, client, url)) {
    noteNetFail();
    return;
  }
  http.addHeader("apikey", supabaseApiKey);
  http.addHeader("Authorization", String("Bearer ") + supabaseApiKey);

  int code = http.GET();
  if (code != 200) {
    http.end();
    client.stop();
    noteNetFail();
    return;
  }

  String payload = http.getString();
  http.end();
  client.stop();
  noteNetOk();

  StaticJsonDocument<3072> doc;
  if (deserializeJson(doc, payload)) return;
  JsonArray commands = doc["commands"].as<JsonArray>();
  if (commands.isNull() || commands.size() == 0) return;

  // Só 1 comando por ciclo — cascata de TLS travava o ESP (offline + liberação morta).
  processCommand(commands[0].as<JsonObject>());
}

bool initDfPlayer() {
  dfSerial.begin(9600, SERIAL_8N1, 17, 16);
  delay(400);
  // Sem ACK: se o DFPlayer não responder, não bloqueia o boot/rede.
  if (!dfPlayer.begin(dfSerial, false, true)) {
    return false;
  }
  delay(200);
  dfPlayer.volume(28);
  dfPlayer.EQ(DFPLAYER_EQ_NORMAL);
  dfPlayer.outputDevice(DFPLAYER_DEVICE_SD);
  return true;
}

void setupDeviceHttpRoutes() {
  esp32HttpServer().on("/", HTTP_GET, []() {
    esp32HttpServer().send(200, "text/html",
      "<h1>Poltrona</h1><p>" + statusAtual + "</p><p>" + String(ESP32_ID) + "</p>");
  });
  esp32HttpServer().on("/status", HTTP_GET, []() {
    StaticJsonDocument<512> doc;
    doc["status"] = statusAtual;
    doc["tempo_restante_segundos"] = tempoRestanteSeg;
    doc["esp32_id"] = ESP32_ID;
    doc["firmware_version"] = FIRMWARE_VERSION;
    doc["device_profile"] = "timed_session";
    doc["ip"] = WiFi.localIP().toString();
    doc["rssi"] = WiFi.RSSI();
    doc["uptime_seconds"] = millis() / 1000UL;
    doc["last_reset_reason"] = lastResetReason;
    doc["net_fail_count"] = netFailCount;
    String out; serializeJson(doc, out);
    esp32HttpServer().sendHeader("Access-Control-Allow-Origin", "*");
    esp32HttpServer().send(200, "application/json", out);
  });
  esp32HttpServer().on("/stop", HTTP_POST, []() {
    pararPoltrona(true);
    sendHeartbeat();
    esp32HttpServer().send(200, "application/json", "{\"success\":true}");
  });
  esp32HttpServer().onNotFound([]() {
    esp32HttpServer().send(404, "application/json", "{\"error\":\"not found\"}");
  });
}

static bool poltronaOtaBusyHook() {
  return statusAtual == "em_uso" || coolPhase != COOL_IDLE;
}

void handleNetWatchdog() {
  if (netFailCount >= NET_FAIL_RESTART) {
    Serial.println("Rede irrecuperável — reiniciando ESP");
    delay(200);
    ESP.restart();
  }
  if (netFailCount >= NET_FAIL_RECONNECT && WiFi.status() == WL_CONNECTED) {
    Serial.println("Reconectando Wi‑Fi após falhas HTTPS");
    WiFi.reconnect();
    delay(500);
  }
}

void setup() {
  Serial.begin(115200);
  delay(150);

  pinMode(RELAY_PIN, OUTPUT);
  bool resumeSession = peekPersistedSessionActive();
  relayAppliedLevel = -1;
  acionarRele(resumeSession);

  loadLastExecutedCommandId();
  buildEsp32Id();
  lastResetReason = describeResetReason();

  Serial.println("=================================");
  Serial.printf(" Poltrona %s\n", FIRMWARE_VERSION);
  Serial.printf(" ESP32_ID: %s rst:%s\n", ESP32_ID, lastResetReason);
  Serial.println("=================================");

  esp_task_wdt_deinit();

  if (resumeSession) restorePersistedSession();
  else { clearPersistedSession(); acionarRele(false); }

  esp32SetOtaBusyHook(poltronaOtaBusyHook);
  esp32WifiOtaRegisterPortalRoutes();
  setupDeviceHttpRoutes();
  esp32WifiOtaBegin();
  WiFi.setSleep(false);

  // Rede primeiro — DFPlayer depois (não pode bloquear o online).
  sendHeartbeat();
  lastHeartbeat = millis();
  lastPoll = millis();
  lastNetOkMs = millis();

  dfplayerDisponivel = initDfPlayer();
  Serial.printf("DFPlayer: %s\n", dfplayerDisponivel ? "OK" : "off");
  reassertRelayIfSession();
}

void loop() {
  if (!esp32WifiOtaMaintain()) {
    gerenciarAudios();
    atualizarTimerSessao();
    atualizarResfriamento();
    reassertRelayIfSession();
    delay(30);
    return;
  }

  gerenciarAudios();
  atualizarTimerSessao();
  atualizarResfriamento();
  reassertRelayIfSession();
  handleNetWatchdog();

  unsigned long now = millis();
  // Alterna HB e poll (nunca os dois no mesmo ciclo) — menos pressão no TLS.
  if (now - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
    sendHeartbeat();
    lastHeartbeat = now;
    reassertRelayIfSession();
  } else if (now - lastPoll >= POLL_INTERVAL_MS) {
    pollCommands();
    lastPoll = now;
    reassertRelayIfSession();
  }

  delay(40);
}
