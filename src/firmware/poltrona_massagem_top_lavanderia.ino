/**
 * ESP32 Poltrona de Massagem — Top Lavanderia
 * Perfil: timed_session — pending_commands action "on" / "off" via esp32-monitor
 *
 * Placeholders (substituir ao gerar pelo admin ou manualmente):
 *   __LAUNDRY_ID__     — UUID da lavanderia (ex.: Sinuelo)
 *   __MACHINE_NAME__   — Nome exibido no heartbeat
 *   __DEFAULT_CYCLE_MINUTES__ — Tempo padrão se o comando não trouxer cycle_time_minutes
 *
 * Hardware (igual firmware Poltrona Relax):
 *   Relé massagem: GPIO 26 (BC547 — lógica normal: HIGH=ligado)
 *   DFPlayer Mini: TX=GPIO16, RX=GPIO17 (UART2, 9600)
 * Wi-Fi: portal TopLavanderia-{ESP32_ID} (senha toplav123) — /wifi — reconexão + OTA remoto
 *
 * v1.3.0: remove resfriamento com delay; Parar instantâneo; HB/poll rápidos.
 * v1.3.1: poltrona NÃO desliga sozinha no meio do ciclo —
 *   (1) GPIO26 + Wi‑Fi: hold só na transição ON/OFF + reassert a cada 2s
 *       (sem hold no loop → int_wdt; sem reassert → relé glitcha e “desliga sozinho”)
 *   (2) OFF remoto só com force durante sessão (OFF antigo reentregue não mata o ciclo)
 *   (3) fim de sessão por deadline absoluto (millis), não contagem frágil
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DFRobotDFPlayerMini.h>
#include <esp_task_wdt.h>
#include <Preferences.h>
#include <cstdio>
#include <esp_system.h>
#include "driver/gpio.h"

#define FIRMWARE_VERSION "v1.3.1-toplav-poltrona"

#define LAUNDRY_ID "__LAUNDRY_ID__"
#define MACHINE_NAME "__MACHINE_NAME__"
#define DEFAULT_CYCLE_MINUTES __DEFAULT_CYCLE_MINUTES__

#include "esp32_wifi_ota_common.h"

const char* supabaseUrl = "https://rkdybjzwiwwqqzjfmerm.supabase.co";
const char* supabaseApiKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZHlianp3aXd3cXF6amZtZXJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMDgxNjcsImV4cCI6MjA2ODg4NDE2N30.CnRP8lrmGmvcbHmWdy72ZWlfZ28cDdNoxdADnyFAOXg";

// ===== Hardware =====
const int RELAY_PIN = 26;
const bool RELAY_LOGICA_INVERTIDA = false;  // BC547 — HIGH liga

// Áudios no SD (raiz, FAT32): 001.mp3 … 007.mp3
// ===== Timers rede (fixos — "Parar" e online não podem esperar minutos) =====
const unsigned long HEARTBEAT_INTERVAL_MS = 30000;
const unsigned long POLL_INTERVAL_MS = 10000;
const unsigned long HTTP_TIMEOUT_MS = 8000;

// ===== DFPlayer / áudios =====
HardwareSerial dfSerial(2);
DFRobotDFPlayerMini dfPlayer;
bool dfplayerDisponivel = false;
bool ackEnabled = false;

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
bool audiosPendentes = false;

const unsigned long AUDIO_007_LOOP_MS = 70000;
const unsigned long AUDIO_007_DURACAO_MS = 599000;

// ===== Sessão =====
String statusAtual = "disponivel";
unsigned long tempoInicioCiclo = 0;
unsigned long tempoTotalSeg = 0;
unsigned long tempoRestanteSeg = 0;
/** millis() absoluto em que a sessão deve encerrar (evita desligar cedo por conta errada). */
unsigned long sessionEndsAtMs = 0;
unsigned long ultimoDesligamento = 0;
const unsigned long COOLDOWN_MS = 3000;
const unsigned long RELAY_REASSERT_MS = 2000;

char ESP32_ID[16];

unsigned long lastHeartbeat = 0;
unsigned long lastPoll = 0;
unsigned long lastRelayReassert = 0;
const char* lastResetReason = "unknown";

String lastExecutedCommandId = "";
Preferences sessionPrefs;
int relayAppliedLevel = -1;

const char* describeResetReason() {
  switch (esp_reset_reason()) {
    case ESP_RST_POWERON: return "poweron";
    case ESP_RST_SW: return "software";
    case ESP_RST_PANIC: return "panic";
    case ESP_RST_INT_WDT: return "int_wdt";
    case ESP_RST_TASK_WDT: return "task_wdt";
    case ESP_RST_WDT: return "wdt";
    case ESP_RST_BROWNOUT: return "brownout";
    case ESP_RST_DEEPSLEEP: return "deepsleep";
    case ESP_RST_EXT: return "ext_pin";
    case ESP_RST_SDIO: return "sdio";
    default: return "unknown";
  }
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
  if (statusAtual != "em_uso" || tempoTotalSeg == 0 || tempoInicioCiclo == 0) {
    clearPersistedSession();
    return;
  }
  unsigned long decorrido = (millis() - tempoInicioCiclo) / 1000UL;
  unsigned long restante = (decorrido >= tempoTotalSeg) ? 0UL : (tempoTotalSeg - decorrido);
  sessionPrefs.begin("poltrona_sess", false);
  sessionPrefs.putBool("active", restante > 0);
  sessionPrefs.putULong("remain_s", restante);
  sessionPrefs.putULong("saved_at_ms", millis());
  sessionPrefs.end();
}

void buildEsp32Id() {
  WiFi.mode(WIFI_STA);
  delay(100);
  uint8_t mac[6];
  WiFi.macAddress(mac);
  snprintf(ESP32_ID, sizeof(ESP32_ID), "esp32_%02x%02x%02x%02x", mac[2], mac[3], mac[4], mac[5]);
}

void acionarRele(bool ligar) {
  int nivel = ligar
    ? (RELAY_LOGICA_INVERTIDA ? LOW : HIGH)
    : (RELAY_LOGICA_INVERTIDA ? HIGH : LOW);
  // Hold SÓ na transição: trava GPIO26 contra glitch do Wi‑Fi (ADC2).
  // Nunca chamar hold_dis/en a cada loop — isso causava rst:int_wdt.
  gpio_hold_dis((gpio_num_t)RELAY_PIN);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, nivel);
  if (ligar) {
    gpio_hold_en((gpio_num_t)RELAY_PIN);
  }
  relayAppliedLevel = nivel;
  lastRelayReassert = millis();
}

/** Reafirma HIGH a cada poucos segundos sem martelar hold (Wi‑Fi pode glitchar ADC2). */
void reassertRelayIfSession() {
  if (statusAtual != "em_uso") return;
  unsigned long now = millis();
  if (lastRelayReassert != 0 && (now - lastRelayReassert) < RELAY_REASSERT_MS) return;
  gpio_hold_dis((gpio_num_t)RELAY_PIN);
  digitalWrite(RELAY_PIN, RELAY_LOGICA_INVERTIDA ? LOW : HIGH);
  gpio_hold_en((gpio_num_t)RELAY_PIN);
  relayAppliedLevel = RELAY_LOGICA_INVERTIDA ? LOW : HIGH;
  lastRelayReassert = now;
}

void pararAudio() {
  audiosPendentes = false;
  proximoAudioNum = 0;
  tempo_inicio_audios = 0;
  ultimo_play_audio_007 = 0;
  if (dfplayerDisponivel) {
    dfPlayer.pause();
  }
}

/** Desliga na hora — sem delay/resfriamento (travava Wi‑Fi ~32s e o painel ia offline). */
void pararPoltrona() {
  pararAudio();
  clearPersistedSession();
  acionarRele(false);
  statusAtual = "disponivel";
  tempoTotalSeg = 0;
  tempoRestanteSeg = 0;
  tempoInicioCiclo = 0;
  sessionEndsAtMs = 0;
  ultimoDesligamento = millis();
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
  audiosPendentes = true;
  proximoAudioNum = 7;
  tempo_inicio_audios = millis() > AUDIO_007_LOOP_MS ? (millis() - AUDIO_007_LOOP_MS) : 0;
  ultimo_play_audio_007 = millis();
  Serial.printf("Sessão restaurada após reboot — %lu s restantes\n", remain);
  return true;
}

bool iniciarPoltrona(int tempoMinutos) {
  if (tempoMinutos <= 0) {
    tempoMinutos = DEFAULT_CYCLE_MINUTES;
  }

  if (statusAtual == "em_uso") {
    unsigned long adicional = (unsigned long)tempoMinutos * 60UL;
    tempoTotalSeg += adicional;
    tempoRestanteSeg += adicional;
    if (sessionEndsAtMs == 0) {
      sessionEndsAtMs = millis() + (tempoRestanteSeg * 1000UL);
    } else {
      sessionEndsAtMs += adicional * 1000UL;
    }
    Serial.printf("Poltrona em uso — adicionados %lu s\n", adicional);
    persistActiveSession();
    reassertRelayIfSession();
    return true;
  }

  if (ultimoDesligamento > 0 && (millis() - ultimoDesligamento) < COOLDOWN_MS) {
    unsigned long espera = COOLDOWN_MS - (millis() - ultimoDesligamento);
    unsigned long inicioEspera = millis();
    while ((millis() - inicioEspera) < espera) {
      delay(20);
    }
  }

  unsigned long tempoMinimoAudios = 1150;
  tempoTotalSeg = (unsigned long)tempoMinutos * 60UL;
  if (tempoTotalSeg < tempoMinimoAudios) {
    tempoTotalSeg = tempoMinimoAudios;
  }

  acionarRele(true);
  statusAtual = "em_uso";
  tempoInicioCiclo = millis();
  tempoRestanteSeg = tempoTotalSeg;
  sessionEndsAtMs = millis() + (tempoTotalSeg * 1000UL);
  proximoAudioNum = 0;
  audiosPendentes = true;

  Serial.printf("Poltrona ON — %lu s (%d min) até millis=%lu\n", tempoTotalSeg, tempoMinutos, sessionEndsAtMs);
  persistActiveSession();
  return true;
}

bool sendHeartbeat();

void gerenciarAudios() {
  if (statusAtual != "em_uso" || !dfplayerDisponivel) {
    return;
  }

  if (proximoAudioNum == 0) {
    dfPlayer.volume(volume_audio_001);
    delay(150);
    dfPlayer.play(1);
    tempo_inicio_audios = millis();
    proximoAudioNum = 1;
    return;
  }

  unsigned long elapsed = millis() - tempo_inicio_audios;

  if (elapsed >= 4000 && proximoAudioNum == 1) {
    dfPlayer.volume(volume_audio_002);
    delay(100);
    dfPlayer.play(2);
    proximoAudioNum = 2;
  } else if (elapsed >= 10000 && proximoAudioNum == 2) {
    dfPlayer.volume(volume_audio_003);
    delay(100);
    dfPlayer.play(3);
    proximoAudioNum = 3;
  } else if (elapsed >= 20000 && proximoAudioNum == 3) {
    dfPlayer.volume(volume_audio_004);
    delay(100);
    dfPlayer.play(4);
    proximoAudioNum = 4;
  } else if (elapsed >= 30000 && proximoAudioNum == 4) {
    dfPlayer.volume(volume_audio_005);
    delay(100);
    dfPlayer.play(5);
    proximoAudioNum = 5;
  } else if (elapsed >= 50000 && proximoAudioNum == 5) {
    dfPlayer.volume(volume_audio_006);
    delay(100);
    dfPlayer.play(6);
    proximoAudioNum = 6;
  } else if (elapsed >= AUDIO_007_LOOP_MS && proximoAudioNum == 6) {
    dfPlayer.volume(volume_audio_007);
    delay(100);
    dfPlayer.play(7);
    proximoAudioNum = 7;
    ultimo_play_audio_007 = millis();
  } else if (proximoAudioNum == 7) {
    unsigned long loopElapsed = elapsed - AUDIO_007_LOOP_MS;
    if (loopElapsed >= 18UL * 60UL * 1000UL) {
      dfPlayer.pause();
      proximoAudioNum = 8;
    } else if (ultimo_play_audio_007 > 0 &&
               (millis() - ultimo_play_audio_007) >= AUDIO_007_DURACAO_MS) {
      dfPlayer.volume(volume_audio_007);
      delay(100);
      dfPlayer.play(7);
      ultimo_play_audio_007 = millis();
    }
  }
}

void atualizarTimerSessao() {
  if (statusAtual != "em_uso" || sessionEndsAtMs == 0) {
    return;
  }
  unsigned long now = millis();
  if (now >= sessionEndsAtMs) {
    Serial.println("Tempo esgotado — desligando");
    pararPoltrona();
    sendHeartbeat();
    return;
  }
  tempoRestanteSeg = (sessionEndsAtMs - now) / 1000UL;
  static unsigned long lastPersistMs = 0;
  if (lastPersistMs == 0 || (now - lastPersistMs) >= 8000UL) {
    // Persiste o restante real (deadline), não uma conta paralela.
    tempoTotalSeg = tempoRestanteSeg;
    tempoInicioCiclo = now;
    persistActiveSession();
    lastPersistMs = now;
  }
}

bool sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  HTTPClient http;
  String url = String(supabaseUrl) + "/functions/v1/esp32-monitor?action=heartbeat";
  http.begin(url);
  http.setTimeout(HTTP_TIMEOUT_MS);
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

  JsonObject relay = doc.createNestedObject("relay_status");
  relay[String("relay_1")] = (statusAtual == "em_uso") ? "on" : "off";

  String body;
  serializeJson(doc, body);
  int code = http.POST(body);
  http.end();
  return code == 200;
}

bool confirmCommand(const char* commandId) {
  if (!commandId || strlen(commandId) == 0) {
    return false;
  }

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
  Serial.printf("confirm_command %s → HTTP %d\n", commandId, code);
  return code == 200;
}

int parseCycleMinutes(JsonObject cmd) {
  int minutes = 0;
  if (cmd["cycle_time_minutes"].is<int>()) {
    minutes = cmd["cycle_time_minutes"].as<int>();
  } else if (cmd["cycle_time_minutes"].is<float>()) {
    minutes = (int)cmd["cycle_time_minutes"].as<float>();
  } else if (cmd["cycle_time_minutes"].is<const char*>()) {
    minutes = atoi(cmd["cycle_time_minutes"].as<const char*>());
  }

  if (minutes <= 0 && cmd.containsKey("payload")) {
    JsonObject payload = cmd["payload"];
    if (!payload.isNull()) {
      if (payload["cycle_time_minutes"].is<int>()) {
        minutes = payload["cycle_time_minutes"].as<int>();
      } else if (payload["cycle_time_minutes"].is<float>()) {
        minutes = (int)payload["cycle_time_minutes"].as<float>();
      } else if (payload["cycle_time_minutes"].is<const char*>()) {
        minutes = atoi(payload["cycle_time_minutes"].as<const char*>());
      }
    }
  }

  if (minutes <= 0) {
    minutes = DEFAULT_CYCLE_MINUTES;
  }
  if (minutes > 24 * 60) {
    minutes = 24 * 60;
  }
  return minutes;
}

void aplicarVolumeSeValido(JsonObject src, const char* key, int* target) {
  if (!src.containsKey(key) || target == nullptr) {
    return;
  }
  int value = src[key] | *target;
  if (value < 0) value = 0;
  if (value > 30) value = 30;
  *target = value;
}

void applyRuntimeAudioConfig(JsonObject cmd) {
  if (!cmd.containsKey("payload")) {
    return;
  }

  JsonObject payload = cmd["payload"];
  if (payload.isNull()) {
    return;
  }

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
  if (strlen(cmdId) == 0) {
    return;
  }

  if (lastExecutedCommandId == cmdId) {
    Serial.println("Comando duplicado — só confirma: " + String(cmdId));
    confirmCommand(cmdId);
    return;
  }

  if (strcmp(action, "on") == 0 || strcmp(action, "activate") == 0 || strcmp(action, "turn_on") == 0) {
    applyRuntimeAudioConfig(cmd);
    int minutes = parseCycleMinutes(cmd);
    if (!iniciarPoltrona(minutes)) {
      Serial.println("ON não executado");
      return;
    }
    markCommandExecuted(cmdId);
    confirmCommand(cmdId);
    sendHeartbeat();
    lastHeartbeat = millis();
  } else if (strcmp(action, "off") == 0 || strcmp(action, "deactivate") == 0 || strcmp(action, "turn_off") == 0) {
    // Durante a sessão: só OFF forçado (Parar do admin). OFF antigo reentregue
    // pela fila (reclaim) NÃO pode matar o ciclo — era o "desligou sozinho".
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
      Serial.println("Ignorando OFF sem force durante sessão");
      confirmCommand(cmdId);
      reassertRelayIfSession();
      return;
    }
    markCommandExecuted(cmdId);
    pararPoltrona();
    confirmCommand(cmdId);
    sendHeartbeat();
    lastHeartbeat = millis();
  }
}

void pollCommands() {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  HTTPClient http;
  String url = String(supabaseUrl) + "/functions/v1/esp32-monitor?action=poll_commands&esp32_id=" + ESP32_ID;
  http.begin(url);
  http.setTimeout(HTTP_TIMEOUT_MS);
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
  if (deserializeJson(doc, payload)) {
    return;
  }

  JsonArray commands = doc["commands"].as<JsonArray>();
  if (commands.isNull()) {
    return;
  }

  for (JsonObject cmd : commands) {
    processCommand(cmd);
  }
}

bool initDfPlayer() {
  dfSerial.begin(9600, SERIAL_8N1, 17, 16);
  delay(1500);

  if (dfPlayer.begin(dfSerial, true, true)) {
    ackEnabled = true;
  } else if (dfPlayer.begin(dfSerial, false, true)) {
    ackEnabled = false;
  } else {
    return false;
  }

  delay(300);
  dfPlayer.volume(28);
  dfPlayer.EQ(DFPLAYER_EQ_NORMAL);
  dfPlayer.outputDevice(DFPLAYER_DEVICE_SD);
  delay(500);
  return true;
}

void setupDeviceHttpRoutes() {
  esp32HttpServer().on("/", HTTP_GET, []() {
    String html = "<h1>Poltrona Top Lavanderia</h1><p>Status: " + statusAtual +
                  "</p><p>ESP32: " + String(ESP32_ID) + "</p><p><a href='/status'>JSON</a></p>";
    esp32HttpServer().send(200, "text/html", html);
  });

  esp32HttpServer().on("/status", HTTP_GET, []() {
    StaticJsonDocument<512> doc;
    doc["status"] = statusAtual;
    doc["tempo_restante_segundos"] = tempoRestanteSeg;
    doc["esp32_id"] = ESP32_ID;
    doc["poltrona"] = MACHINE_NAME;
    doc["firmware_version"] = FIRMWARE_VERSION;
    doc["device_profile"] = "timed_session";
    doc["ip"] = WiFi.localIP().toString();
    doc["rssi"] = WiFi.RSSI();
    doc["online"] = true;
    doc["dfplayer"] = dfplayerDisponivel;
    doc["last_reset_reason"] = lastResetReason;
    doc["uptime_seconds"] = millis() / 1000UL;
    String out;
    serializeJson(doc, out);
    esp32HttpServer().sendHeader("Access-Control-Allow-Origin", "*");
    esp32HttpServer().send(200, "application/json", out);
  });

  esp32HttpServer().on("/stop", HTTP_POST, []() {
    pararPoltrona();
    sendHeartbeat();
    esp32HttpServer().send(200, "application/json", "{\"success\":true}");
  });

  esp32HttpServer().on("/test", HTTP_GET, []() {
    acionarRele(true);
    statusAtual = "em_uso";
    tempoTotalSeg = 10;
    tempoInicioCiclo = millis();
    tempoRestanteSeg = 10;
    audiosPendentes = false;
    persistActiveSession();
    esp32HttpServer().send(200, "application/json", "{\"success\":true,\"test_seconds\":10}");
  });

  esp32HttpServer().onNotFound([]() {
    esp32HttpServer().send(404, "application/json", "{\"error\":\"not found\"}");
  });
}

static bool poltronaOtaBusyHook() {
  return statusAtual == "em_uso";
}

void setup() {
  Serial.begin(115200);
  delay(200);

  pinMode(RELAY_PIN, OUTPUT);
  bool resumeSession = peekPersistedSessionActive();
  relayAppliedLevel = -1;
  acionarRele(resumeSession);

  loadLastExecutedCommandId();
  buildEsp32Id();
  lastResetReason = describeResetReason();

  Serial.println();
  Serial.println("=================================");
  Serial.println(" Poltrona Massagem — Top Lavanderia");
  Serial.printf(" Firmware %s\n", FIRMWARE_VERSION);
  Serial.printf(" ESP32_ID: %s\n", ESP32_ID);
  Serial.printf(" Motivo do reset: %s\n", lastResetReason);
  Serial.println("=================================");

  esp_task_wdt_deinit();

  if (resumeSession) {
    restorePersistedSession();
  } else {
    clearPersistedSession();
    acionarRele(false);
  }

  esp32SetOtaBusyHook(poltronaOtaBusyHook);
  esp32WifiOtaRegisterPortalRoutes();
  setupDeviceHttpRoutes();
  esp32WifiOtaBegin();
  WiFi.setSleep(false);

  dfplayerDisponivel = initDfPlayer();
  Serial.printf("DFPlayer: %s\n", dfplayerDisponivel ? "OK" : "indisponível");

  sendHeartbeat();
  lastHeartbeat = millis();
  lastPoll = millis();
}

void loop() {
  if (!esp32WifiOtaMaintain()) {
    gerenciarAudios();
    atualizarTimerSessao();
    reassertRelayIfSession();
    delay(20);
    return;
  }

  gerenciarAudios();
  atualizarTimerSessao();
  reassertRelayIfSession();

  unsigned long now = millis();
  if (now - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
    sendHeartbeat();
    lastHeartbeat = now;
    reassertRelayIfSession();
  }
  if (now - lastPoll >= POLL_INTERVAL_MS) {
    pollCommands();
    lastPoll = now;
    reassertRelayIfSession();
  }

  delay(40);
}
