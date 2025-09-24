# Documentação - Integração PayGO + PPC930

## 📋 Visão Geral

Este documento descreve a integração completa entre o sistema PayGO e o pinpad PPC930 no aplicativo de lavanderia. A integração suporta tanto plataformas móveis (Android) quanto web, com detecção automática do ambiente.

## 🏗️ Arquitetura da Integração

### Componentes Principais

1. **Plugin Nativo Android** (`PayGOPlugin.java`, `PayGOManager.java`)
2. **Interface TypeScript** (`src/plugins/paygo.ts`)
3. **Hook React** (`src/hooks/usePayGOIntegration.ts`)
4. **Componente de Diagnóstico** (`src/components/admin/PayGOPPC930Diagnostics.tsx`)
5. **Biblioteca PayGO** (`InterfaceAutomacao-v2.1.0.6.aar`)

### Fluxo de Funcionamento

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Hook    │───▶│ Plugin Nativo   │───▶│ Biblioteca .AAR │
│ usePayGOInteg.  │    │ PayGOPlugin     │    │ InterfaceAuto.  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       ▼
         │                       │              ┌─────────────────┐
         │                       │              │   PPC930 USB    │
         │                       │              │     Pinpad      │
         │                       │              └─────────────────┘
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│  Fallback HTTP  │    │ Detecção USB    │
│  (Web/Desktop)  │    │   (Mobile)      │
└─────────────────┘    └─────────────────┘
```

## 🔧 Configuração Inicial

### 1. Pré-requisitos Android

**Dependências no `build.gradle`:**
```gradle
implementation(name: 'InterfaceAutomacao-v2.1.0.6', ext: 'aar')
```

**Permissões no `AndroidManifest.xml`:**
```xml
<uses-permission android:name="android.permission.USB_PERMISSION" />
<uses-feature android:name="android.hardware.usb.host" android:required="false" />
```

**Filtro de Dispositivos USB:**
```xml
<!-- PPC930 Pinpad -->
<usb-device vendor-id="8137" product-id="5169" />
<usb-device vendor-id="1027" product-id="24577" />
```

### 2. Configuração do PayGO

```typescript
const paygoConfig = {
  host: "192.168.1.100",        // IP do terminal PayGO
  port: 9999,                   // Porta do serviço
  timeout: 30000,               // Timeout em ms
  retryAttempts: 3,             // Tentativas de retry
  retryDelay: 1000,             // Delay entre retries
  automationKey: "sua-chave",   // Chave de automação
  cnpjCpf: "12345678901234"     // CNPJ/CPF do estabelecimento
};
```

## 🚀 Como Usar

### 1. Hook Principal

```typescript
import { usePayGOIntegration } from '@/hooks/usePayGOIntegration';

const MyComponent = () => {
  const {
    status,
    isProcessing,
    checkPayGOStatus,
    initializePayGO,
    processPayGOPayment,
    processPixPayment,
    cancelTransaction,
    testConnection,
    detectPinpad
  } = usePayGOIntegration(paygoConfig);

  // Seu código aqui...
};
```

### 2. Detecção do PPC930

```typescript
const handleDetectPinpad = async () => {
  const result = await detectPinpad();
  
  if (result.detected) {
    console.log('PPC930 detectado!');
    console.log('Vendor ID:', result.vendorId);
    console.log('Product ID:', result.productId);
    console.log('Serial:', result.serialNumber);
  } else {
    console.log('PPC930 não encontrado:', result.error);
  }
};
```

### 3. Processamento de Pagamentos

**Pagamento com Cartão:**
```typescript
const processPayment = async () => {
  const transaction = {
    amount: 25.50,
    paymentType: 'CREDIT' as const,
    orderId: 'LAV001',
    installments: 1
  };

  const result = await processPayGOPayment(transaction);
  
  if (result.success) {
    console.log('Pagamento aprovado!');
    console.log('NSU:', result.nsu);
    console.log('Autorização:', result.authorizationCode);
  }
};
```

**Pagamento PIX:**
```typescript
const processPixPayment = async () => {
  const transaction = {
    amount: 25.50,
    paymentType: 'PIX' as const,
    orderId: 'LAV001'
  };

  const result = await processPixPayment(transaction);
  
  if (result.success) {
    console.log('QR Code gerado:', result.qrCode);
    // Exibir QR Code para o cliente
    
    // Verificar status do pagamento periodicamente
    const statusCheck = setInterval(async () => {
      const status = await checkPixPaymentStatus(transaction.orderId!);
      if (status.success) {
        clearInterval(statusCheck);
        console.log('PIX pago com sucesso!');
      }
    }, 5000);
  }
};
```

### 4. Componente de Diagnóstico

```tsx
import { PayGOPPC930Diagnostics } from '@/components/admin/PayGOPPC930Diagnostics';

const AdminPanel = () => {
  return (
    <PayGOPPC930Diagnostics config={paygoConfig} />
  );
};
```

## 🔍 Diagnóstico e Troubleshooting

### Status do Sistema

O componente de diagnóstico fornece:

- ✅ **Status Online/Offline** do PayGO
- ✅ **Detecção automática** do PPC930
- ✅ **Informações do dispositivo** (Vendor ID, Product ID, Serial)
- ✅ **Teste de conectividade** em tempo real
- ✅ **Inicialização** do sistema PayGO

### Resolução de Problemas Comuns

#### 1. PPC930 não detectado
```bash
Problema: "PPC930 não foi detectado"

Soluções:
- Verificar conexão USB física
- Confirmar se o device_filter.xml está correto
- Testar com diferentes portas USB
- Verificar se o driver USB está instalado
```

#### 2. Falha na inicialização PayGO
```bash
Problema: "PayGO não inicializado"

Soluções:
- Verificar configurações de rede (host/port)
- Confirmar chave de automação
- Testar conectividade com ping
- Verificar firewall/antivirus
```

#### 3. Timeout nas transações
```bash
Problema: "Timeout durante pagamento"

Soluções:
- Aumentar valor do timeout
- Verificar estabilidade da rede
- Testar em horários de menor uso
- Verificar logs do PayGO
```

## 📱 Multiplataforma

### Comportamento por Plataforma

| Funcionalidade | Android | iOS | Web |
|----------------|---------|-----|-----|
| Detecção USB | ✅ Nativo | ❌ N/A | ❌ Fallback |
| Comunicação PayGO | ✅ Plugin | ✅ Plugin | ✅ HTTP |
| Processamento | ✅ Completo | ✅ Completo | ✅ Limitado |
| Diagnóstico | ✅ Completo | ✅ Parcial | ⚠️ Básico |

### Fallbacks Automáticos

O sistema detecta automaticamente o ambiente e escolhe a melhor implementação:

```typescript
// Detecção automática de plataforma
if (Capacitor.isNativePlatform()) {
  // Usa plugin nativo (Android/iOS)
  const result = await PayGO.processPayment(transaction);
} else {
  // Fallback HTTP (Web)
  const response = await fetch(`http://${host}:${port}/transaction`, {
    method: 'POST',
    body: JSON.stringify(transaction)
  });
}
```

## 🔒 Segurança

### Boas Práticas

1. **Chave de Automação**: Mantenha segura e não exponha no código
2. **Validação**: Sempre valide responses do PayGO
3. **Timeout**: Configure timeouts apropriados
4. **Logs**: Monitore transações em produção
5. **Certificação**: Use apenas em ambiente homologado

### Configuração Segura

```typescript
// ✅ Correto - usar variáveis de ambiente
const config = {
  automationKey: process.env.PAYGO_AUTOMATION_KEY,
  // ...
};

// ❌ Incorreto - chave hardcoded
const config = {
  automationKey: "minha-chave-secreta",
  // ...
};
```

## 📊 Monitoramento

### Métricas Importantes

- **Taxa de sucesso** das transações
- **Tempo médio** de processamento
- **Falhas consecutivas** de conexão
- **Status do pinpad** (conectado/desconectado)

### Logs e Debug

```typescript
// Exemplo de log estruturado
console.log('PayGO Transaction:', {
  orderId: transaction.orderId,
  amount: transaction.amount,
  type: transaction.paymentType,
  timestamp: new Date().toISOString(),
  status: result.success ? 'success' : 'failed'
});
```

## 📚 Referências

### APIs Disponíveis

| Método | Descrição | Plataforma |
|--------|-----------|------------|
| `initialize()` | Inicializa PayGO | Todas |
| `checkStatus()` | Verifica conectividade | Todas |
| `processPayment()` | Processa pagamento | Todas |
| `processPixPayment()` | Gera QR PIX | Todas |
| `cancelTransaction()` | Cancela transação | Todas |
| `detectPinpad()` | Detecta PPC930 | Mobile |

### Códigos de Resposta

| Código | Descrição |
|--------|-----------|
| 0 | Sucesso |
| -1 | Erro genérico |
| 1 | Transação negada |
| 2 | Timeout |
| 3 | Cancelada pelo usuário |

## 🔄 Próximos Passos

1. **Testes em produção** com PPC930 real
2. **Implementação iOS** quando necessário
3. **Métricas avançadas** de performance
4. **Integração com outros pinpads** se necessário
5. **Certificação PayGO** oficial

---

## 🆘 Suporte

Para suporte técnico:
- **PayGO**: Documentação oficial do fabricante
- **PPC930**: Manual técnico do dispositivo
- **Capacitor**: [Documentação oficial](https://capacitorjs.com/)
- **Lovable**: [Documentação](https://docs.lovable.dev/)

---

*Documentação gerada automaticamente - Versão 1.0*