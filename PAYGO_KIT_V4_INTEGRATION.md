# PayGo Android Kit v4.1.50.5 Integration Guide

## Overview

This document describes the integration of the PayGo Android Kit v4.1.50.5 into the Top Lavanderia project. The integration uses the official PayGo automation interface (InterfaceAutomacao v2.1.0.6) for processing payments through PPC930 devices.

## Kit Contents

The PayGo Android Kit v4.1.50.5 includes:

- **InterfaceAutomacao-v2.1.0.6.aar**: Main automation library
- **PayGo Integrado v4.1.50.5 APK**: PayGo client application (CERT and PROD versions)
- **PDVS Android v2.2 APK**: Example integration application
- **Javadoc**: Complete API documentation
- **Printer AAR v1.5.8**: Optional printing library

## Key Features

### New in v4.1.50.5
- Enhanced PAT-Elo support
- Improved transaction confirmation handling
- Better error handling and logging
- Support for new payment modalities
- Enhanced security features

### Supported Payment Types
- **Credit Card**: Visa, Mastercard, Elo, American Express
- **Debit Card**: Visa Electron, Maestro
- **PIX**: Instant payment method
- **Voucher**: Store credit and gift cards

## Implementation Details

### 1. Dependencies

The integration requires the following dependencies in `android/app/build.gradle`:

```gradle
// PayGO Library
implementation(name: 'InterfaceAutomacao-v2.1.0.6', ext: 'aar')
implementation 'org.apache.commons:commons-lang3:3.9'
```

### 2. Core Classes

#### PayGOManager.java
Main class handling PayGo integration:

```java
// Key imports
import br.com.setis.interfaceautomacao.DadosAutomacao;
import br.com.setis.interfaceautomacao.Transacoes;
import br.com.setis.interfaceautomacao.Transacao;
import br.com.setis.interfaceautomacao.EntradaTransacao;
import br.com.setis.interfaceautomacao.SaidaTransacao;
import br.com.setis.interfaceautomacao.Operacoes;
import br.com.setis.interfaceautomacao.ModalidadesPagamento;
import br.com.setis.interfaceautomacao.ModalidadesTransacao;
import br.com.setis.interfaceautomacao.Confirmacoes;
import br.com.setis.interfaceautomacao.Confirmacao;
import br.com.setis.interfaceautomacao.StatusTransacao;
```

#### Key Methods

**Initialization:**
```java
public boolean initialize(String host, int port, String automationKey)
```

**Payment Processing:**
```java
public JSObject processPayment(String paymentType, double amount, String orderId)
```

**Transaction Confirmation:**
```java
private void confirmTransaction(String confirmationId)
```

**Transaction Cancellation:**
```java
public boolean cancelTransaction()
```

### 3. Payment Flow

The payment process follows the official PayGo automation interface flow:

1. **Initialize Automation Data**: Create `DadosAutomacao` with establishment information
2. **Get Transaction Instance**: Obtain `Transacoes` and `Transacao` instances
3. **Create Transaction Input**: Build `EntradaTransacao` with payment details
4. **Process Transaction**: Call `transacao.realizaTransacao(entradaTransacao)`
5. **Handle Response**: Process `SaidaTransacao` for results and confirmation needs
6. **Confirm if Required**: Automatically confirm transactions that require confirmation

### 4. Configuration

#### PayGOConfig.java
Contains all configuration constants:

```java
// Default Settings
public static final String DEFAULT_HOST = "192.168.1.100";
public static final int DEFAULT_PORT = 3000;
public static final String DEFAULT_LOGIC_NUMBER = "1";
public static final String DEFAULT_SERIAL = "PPC930";

// Payment Types
public static final int PAYMENT_TYPE_CREDIT = 1;
public static final int PAYMENT_TYPE_DEBIT = 2;
public static final int PAYMENT_TYPE_PIX = 3;

// Validation
public static final double MIN_AMOUNT = 0.01;
public static final double MAX_AMOUNT = 99999.99;
public static final int MAX_ORDER_ID_LENGTH = 50;
```

## Usage Examples

### Basic Payment Processing

```java
// Initialize PayGo
PayGOManager paygoManager = new PayGOManager(context);
boolean initialized = paygoManager.initialize("192.168.1.100", 3000, "your-automation-key");

if (initialized) {
    // Process credit card payment
    JSObject result = paygoManager.processPayment("credit", 25.50, "ORDER123");
    
    if (result.getBoolean("success")) {
        // Payment approved
        String nsu = result.getString("nsu");
        String transactionId = result.getString("transactionId");
        // Handle success
    } else {
        // Payment denied
        String errorMessage = result.getString("message");
        // Handle error
    }
}
```

### PIX Payment

```java
// Process PIX payment
JSObject result = paygoManager.processPayment("pix", 15.00, "ORDER456");
```

### Transaction Cancellation

```java
// Cancel current transaction
boolean cancelled = paygoManager.cancelTransaction();
```

## Error Handling

The integration includes comprehensive error handling:

- **Validation Errors**: Invalid amounts, order IDs, payment types
- **Connection Errors**: USB device not found, network issues
- **Transaction Errors**: Payment declined, timeout, cancellation
- **Confirmation Errors**: Failed transaction confirmation

## Device Support

### PPC930 USB Device IDs
- Primary: Vendor ID 8137, Product ID 5169
- Secondary: Vendor ID 1027, Product ID 24577

### USB Detection
The system automatically detects connected PPC930 devices and validates USB connections before processing payments.

## Testing

### Test Environment
Use the CERT version of PayGo Integrado for testing:
- APK: `PGIntegrado-v4.1.50.5_CERT_geral_250605.zip`
- Test with demo transactions
- Validate all payment types

### Production Environment
Use the PROD version for live transactions:
- APK: `PGIntegrado-v4.1.50.5_PROD_geral_250605.zip`
- Configure with production credentials
- Enable transaction logging

## Troubleshooting

### Common Issues

1. **USB Device Not Found**
   - Check PPC930 connection
   - Verify USB permissions
   - Check device IDs in logs

2. **Transaction Timeout**
   - Increase timeout values in PayGOConfig
   - Check network connectivity
   - Verify PayGo Integrado APK is running

3. **Confirmation Errors**
   - Ensure confirmation is called for required transactions
   - Check confirmation ID validity
   - Verify transaction status

### Debug Logging

Enable detailed logging by checking Android logs for:
- PayGOManager tag messages
- Transaction flow details
- Error messages and stack traces

## Security Considerations

- Store automation keys securely
- Use HTTPS for network communications
- Implement proper transaction logging
- Follow PCI DSS guidelines for payment processing

## Version History

- **v4.1.50.5**: Current version with enhanced features
- **v2.1.0.6**: InterfaceAutomacao library version
- **v2.2**: PDVS Android example version

## Support

For technical support and documentation:
- Refer to the included Javadoc documentation
- Check the example PDVS Android implementation
- Contact PayGo support for integration issues

## License

This integration follows PayGo's licensing terms and conditions. Ensure compliance with all applicable regulations and standards.
