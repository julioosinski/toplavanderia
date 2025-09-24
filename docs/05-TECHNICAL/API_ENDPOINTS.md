# API Endpoints - TopLavanderia

## PayGO Integration Endpoints

### Native Plugin Methods

#### initialize
**Método:** `PayGO.initialize(config)`
```typescript
interface InitializeConfig {
  host: string;        // IP do servidor PayGO
  port: number;        // Porta (padrão: 3000)
  automationKey: string; // Chave de automação
}

// Resposta
interface InitializeResponse {
  success: boolean;
  message: string;
}
```

**Exemplo:**
```typescript
const result = await PayGO.initialize({
  host: "192.168.1.100",
  port: 3000,
  automationKey: "sua-chave-aqui"
});
```

#### processPayment
**Método:** `PayGO.processPayment(transaction)`
```typescript
interface PaymentTransaction {
  paymentType: 'credit' | 'debit' | 'pix';
  amount: number;      // Valor em reais
  orderId: string;     // ID único da transação
}

// Resposta
interface PaymentResponse {
  success: boolean;
  paymentType: string;
  amount: number;
  orderId: string;
  transactionId?: string;
  timestamp?: number;
  message: string;
  status: 'approved' | 'denied' | 'pending';
}
```

**Exemplo:**
```typescript
const payment = await PayGO.processPayment({
  paymentType: 'credit',
  amount: 25.50,
  orderId: 'order-123'
});
```

#### detectPinpad
**Método:** `PayGO.detectPinpad()`
```typescript
interface PinpadDetection {
  detected: boolean;
  deviceName: string;
  vendorId?: number;
  productId?: number;
  deviceId?: number;
  serialNumber?: string;
  error?: string;
}
```

#### getSystemStatus
**Método:** `PayGO.getSystemStatus()`
```typescript
interface SystemStatus {
  initialized: boolean;
  host?: string;
  port?: number;
  clientConnected: boolean;
  libraryVersion?: string;
  usbDeviceDetected: boolean;
  deviceInfo?: {
    vendorId: number;
    productId: number;
    deviceName: string;
    serialNumber: string;
  };
  timestamp: number;
  error?: string;
}
```

#### testConnection
**Método:** `PayGO.testConnection()`
```typescript
interface ConnectionTest {
  success: boolean;
  usbConnection: boolean;
  clientStatus: string;
  message: string;
  timestamp: number;
}
```

#### cancelTransaction
**Método:** `PayGO.cancelTransaction()`
```typescript
interface CancelResponse {
  success: boolean;
  message: string;
}
```

#### checkStatus
**Método:** `PayGO.checkStatus()`
```typescript
interface StatusCheck {
  connected: boolean;
  status: string;
}
```

## Supabase Edge Functions

### ESP32 Credit Release
**Endpoint:** `/functions/v1/esp32-credit-release`
**Método:** POST

```typescript
// Request
interface CreditReleaseRequest {
  machine_id: string;
  credits: number;
  esp32_ip: string;
}

// Response
interface CreditReleaseResponse {
  success: boolean;
  message: string;
  transaction_id?: string;
}
```

### ESP32 Load Balancer
**Endpoint:** `/functions/v1/esp32-load-balancer`
**Método:** GET/POST

```typescript
// Response
interface LoadBalancerResponse {
  available_esp32s: string[];
  recommended_ip: string;
  load_distribution: Record<string, number>;
}
```

### ESP32 Monitor
**Endpoint:** `/functions/v1/esp32-monitor`
**Método:** GET

```typescript
// Response
interface MonitorResponse {
  esp32_devices: Array<{
    ip: string;
    status: 'online' | 'offline';
    last_ping: string;
    connected_machines: number;
  }>;
}
```

### NFSe Automation
**Endpoint:** `/functions/v1/nfse-automation`
**Método:** POST

```typescript
// Request
interface NFSeRequest {
  transaction_id: string;
  amount: number;
  customer_data: {
    name: string;
    document: string;
    email?: string;
  };
}

// Response
interface NFSeResponse {
  success: boolean;
  nfse_number?: string;
  xml_url?: string;
  error?: string;
}
```

## React Hooks APIs

### useRealPayGOIntegration
```typescript
const {
  isInitialized,
  isConnected,
  isProcessing,
  systemStatus,
  lastError,
  initialize,
  checkStatus,
  processPayment,
  cancelTransaction,
  detectPinpad,
  getSystemStatus,
  testConnection
} = useRealPayGOIntegration();
```

### useUniversalPayment
```typescript
const {
  isProcessing,
  currentMethod,
  methodsStatus,
  processPayment,
  testAllMethods,
  getBestAvailableMethod
} = useUniversalPayment();
```

### usePixPayment
```typescript
const {
  generatePixQR,
  checkPixStatus,
  pixData,
  isPolling
} = usePixPayment();
```

## Error Codes

### PayGO Error Codes
| Código | Constante | Descrição |
|--------|-----------|-----------|
| 0 | SUCCESS | Operação bem-sucedida |
| -1 | ERROR_DEVICE_NOT_FOUND | Dispositivo não encontrado |
| -2 | ERROR_PAYMENT_CANCELLED | Pagamento cancelado |
| -3 | ERROR_INVALID_AMOUNT | Valor inválido |
| -4 | ERROR_CONNECTION_FAILED | Falha na conexão |
| -5 | ERROR_AUTHENTICATION_FAILED | Falha na autenticação |

### HTTP Status Codes
| Status | Descrição |
|--------|-----------|
| 200 | OK - Operação bem-sucedida |
| 400 | Bad Request - Dados inválidos |
| 401 | Unauthorized - Não autorizado |
| 404 | Not Found - Recurso não encontrado |
| 500 | Internal Server Error - Erro interno |
| 503 | Service Unavailable - Serviço indisponível |

## Rate Limits

### PayGO Operations
- Máximo 1 transação simultânea por terminal
- Timeout padrão: 120 segundos para transações
- Timeout conexão: 30 segundos

### API Limits
- 100 requests/minuto por IP para Edge Functions
- 10 transações/minuto por terminal PayGO
- PIX: 50 gerações QR/minuto

## Webhooks

### PayGO Transaction Events
```typescript
interface PayGOWebhook {
  event_type: 'payment_completed' | 'payment_failed' | 'payment_cancelled';
  transaction_id: string;
  amount: number;
  timestamp: string;
  terminal_id: string;
  metadata: Record<string, any>;
}
```

### ESP32 Status Events
```typescript
interface ESP32Webhook {
  event_type: 'machine_connected' | 'machine_disconnected' | 'credit_released';
  esp32_ip: string;
  machine_id?: string;
  timestamp: string;
}
```