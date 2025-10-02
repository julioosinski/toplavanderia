# TopLavanderia APK Integration Guide

Este documento descreve os endpoints e integrações necessárias para o aplicativo Android (APK) do sistema TopLavanderia.

## Autenticação

### Fluxo de Autenticação do Totem/APK

O APK deve usar autenticação baseada em `device_uuid` registrado na tabela `authorized_devices`.

#### 1. Login do Dispositivo

```typescript
POST /auth/v1/token?grant_type=password
Content-Type: application/json

{
  "email": "device-{device_uuid}@totem.internal",
  "password": "device_secure_password"
}
```

**Response:**
```json
{
  "access_token": "eyJhbG...",
  "refresh_token": "v1.MR5m...",
  "expires_in": 3600,
  "user": {
    "id": "uuid",
    "role": "totem_device"
  }
}
```

#### 2. Validar Dispositivo Autorizado

```typescript
GET /rest/v1/authorized_devices?device_uuid=eq.{uuid}&is_active=eq.true
Authorization: Bearer {access_token}
```

## Endpoints Principais

### Máquinas

#### Listar Máquinas da Lavanderia

```typescript
GET /rest/v1/machines?laundry_id=eq.{laundry_id}&select=*
Authorization: Bearer {access_token}
```

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Máquina 01",
    "type": "washer",
    "status": "available",
    "price_per_kg": 5.00,
    "capacity_kg": 10,
    "cycle_time_minutes": 40,
    "esp32_id": "esp32_01",
    "relay_pin": 1
  }
]
```

#### Obter Status da Máquina

```typescript
GET /rest/v1/machines?id=eq.{machine_id}&select=*
Authorization: Bearer {access_token}
```

### Transações

#### Criar Nova Transação

```typescript
POST /rest/v1/transactions
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "machine_id": "uuid",
  "user_id": "uuid",
  "laundry_id": "uuid",
  "weight_kg": 5.5,
  "total_amount": 27.50,
  "payment_method": "pix",
  "status": "pending"
}
```

**Response:**
```json
{
  "id": "uuid",
  "machine_id": "uuid",
  "status": "pending",
  "created_at": "2025-10-02T..."
}
```

#### Atualizar Status da Transação

**Opção 1: Via REST API**
```typescript
PATCH /rest/v1/transactions?id=eq.{transaction_id}
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "status": "completed",
  "completed_at": "2025-10-02T..."
}
```

**Opção 2: Via Webhook (Recomendado)**
```typescript
POST /functions/v1/transaction-webhook
Content-Type: application/json

{
  "transaction_id": "uuid",
  "machine_id": "uuid",
  "user_id": "uuid",
  "status": "completed",
  "payment_method": "pix",
  "total_amount": 27.50,
  "device_uuid": "device_uuid"
}
```

### ESP32 - Liberar Créditos

#### Enviar Comando de Liberação

```typescript
POST /functions/v1/esp32-credit-release
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "machine_id": "uuid",
  "user_id": "uuid",
  "credits": 1.0,
  "esp32Id": "esp32_01",
  "relay_pin": 1,
  "duration_seconds": 2400
}
```

**Response:**
```json
{
  "success": true,
  "esp32_response": {
    "status": "success",
    "relay_activated": true,
    "duration": 2400
  },
  "transaction_id": "uuid"
}
```

### ESP32 - Heartbeat

#### Enviar Heartbeat do ESP32

```typescript
POST /rest/v1/esp32_status
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "esp32_id": "esp32_01",
  "laundry_id": "uuid",
  "is_online": true,
  "signal_strength": -65,
  "uptime_seconds": 3600,
  "ip_address": "192.168.1.100",
  "firmware_version": "1.0.0",
  "network_status": "connected",
  "relay_status": {
    "1": "off",
    "2": "on"
  }
}
```

### Configurações do Sistema

#### Obter Configurações da Lavanderia

```typescript
GET /rest/v1/system_settings?laundry_id=eq.{laundry_id}&select=*
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "id": "uuid",
  "laundry_id": "uuid",
  "esp32_host": "192.168.1.100",
  "esp32_port": 80,
  "default_cycle_time": 40,
  "default_price": 5.00,
  "paygo_enabled": true,
  "paygo_host": "api.paygo.com.br",
  "wifi_ssid": "LaundryWiFi"
}
```

### Créditos do Usuário

#### Registrar Compra de Créditos

```typescript
POST /rest/v1/user_credits
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "user_id": "uuid",
  "laundry_id": "uuid",
  "amount": 50.00,
  "transaction_type": "purchase",
  "description": "Compra via PIX",
  "transaction_id": "uuid"
}
```

#### Consultar Saldo de Créditos

```typescript
GET /rest/v1/user_credits?user_id=eq.{user_id}&laundry_id=eq.{laundry_id}&order=created_at.desc
Authorization: Bearer {access_token}
```

## Row-Level Security (RLS)

O APK deve ter as seguintes permissões configuradas:

### Tabela: `machines`
- ✅ SELECT: Ler máquinas da lavanderia associada

### Tabela: `transactions`
- ✅ INSERT: Criar transações
- ✅ UPDATE: Atualizar status de transações
- ✅ SELECT: Visualizar transações

### Tabela: `esp32_status`
- ✅ INSERT: Criar/atualizar status do ESP32
- ✅ UPDATE: Atualizar heartbeat
- ✅ SELECT: Consultar status

### Tabela: `user_credits`
- ✅ INSERT: Registrar compra de créditos
- ✅ SELECT: Consultar saldo do usuário

## Variáveis de Ambiente

O APK deve armazenar as seguintes configurações:

```properties
SUPABASE_URL=https://rkdybjzwiwwqqzjfmerm.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DEVICE_UUID=generated-uuid-v4
LAUNDRY_ID=uuid-from-server
```

## Fluxo de Uso Típico

1. **Inicialização do APK**
   - Verificar conectividade
   - Autenticar dispositivo
   - Carregar configurações da lavanderia
   - Carregar lista de máquinas

2. **Usuário Seleciona Máquina**
   - Verificar disponibilidade (`status = 'available'`)
   - Calcular valor baseado em peso/tempo
   - Mostrar métodos de pagamento

3. **Processar Pagamento**
   - Integrar com PayGO/TEF
   - Criar transação com `status = 'pending'`
   - Aguardar confirmação do pagamento

4. **Liberar Máquina**
   - Chamar `/esp32-credit-release`
   - Enviar comando para ESP32
   - Atualizar transação para `status = 'completed'`

5. **Monitoramento**
   - ESP32 envia heartbeat a cada 30 segundos
   - APK monitora status da máquina
   - Notificar usuário quando ciclo terminar

## Tratamento de Erros

### Erros Comuns

| Código | Erro | Solução |
|--------|------|---------|
| 401 | Unauthorized | Renovar token de autenticação |
| 403 | Forbidden | Verificar permissões RLS |
| 404 | Not Found | Validar IDs (machine_id, user_id, etc) |
| 500 | Internal Server Error | Verificar logs do servidor |
| 504 | Gateway Timeout | ESP32 offline - retry ou failover |

### Retry Logic

Implementar exponential backoff para operações críticas:

```kotlin
// Exemplo em Kotlin
suspend fun <T> retryWithBackoff(
    maxRetries: Int = 3,
    initialDelay: Long = 1000,
    maxDelay: Long = 10000,
    factor: Double = 2.0,
    block: suspend () -> T
): T {
    var currentDelay = initialDelay
    repeat(maxRetries - 1) { attempt ->
        try {
            return block()
        } catch (e: Exception) {
            delay(currentDelay)
            currentDelay = (currentDelay * factor).toLong().coerceAtMost(maxDelay)
        }
    }
    return block() // última tentativa sem catch
}
```

## Segurança

### Checklist de Segurança para APK

- ✅ Nunca armazenar `SUPABASE_SERVICE_ROLE_KEY` no APK
- ✅ Usar HTTPS para todas as requisições
- ✅ Validar certificados SSL
- ✅ Armazenar tokens em `EncryptedSharedPreferences`
- ✅ Implementar timeout nas requisições (5-10 segundos)
- ✅ Validar entrada do usuário (valores, formatos)
- ✅ Implementar rate limiting local
- ✅ Ofuscar código com ProGuard/R8

## Suporte e Documentação

- **Supabase Docs**: https://supabase.com/docs
- **Edge Functions**: https://supabase.com/docs/guides/functions
- **RLS Policies**: https://supabase.com/docs/guides/auth/row-level-security
