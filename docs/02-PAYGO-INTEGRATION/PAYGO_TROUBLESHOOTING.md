# PayGO - Solução de Problemas

## Problemas Comuns

### 1. Pinpad Não Detectado

#### Sintomas
- `detectPinpad()` retorna `detected: false`
- USB device não aparece no sistema
- Erro "Device not found"

#### Soluções
```bash
# Verificar dispositivos USB
adb shell lsusb

# Verificar permissões
# No AndroidManifest.xml deve ter:
<uses-permission android:name="android.permission.USB_PERMISSION" />
```

**Passos de diagnóstico:**
1. Verificar cabo USB (deve ser cabo de dados, não só carregamento)
2. Confirmar que o PPC930 está ligado
3. Testar em porta USB diferente
4. Verificar se driver está instalado no Android

### 2. Erro de Inicialização

#### Sintomas
- `initialize()` retorna `success: false`
- Erro "Failed to initialize PayGO"
- Library não carrega

#### Soluções
```java
// Verificar se .aar está no local correto
android/app/libs/InterfaceAutomacao-v2.1.0.6.aar

// build.gradle deve conter:
implementation files('libs/InterfaceAutomacao-v2.1.0.6.aar')
```

### 3. Falhas de Pagamento

#### Sintomas
- Transação negada sem motivo aparente
- Timeout durante processamento
- Erro de comunicação

#### Diagnóstico
```typescript
// Testar conexão primeiro
const status = await PayGO.testConnection();
console.log('Connection:', status);

// Verificar configuração
const config = {
  host: "192.168.1.100", // IP correto?
  port: 3000,            // Porta correta?
  automationKey: "key"   // Chave válida?
};
```

### 4. Problemas de Rede

#### Sintomas
- "Connection failed"
- Timeout errors
- Intermittência

#### Soluções
```bash
# Testar conectividade
ping 192.168.1.100
telnet 192.168.1.100 3000

# Verificar firewall
# Porta 3000 deve estar aberta
```

### 5. Erros de Certificado/SSL

#### Sintomas
- SSL handshake failed
- Certificate errors
- HTTPS issues

#### Configuração
```xml
<!-- network_security_config.xml -->
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">192.168.1.100</domain>
    </domain-config>
</network-security-config>
```

## Códigos de Erro PayGO

| Código | Descrição | Solução |
|--------|-----------|---------|
| -1 | Device not found | Verificar conexão USB |
| -2 | Payment cancelled | Normal - usuário cancelou |
| -3 | Invalid amount | Verificar valor (min: 0.01) |
| -4 | Connection failed | Verificar rede/host |
| -5 | Authentication failed | Verificar chave automação |

## Logs Úteis

### Android Logs
```bash
# Filtrar logs PayGO
adb logcat | grep PayGO

# Logs de USB
adb logcat | grep -i usb
```

### Capacitor Logs
```typescript
// Ativar logs detalhados
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // ...
  plugins: {
    PayGO: {
      logLevel: 'debug'
    }
  }
};
```

## Ferramentas de Diagnóstico

### Teste Manual
```typescript
// Sequência completa de teste
const diagnostics = async () => {
  // 1. Detectar pinpad
  const pinpad = await PayGO.detectPinpad();
  console.log('Pinpad:', pinpad);
  
  // 2. Testar conexão
  const connection = await PayGO.testConnection();
  console.log('Connection:', connection);
  
  // 3. Status do sistema
  const status = await PayGO.getSystemStatus();
  console.log('System:', status);
  
  // 4. Teste de pagamento pequeno
  const payment = await PayGO.processPayment({
    paymentType: 'credit',
    amount: 1.00,
    orderId: 'test-' + Date.now()
  });
  console.log('Payment:', payment);
};
```

### Component de Diagnóstico
Use o componente `RealPayGODiagnostics` para teste visual:
```typescript
import { RealPayGODiagnostics } from '@/components/admin/RealPayGODiagnostics';

// No admin panel
<RealPayGODiagnostics 
  config={paygoConfig}
  onConfigChange={setPaygoConfig}
/>
```

## Contato Suporte

**Issues Técnicos:**
- GitHub Issues: [repository-url]/issues
- Email: suporte@toplavanderia.com

**PayGO Específico:**
- Documentação oficial PayGO
- Suporte técnico PayGO
- Fórum desenvolvedores