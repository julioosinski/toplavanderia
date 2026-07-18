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
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DFRobotDFPlayerMini.h>
#include <esp_task_wdt.h>
#include <cstdio>

#define FIRMWARE_VERSION "v1.1.4-toplav-poltrona"

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
const int PAUSA_ANTES_RESFRIAMENTO_SEG = 2;
const int TEMPO_RESFRIAMENTO_SEG = 30;

// ===== Timers rede =====
const unsigned long HEARTBEAT_INTERVAL_MS = 30000;
const unsigned long POLL_INTERVAL_MS = 10000;
// Timeout curto: vários HTTP seguidos + WDT 60s causavam reboot e desligavam a poltrona no meio da sessão.
const unsigned long HTTP_TIMEOUT_MS = 8000;
const unsigned long WDT_TIMEOUT_MS = 180000;

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
bool executandoResfriamento = false;
unsigned long ultimoDesligamento = 0;
const unsigned long COOLDOWN_MS = 5000;

char ESP32_ID[16];

unsigned long lastHeartbeat = 0;
unsigned long lastPoll = 0;
// Se o confirm HTTP falhar, o servidor pode reenviar o mesmo ID. Não reinicia
// a sessão nem repete o acionamento; apenas tenta confirmar novamente.
String lastExecutedCommandId = "";

void buildEsp32Id() {
  WiFi.mode(WIFI_STA);
  delay(100);
  uint8_t mac[6];
  WiFi.macAddress(mac);
  snprintf(ESP32_ID, sizeof(ESP32_ID), "esp32_%02x%02x%02x%02x", mac[2], mac[3], mac[4], mac[5]);
}

void acionarRele(bool ligar) {
  digitalWrite(RELAY_PIN, ligar
    ? (RELAY_LOGICA_INVERTIDA ? LOW : HIGH)
    : (RELAY_LOGICA_INVERTIDA ? HIGH : LOW));
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

void executarCicloResfriamento() {
  Serial.println("Resfriamento: pausa + relé 30s");
  executandoResfriamento = true;
  acionarRele(false);
  delay(PAUSA_ANTES_RESFRIAMENTO_SEG * 1000UL);

  acionarRele(true);
  for (int i = 0; i < TEMPO_RESFRIAMENTO_SEG; i++) {
    delay(1000);
  }
  acionarRele(false);
  executandoResfriamento = false;
  ultimoDesligamento = millis();
}

void pararPoltrona(bool comResfriamento) {
  pararAudio();
  acionarRele(false);
  if (comResfriamento && statusAtual == "em_uso") {
    executarCicloResfriamento();
  }
  statusAtual = "disponivel";
  tempoTotalSeg = 0;
  tempoRestanteSeg = 0;
  tempoInicioCiclo = 0;
}

bool iniciarPoltrona(int tempoMinutos) {
  if (executandoResfriamento) {
    Serial.println("Ignorando start — resfriamento em andamento");
    return false;
  }

  if (tempoMinutos <= 0) {
    tempoMinutos = DEFAULT_CYCLE_MINUTES;
  }

  // Uma segunda compra válida durante a sessão soma tempo, sem reiniciar áudio/relé.
  if (statusAtual == "em_uso") {
    unsigned long adicional = (unsigned long)tempoMinutos * 60UL;
    tempoTotalSeg += adicional;
    tempoRestanteSeg += adicional;
    Serial.printf("Poltrona em uso — adicionados %lu s à sessão\n", adicional);
    return true;
  }

  // Não descarta nem confirma falsamente um pagamento feito logo após o resfriamento.
  if (ultimoDesligamento > 0 && (millis() - ultimoDesligamento) < COOLDOWN_MS) {
    unsigned long espera = COOLDOWN_MS - (millis() - ultimoDesligamento);
    Serial.printf("Aguardando cooldown por %lu ms antes de iniciar\n", espera);
    unsigned long inicioEspera = millis();
    while ((millis() - inicioEspera) < espera) {
      wdtKick();
      delay(50);
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
  proximoAudioNum = 0;
  audiosPendentes = true;

  Serial.printf("Poltrona ON — %lu s (%d min solicitados)\n", tempoTotalSeg, tempoMinutos);
  return true;
}

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
  if (statusAtual != "em_uso" || tempoTotalSeg == 0) {
    return;
  }
  unsigned long decorrido = (millis() - tempoInicioCiclo) / 1000UL;
  if (decorrido >= tempoTotalSeg) {
    Serial.println("Tempo da sessão esgotado — encerrando com resfriamento");
    pararPoltrona(true);
    return;
  }
  tempoRestanteSeg = tempoTotalSeg - decorrido;
}

void wdtKick() {
  // no-op: WDT desativado na poltrona
}

bool sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  wdtKick();
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
  doc["network_status"] = "connected";
  doc["auto_register"] = true;
  doc["uptime_seconds"] = millis() / 1000UL;
  doc["session_status"] = statusAtual;
  doc["session_remaining_sec"] = tempoRestanteSeg;

  JsonObject relay = doc.createNestedObject("relay_status");
  bool relayOn = (statusAtual == "em_uso" || executandoResfriamento);
  relay[String("relay_1")] = relayOn ? "on" : "off";

  String body;
  serializeJson(doc, body);
  int code = http.POST(body);
  http.end();
  wdtKick();
  return code == 200;
}

bool confirmCommand(const char* commandId) {
  if (!commandId || strlen(commandId) == 0) {
    return false;
  }

  wdtKick();
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
  wdtKick();
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
  // Aceita duas formas:
  // 1) payload.volume_audio_001 ... payload.volume_audio_007
  // 2) payload.audio_volumes.{volume_audio_001 ... volume_audio_007}
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

  Serial.printf(
      "Volumes runtime aplicados: [%d,%d,%d,%d,%d,%d,%d]\n",
      volume_audio_001, volume_audio_002, volume_audio_003, volume_audio_004,
      volume_audio_005, volume_audio_006, volume_audio_007);
}

void processCommand(JsonObject cmd, bool* startedThisPoll) {
  const char* action = cmd["action"] | "";
  const char* cmdId = cmd["id"] | "";
  if (strlen(cmdId) == 0) {
    return;
  }

  if (lastExecutedCommandId == cmdId) {
    Serial.println("Comando duplicado — sem reexecutar: " + String(cmdId));
    confirmCommand(cmdId);
    return;
  }

  wdtKick();
  if (strcmp(action, "on") == 0 || strcmp(action, "activate") == 0 || strcmp(action, "turn_on") == 0) {
    applyRuntimeAudioConfig(cmd);
    int minutes = parseCycleMinutes(cmd);
    if (!iniciarPoltrona(minutes)) {
      Serial.println("ON não executado — aguardando nova tentativa");
      return;
    }
    lastExecutedCommandId = cmdId;
    if (startedThisPoll != nullptr) {
      *startedThisPoll = true;
    }
    wdtKick();
    // Confirma sem segundo heartbeat síncrono (evita cascata HTTP → WDT reboot).
    confirmCommand(cmdId);
  } else if (strcmp(action, "off") == 0 || strcmp(action, "deactivate") == 0 || strcmp(action, "turn_off") == 0) {
    // Mesma poll: ON seguido de OFF velho na fila — confirma OFF sem matar a sessão nova.
    if (startedThisPoll != nullptr && *startedThisPoll) {
      Serial.println("Ignorando OFF na mesma poll após ON (fila stale)");
      confirmCommand(cmdId);
      return;
    }
    // Durante sessão: só aceita OFF forçado (admin_stop/force). Evita OFF do Android/auto-status.
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
      lastExecutedCommandId = cmdId;
      Serial.println("Ignorando OFF remoto sem force durante sessão timed_session");
      confirmCommand(cmdId);
      return;
    }
    lastExecutedCommandId = cmdId;
    if (statusAtual == "em_uso") {
      pararPoltrona(true);
    } else {
      pararPoltrona(false);
    }
    wdtKick();
    confirmCommand(cmdId);
  }
}

void pollCommands() {
  if (WiFi.status() != WL_CONNECTED || executandoResfriamento) {
    return;
  }

  wdtKick();
  HTTPClient http;
  String url = String(supabaseUrl) + "/functions/v1/esp32-monitor?action=poll_commands&esp32_id=" + ESP32_ID;
  http.begin(url);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("apikey", supabaseApiKey);
  http.addHeader("Authorization", String("Bearer ") + supabaseApiKey);

  int code = http.GET();
  if (code != 200) {
    http.end();
    wdtKick();
    return;
  }

  String payload = http.getString();
  http.end();
  wdtKick();

  StaticJsonDocument<4096> doc;
  if (deserializeJson(doc, payload)) {
    return;
  }

  JsonArray commands = doc["commands"].as<JsonArray>();
  if (commands.isNull()) {
    return;
  }

  bool startedThisPoll = false;
  for (JsonObject cmd : commands) {
    processCommand(cmd, &startedThisPoll);
    wdtKick();
  }
}

bool initDfPlayer() {
  dfSerial.begin(9600, SERIAL_8N1, 17, 16);
  delay(2000);

  if (dfPlayer.begin(dfSerial, true, true)) {
    ackEnabled = true;
  } else if (dfPlayer.begin(dfSerial, false, true)) {
    ackEnabled = false;
  } else {
    return false;
  }

  delay(500);
  dfPlayer.volume(28);
  dfPlayer.EQ(DFPLAYER_EQ_NORMAL);
  dfPlayer.outputDevice(DFPLAYER_DEVICE_SD);
  delay(2000);
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
    String out;
    serializeJson(doc, out);
    esp32HttpServer().sendHeader("Access-Control-Allow-Origin", "*");
    esp32HttpServer().send(200, "application/json", out);
  });

  esp32HttpServer().on("/stop", HTTP_POST, []() {
    pararPoltrona(statusAtual == "em_uso");
    esp32HttpServer().send(200, "application/json", "{\"success\":true}");
  });

  esp32HttpServer().on("/test", HTTP_GET, []() {
    acionarRele(true);
    statusAtual = "em_uso";
    tempoTotalSeg = 10;
    tempoInicioCiclo = millis();
    tempoRestanteSeg = 10;
    audiosPendentes = false;
    esp32HttpServer().send(200, "application/json", "{\"success\":true,\"test_seconds\":10}");
  });

  esp32HttpServer().onNotFound([]() {
    esp32HttpServer().send(404, "application/json", "{\"error\":\"not found\"}");
  });
}

void setupWatchdog() {
  // WDT desligado: HTTP + OTA + DFPlayer causavam reboot e desligavam o relé no meio da sessão.
  esp_task_wdt_deinit();
}

static bool poltronaOtaBusyHook() {
  return statusAtual == "em_uso" || executandoResfriamento;
}

void setup() {
  Serial.begin(115200);
  delay(500);
  buildEsp32Id();

  Serial.println();
  Serial.println("=================================");
  Serial.println(" Poltrona Massagem — Top Lavanderia");
  Serial.printf(" Firmware %s\n", FIRMWARE_VERSION);
  Serial.printf(" ESP32_ID: %s\n", ESP32_ID);
  Serial.println("=================================");

  pinMode(RELAY_PIN, INPUT_PULLUP);
  delay(50);
  pinMode(RELAY_PIN, OUTPUT);
  acionarRele(false);

  setupWatchdog();
  esp32SetOtaBusyHook(poltronaOtaBusyHook);
  esp32WifiOtaRegisterPortalRoutes();
  setupDeviceHttpRoutes();
  esp32WifiOtaBegin();

  dfplayerDisponivel = initDfPlayer();
  Serial.printf("DFPlayer: %s\n", dfplayerDisponivel ? "OK" : "indisponível (sem áudio)");

  sendHeartbeat();
  lastHeartbeat = millis();
  lastPoll = millis();
}

void loop() {
  if (!esp32WifiOtaMaintain()) {
    // Wi-Fi caiu: mantém o timer da sessão mesmo offline.
    gerenciarAudios();
    atualizarTimerSessao();
    delay(10);
    return;
  }

  gerenciarAudios();
  atualizarTimerSessao();

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
