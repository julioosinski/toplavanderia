# PayGo Integration Test Guide

## Prerequisites

1. **PayGo Integrado APK**: Install the appropriate version
   - CERT: `PGIntegrado-v4.1.50.5_CERT_geral_250605.zip` (for testing)
   - PROD: `PGIntegrado-v4.1.50.5_PROD_geral_250605.zip` (for production)

2. **PPC930 Device**: Connect and configure the payment terminal

3. **Android Device**: Ensure USB debugging is enabled

## Test Steps

### 1. Install PayGo Integrado APK

```bash
# Install CERT version for testing
adb install PGIntegrado-v4.1.50.5_CERT_geral_250605.apk
```

### 2. Configure PayGo Integrado

1. Open the PayGo Integrado app
2. Click "Parear Bluetooth" to pair with PPC930
3. Select the PPC930 device from the list
4. Enter pairing password if required
5. Configure the device settings

### 3. Install Point of Capture

1. Start an administrative operation
2. Select "INSTALACAO"
3. Enter technical password: `314159`
4. Indicate the capture point to be used
5. Enter the CNPJ configured for the capture point
6. Confirm server name and TCP port
7. Print installation receipt

### 4. Test Payment Processing

#### Test Credit Card Payment

```javascript
// In your React Native app
const testCreditPayment = async () => {
  try {
    const result = await processPayGOPayment({
      paymentType: 'credit',
      amount: 10.00,
      orderId: 'TEST_CREDIT_' + Date.now()
    });
    
    console.log('Credit payment result:', result);
    return result;
  } catch (error) {
    console.error('Credit payment error:', error);
  }
};
```

#### Test Debit Card Payment

```javascript
const testDebitPayment = async () => {
  try {
    const result = await processPayGOPayment({
      paymentType: 'debit',
      amount: 15.50,
      orderId: 'TEST_DEBIT_' + Date.now()
    });
    
    console.log('Debit payment result:', result);
    return result;
  } catch (error) {
    console.error('Debit payment error:', error);
  }
};
```

#### Test PIX Payment

```javascript
const testPixPayment = async () => {
  try {
    const result = await processPayGOPayment({
      paymentType: 'pix',
      amount: 25.00,
      orderId: 'TEST_PIX_' + Date.now()
    });
    
    console.log('PIX payment result:', result);
    return result;
  } catch (error) {
    console.error('PIX payment error:', error);
  }
};
```

### 5. Test Transaction Cancellation

```javascript
const testCancellation = async () => {
  try {
    const result = await cancelPayGOPayment();
    console.log('Cancellation result:', result);
    return result;
  } catch (error) {
    console.error('Cancellation error:', error);
  }
};
```

### 6. Test Device Detection

```javascript
const testDeviceDetection = async () => {
  try {
    const result = await detectPayGODevice();
    console.log('Device detection result:', result);
    return result;
  } catch (error) {
    console.error('Device detection error:', error);
  }
};
```

## Expected Results

### Successful Payment
```json
{
  "success": true,
  "paymentType": "credit",
  "amount": 10.00,
  "orderId": "TEST_CREDIT_1234567890",
  "transactionId": "TXN123456789",
  "nsu": "123456",
  "authorizationCode": "AUTH123456",
  "status": "approved",
  "message": "Payment processed successfully",
  "needsConfirmation": false,
  "timestamp": 1234567890123
}
```

### Failed Payment
```json
{
  "success": false,
  "paymentType": "credit",
  "amount": 10.00,
  "orderId": "TEST_CREDIT_1234567890",
  "status": "denied",
  "message": "Transaction failed with code: -1",
  "timestamp": 1234567890123
}
```

### Device Detection
```json
{
  "detected": true,
  "deviceName": "PPC930",
  "vendorId": 8137,
  "productId": 5169,
  "deviceId": 123,
  "serialNumber": "PPC930_SERIAL"
}
```

## Troubleshooting

### Common Issues

1. **"PayGO not initialized"**
   - Check if PayGo Integrado APK is installed and running
   - Verify USB connection to PPC930
   - Check automation key configuration

2. **"USB Device Not Found"**
   - Ensure PPC930 is connected via USB
   - Check USB debugging is enabled
   - Verify device IDs in PayGOConfig

3. **"Transaction Timeout"**
   - Check network connectivity
   - Verify PayGo Integrado is running
   - Increase timeout values if needed

4. **"Invalid Payment Type"**
   - Ensure payment type is one of: "credit", "debit", "pix"
   - Check case sensitivity

5. **"Invalid Amount"**
   - Amount must be between 0.01 and 99999.99
   - Check decimal formatting

### Debug Commands

```bash
# Check if PayGo Integrado is running
adb shell ps | grep paygo

# Check USB devices
adb devices

# View Android logs
adb logcat | grep PayGOManager

# Check PayGo Integrado logs
adb logcat | grep PayGo
```

## Test Checklist

- [ ] PayGo Integrado APK installed
- [ ] PPC930 device connected and paired
- [ ] Point of capture installed
- [ ] Credit card payment test
- [ ] Debit card payment test
- [ ] PIX payment test
- [ ] Transaction cancellation test
- [ ] Device detection test
- [ ] Error handling test
- [ ] Logging verification

## Homologação e credencial de produção (resumo)

O **credenciamento definitivo** (chaves, TID, ambiente produtivo) é definido pela **credenciadora/adquirente** e pelo **contrato PayGo**, não só pelo app. Use o checklist abaixo para validar o sistema antes de pedir **produção**.

### Checklist técnico no tablet (CERT)

1. **PayGo Integrado CERT** instalado e aberto; pinpad **USB** (ou BT, conforme kit) pareado e respondendo.
2. **Instalação de ponto de captura** concluída (operação administrativa → INSTALAÇÃO, senha técnica conforme manual, CNPJ do ponto, servidor/porta de **homologação**).
3. **Top Lavanderia** com totem configurado (CNPJ), máquinas carregando, pagamento **Crédito**, **Débito** e **PIX** (se habilitado no contrato) executados com **cartões/amostras de teste** fornecidos pela adquirente.
4. **Comprovantes**: conferir NSU/autorização, valores corretos e registro no painel/back-end (Supabase), se aplicável.
5. **Cancelamento / estorno**: se o escopo exigir, repetir fluxos conforme manual PayGo.
6. **Estabilidade**: repetir vendas seguidas, troca de tela, reconexão USB.

### O que a adquirente / PayGo costuma exigir para liberar produção

- Evidências de testes em **CERT** (prints, relatórios ou checklist assinado — seguir o que o **suporte comercial/técnico PayGo** pedir).
- **Dados cadastrais** do estabelecimento e **CNPJ** do ponto de captura alinhados ao contrato.
- Substituição do **APK CERT** pelo **APK PROD** e parâmetros de **servidor/porta produtivos** (quando não for automático pela instalação).
- Em alguns casos, **visita técnica** ou validação remota.

### Produção (após liberação)

1. Instalar **PayGo Integrado PROD** (pacote do kit, não reutilizar CERT em loja).
2. Refazer **instalação de ponto de captura** em modo produção, se exigido.
3. Validar **uma venda real de baixo valor** e conciliação.

> **Importante:** o roteiro oficial pode variar (bandeira, adquirente, versão do kit). Confirme sempre com o **manual do Kit PayGo Android** recebido e com o **canal de homologação** da PayGo.

## Production Deployment

Before deploying to production:

1. Replace CERT APK with PROD APK
2. Update configuration with production values
3. Test with real payment cards
4. Verify transaction logging
5. Implement proper error handling
6. Set up monitoring and alerts

## Support

If you encounter issues during testing:

1. Check the Android logs for detailed error messages
2. Verify all prerequisites are met
3. Test with the PDVS Android example app
4. Contact PayGo support with specific error details
