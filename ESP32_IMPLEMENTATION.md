# Implementação ESP32 - Sistema de Lavanderia

## Endpoints Necessários no ESP32

O ESP32 deve implementar os seguintes endpoints HTTP para integração completa com o sistema:

### 1. Endpoint de Status (`/status`)
**Método:** GET  
**Função:** Retorna o status atual do ESP32

```cpp
// Exemplo de resposta JSON
{
  "esp32_id": "main",
  "ip_address": "192.168.1.100",
  "signal_strength": -45,
  "network_status": "connected",
  "firmware_version": "v1.2.3",
  "uptime_seconds": 3600,
  "free_heap": 50000,
  "wifi_ssid": "LavanderiaWiFi"
}
```

### 2. Endpoint de Liberação de Crédito (`/release-credit`)
**Método:** POST  
**Função:** Recebe comando para liberar crédito e acionar máquina

```cpp
// Exemplo de payload de entrada
{
  "transaction_id": "txn_123456789",
  "amount": 10.50,
  "timestamp": "2025-07-23T22:51:02Z"
}

// Exemplo de resposta JSON
{
  "success": true,
  "message": "Crédito liberado com sucesso",
  "transaction_id": "txn_123456789",
  "amount": 10.50,
  "activated_machine": "lavadora_01",
  "activation_time": "2025-07-23T22:51:02Z"
}
```

### 3. Endpoint de Heartbeat (`/heartbeat`)
**Método:** POST  
**Função:** Recebe ping do sistema para verificar conectividade

```cpp
// Exemplo de resposta JSON
{
  "status": "ok",
  "timestamp": "2025-07-23T22:51:02Z",
  "next_heartbeat": 30
}
```

## Configurações de Rede

### Parâmetros WiFi
- **SSID:** Configurável via interface web
- **Password:** Configurável via interface web
- **IP:** Preferencialmente fixo (192.168.1.100)
- **Porta:** 80 (HTTP padrão)

### Monitoramento de Sinal
O ESP32 deve reportar a força do sinal WiFi:
```cpp
int32_t signalStrength = WiFi.RSSI();
// Valores típicos:
// > -50 dBm: Excelente
// -50 a -70 dBm: Bom
// < -70 dBm: Fraco
```

## Heartbeat Automático

O ESP32 deve enviar heartbeat automático para o sistema:

```cpp
// URL do sistema
POST https://rkdybjzwiwwqqzjfmerm.supabase.co/functions/v1/esp32-monitor?action=heartbeat

// Payload
{
  "esp32_id": "main",
  "ip_address": "192.168.1.100",
  "signal_strength": -45,
  "network_status": "connected",
  "firmware_version": "v1.2.3",
  "uptime_seconds": 3600
}
```

**Frequência:** A cada 30 segundos (configurável no admin)

## Controle de Máquinas

### GPIO para Relés
```cpp
// Exemplo de configuração de pinos
#define RELAY_LAVADORA_01  2
#define RELAY_LAVADORA_02  4
#define RELAY_SECADORA_01  5
#define RELAY_SECADORA_02  18

// Função para ativar máquina
void activateMachine(String machineId, float amount) {
  if (machineId == "lavadora_01") {
    digitalWrite(RELAY_LAVADORA_01, HIGH);
    // Timer para desligar após ciclo
  }
  // ... outros equipamentos
}
```

### Segurança
- Timeout automático para segurança
- Verificação de status antes de ativar
- Log de todas as ativações

## Exemplo de Código Arduino/ESP32

```cpp
#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>

WebServer server(80);
unsigned long lastHeartbeat = 0;
const unsigned long heartbeatInterval = 30000; // 30 segundos

void setup() {
  Serial.begin(115200);
  
  // Configurar WiFi
  WiFi.begin("SeuSSID", "SuaSenha");
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Conectando ao WiFi...");
  }
  
  // Configurar endpoints
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/release-credit", HTTP_POST, handleCreditRelease);
  server.on("/heartbeat", HTTP_POST, handleHeartbeat);
  
  server.begin();
  Serial.println("ESP32 iniciado!");
}

void loop() {
  server.handleClient();
  
  // Heartbeat automático
  if (millis() - lastHeartbeat > heartbeatInterval) {
    sendHeartbeat();
    lastHeartbeat = millis();
  }
  
  delay(100);
}

void handleStatus() {
  DynamicJsonDocument doc(1024);
  doc["esp32_id"] = "main";
  doc["ip_address"] = WiFi.localIP().toString();
  doc["signal_strength"] = WiFi.RSSI();
  doc["network_status"] = "connected";
  doc["firmware_version"] = "v1.2.3";
  doc["uptime_seconds"] = millis() / 1000;
  doc["free_heap"] = ESP.getFreeHeap();
  doc["wifi_ssid"] = WiFi.SSID();
  
  String response;
  serializeJson(doc, response);
  
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", response);
}

void handleCreditRelease() {
  DynamicJsonDocument doc(1024);
  deserializeJson(doc, server.arg("plain"));
  
  String transactionId = doc["transaction_id"];
  float amount = doc["amount"];
  
  // Lógica para ativar máquina
  bool success = activateMachine("lavadora_01", amount);
  
  DynamicJsonDocument response(1024);
  response["success"] = success;
  response["message"] = success ? "Crédito liberado com sucesso" : "Falha na liberação";
  response["transaction_id"] = transactionId;
  response["amount"] = amount;
  response["activated_machine"] = "lavadora_01";
  response["activation_time"] = "2025-07-23T22:51:02Z";
  
  String responseStr;
  serializeJson(response, responseStr);
  
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", responseStr);
}

void sendHeartbeat() {
  HTTPClient http;
  http.begin("https://rkdybjzwiwwqqzjfmerm.supabase.co/functions/v1/esp32-monitor?action=heartbeat");
  http.addHeader("Content-Type", "application/json");
  
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
  http.end();
}

bool activateMachine(String machineId, float amount) {
  // Implementar lógica de ativação da máquina
  // Retornar true se sucesso, false se erro
  return true;
}
```

## Configurações do Sistema

No painel admin, configure:
- **ESP32 Host:** 192.168.1.100
- **ESP32 Port:** 80
- **Heartbeat Interval:** 30 segundos
- **Max Offline Duration:** 5 minutos
- **Signal Threshold:** -70 dBm

## Testes

1. **Simular ESP32:** Use o botão "Simular ESP32" no admin para criar dados de teste
2. **Testar Liberação:** Use o formulário de teste para verificar comunicação
3. **Monitorar Status:** Observe os indicadores de rede e heartbeat em tempo real

## Solução de Problemas

- **ESP32 Offline:** Verificar conexão WiFi e configurações de rede
- **Heartbeat Falhou:** Verificar URL do sistema e conectividade com internet
- **Liberação Falhou:** Verificar endpoints e formato JSON das requisições