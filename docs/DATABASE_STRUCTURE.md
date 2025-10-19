# 📊 Estrutura de Dados - Top Lavanderia

## 🗄️ Tabela: `machines`

| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `id` | UUID | Identificador único da máquina | `550e8400-e29b-41d4-a716-446655440000` |
| `laundry_id` | UUID | ID da lavanderia | `8ace0bcb-83a9-4555-a712-63ef5f52e709` |
| `name` | TEXT | Nome da máquina | `Lavadora 01` |
| `type` | TEXT | Tipo da máquina | `washing` ou `drying` |
| `status` | TEXT | Status atual | `available`, `running`, `maintenance`, `offline` |
| `esp32_id` | TEXT | ID único do ESP32 | `lavadora_01` |
| `relay_pin` | INTEGER | Pino do relé no ESP32 | `1` |
| `price_per_kg` | DECIMAL | Preço por kg | `18.00` |
| `cycle_time_minutes` | INTEGER | Tempo do ciclo em minutos | `35` |
| `capacity_kg` | INTEGER | Capacidade em kg | `10` |
| `location` | TEXT | Localização física | `01` |

## 📡 Tabela: `esp32_status`

| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `id` | UUID | Identificador único | `...` |
| `esp32_id` | TEXT | ID do ESP32 (chave) | `lavadora_01` |
| `laundry_id` | UUID | ID da lavanderia | `8ace0bcb-...` |
| `is_online` | BOOLEAN | ESP32 está online? | `true` |
| `last_heartbeat` | TIMESTAMP | Último heartbeat | `2025-01-15 14:30:00` |
| `ip_address` | TEXT | IP na rede local | `192.168.0.11` |
| `signal_strength` | INTEGER | Força do sinal WiFi | `-45` |
| `relay_status` | JSONB | Estado dos relés | `{"relay_1": "on", "relay_2": "off"}` |
| `uptime_seconds` | INTEGER | Tempo de atividade | `3600` |
| `firmware_version` | TEXT | Versão do firmware | `1.0.0` |

## 💳 Tabela: `transactions`

| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `id` | UUID | Identificador único | `...` |
| `laundry_id` | UUID | ID da lavanderia | `8ace0bcb-...` |
| `machine_id` | UUID | ID da máquina | `...` |
| `user_id` | UUID | ID do usuário (opcional) | `...` |
| `total_amount` | DECIMAL | Valor total | `18.00` |
| `payment_method` | TEXT | Método de pagamento | `credit_card`, `debit_card` |
| `status` | TEXT | Status da transação | `pending`, `completed`, `failed` |
| `started_at` | TIMESTAMP | Início do uso | `2025-01-15 14:30:00` |
| `completed_at` | TIMESTAMP | Fim do uso | `2025-01-15 15:05:00` |
| `duration_minutes` | INTEGER | Duração real | `35` |

## ✅ Lógica de Disponibilidade

```sql
DISPONÍVEL = 
  machines.status = "available" 
  AND esp32_status.is_online = true 
  AND (NOW() - esp32_status.last_heartbeat) < 2 minutos
```

### Validação no APK:

1. **Interface (Botões)**: 
   - Verde "DISPONÍVEL" = `status = "available"` AND `esp32_online = true` AND `heartbeat < 2min`
   - Amarelo "OCUPADA" = `status = "running"` 
   - Laranja "MANUTENÇÃO" = `status = "maintenance"`
   - Cinza "OFFLINE" = `esp32_online = false` OR `heartbeat > 2min`

2. **Pré-Pagamento** (validação em tempo real):
   ```java
   // Query em tempo real antes de processar pagamento
   SELECT status, esp32_id FROM machines WHERE id = ?
   SELECT is_online, last_heartbeat FROM esp32_status WHERE esp32_id = ?
   
   // Validar:
   if (status != "available" OR !esp32_online OR heartbeat > 2min) {
       CANCELAR_PAGAMENTO();
       RECARREGAR_TELA();
   }
   ```

## 🔄 Fluxo de Pagamento Completo

### 1. **Seleção de Máquina**
- Usuário visualiza máquinas disponíveis (botões verdes)
- Sistema mostra apenas máquinas com ESP32 online
- Usuário clica em máquina desejada

### 2. **Tela de Confirmação**
```
✅ MÁQUINA SELECIONADA
🟢 ESP32 ONLINE - ID: lavadora_01

Máquina: Lavadora 01
Tipo: Lavagem
ESP32: lavadora_01 (Relay 1)
Preço: R$ 18.00
Duração: 35 minutos

💳 PAGAMENTO SERÁ PROCESSADO NA PPC930
```

### 3. **Validação Pré-Pagamento**
```java
Log: "=== VALIDAÇÃO PRÉ-PAGAMENTO ==="
Log: "🔍 Validando disponibilidade em tempo real..."

// Query Supabase:
GET /rest/v1/machines?id=eq.{machine_id}
GET /rest/v1/esp32_status?esp32_id=eq.{esp32_id}

// Verificações:
✓ Status = "available"?
✓ ESP32 is_online = true?
✓ last_heartbeat < 2 minutos?

Log: "=== RESULTADO DA VALIDAÇÃO ==="
Log: "Disponível: true/false"
```

**Se NÃO disponível:**
```
❌ Máquina não está mais disponível!
Por favor, selecione outra.

[Aguardar 3 segundos e voltar para tela principal]
```

**Se DISPONÍVEL:**
```
✅ Máquina disponível - prosseguindo com pagamento
```

### 4. **Processamento do Pagamento**
```java
// 1. Criar transação no Supabase
INSERT INTO transactions (
  machine_id, status, total_amount, payment_method
) VALUES (
  'machine_uuid', 'pending', 18.00, 'credit_card'
)

// 2. Processar no PPC930
payGoManager.processPayment(18.00, "Lavadora 01", "TXN123456")

// 3. Aguardar resposta do PPC930
Log: "🔄 COMUNICAÇÃO COM PPC930..."
```

### 5. **Sucesso do Pagamento**
```java
Log: "=== PAGAMENTO APROVADO ==="
Log: "Código: ABC123"

// 1. Atualizar transação
UPDATE transactions SET 
  status = 'completed',
  started_at = NOW()
WHERE id = 'txn_uuid'

// 2. Acionar ESP32
Log: "=== ACIONANDO ESP32 ==="
POST /functions/v1/esp32-control
{
  "esp32_id": "lavadora_01",
  "relay_pin": 1,
  "action": "turn_on",
  "duration_minutes": 35
}

// 3. Atualizar status da máquina
UPDATE machines SET status = 'running' WHERE id = 'machine_uuid'

// 4. Atualizar relay status
UPDATE esp32_status SET 
  relay_status = '{"relay_1": "on"}'
WHERE esp32_id = 'lavadora_01'

Log: "✅ ESP32 acionado com sucesso - máquina liberada"
```

### 6. **Desligamento Automático**
```java
// Timer de 35 minutos (cycle_time_minutes)
new Handler().postDelayed(() -> {
    // Desligar ESP32
    POST /functions/v1/esp32-control
    {
      "esp32_id": "lavadora_01",
      "relay_pin": 1,
      "action": "turn_off"
    }
    
    // Atualizar status
    UPDATE machines SET status = 'available'
    UPDATE esp32_status SET relay_status = '{"relay_1": "off"}'
    UPDATE transactions SET completed_at = NOW()
    
}, 35 * 60 * 1000);
```

## 🎯 Relação Máquina ↔ ESP32

### Arquitetura:
```
1 ESP32 = 1 ou Mais Máquinas
(ESP32 com 5 relés pode controlar até 5 máquinas)

Exemplo:
ESP32: "lavadora_01" (IP: 192.168.0.11)
├── Máquina: "Lavadora 01" (relay_pin = 1)
├── Máquina: "Lavadora 02" (relay_pin = 2)
└── Máquina: "Lavadora 03" (relay_pin = 3)
```

### Dados vêm do Banco:
```sql
SELECT 
  m.id,
  m.name,
  m.type,
  m.status,
  m.esp32_id,
  m.relay_pin,
  m.price_per_kg,
  m.cycle_time_minutes,
  e.is_online,
  e.last_heartbeat,
  e.ip_address,
  e.relay_status
FROM machines m
LEFT JOIN esp32_status e ON m.esp32_id = e.esp32_id
WHERE m.laundry_id = 'laundry_uuid'
ORDER BY m.name
```

### Exemplo de Configuração:
```json
{
  "machine_id": "550e8400-...",
  "name": "Lavadora 01",
  "type": "washing",
  "status": "available",
  "esp32_id": "lavadora_01",
  "relay_pin": 1,
  "price_per_kg": 18.00,
  "cycle_time_minutes": 35,
  "esp32_online": true,
  "last_heartbeat": "2025-01-15T14:30:00Z"
}
```

## 📊 Status Consolidado

O APK computa o status final baseado em:

```java
if (!esp32_online || heartbeat > 2min) {
    status = "OFFLINE";
} else if (machine.status == "available") {
    status = "DISPONÍVEL";
} else if (machine.status == "running") {
    status = "OCUPADA";
} else if (machine.status == "maintenance") {
    status = "MANUTENÇÃO";
} else {
    status = "DESCONHECIDO";
}
```

## 🔐 Segurança

### Validação em Múltiplas Camadas:
1. **Interface (UI)**: Botão só fica verde se validação inicial passar
2. **Pré-Pagamento**: Revalidação em tempo real antes de processar
3. **ESP32**: Apenas máquinas com ESP32 online podem ser acionadas
4. **Transação**: Registro completo no banco para auditoria

### Logs de Debug:
```
[Machine Lavadora 01] ESP32: lavadora_01, Online: true, Last Heartbeat: 1.5min ago
[Machine Lavadora 01] Marked as AVAILABLE (ESP32 online + status available)
🔍 Validando disponibilidade da máquina em tempo real...
Status atual: available, ESP32 Online: true
✅ Máquina disponível - prosseguindo com pagamento
=== ACIONANDO ESP32 ===
Endpoint: /functions/v1/esp32-control
Payload: {esp32_id: lavadora_01, relay_pin: 1}
✅ ESP32 acionado com sucesso - máquina liberada
```

## 📝 Notas Importantes

1. **Cada máquina tem seu próprio ESP32 ID**: Mesmo que múltiplas máquinas compartilhem o mesmo ESP32 físico, cada uma tem configuração independente via `relay_pin`.

2. **Preço e Tempo sempre do Banco**: O APK NUNCA usa valores hardcoded. Tudo vem de `machines.price_per_kg` e `machines.cycle_time_minutes`.

3. **Status Real-Time**: O `MachineStatusMonitor` faz polling a cada 5 segundos para garantir sincronização.

4. **Heartbeat Critical**: ESP32 com heartbeat > 2 minutos é considerado offline, mesmo que `is_online = true`.

5. **Validação Dupla**: Interface valida na exibição + validação final antes do pagamento para evitar race conditions.
