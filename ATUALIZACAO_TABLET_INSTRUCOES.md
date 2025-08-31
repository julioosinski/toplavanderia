# 📱 INSTRUÇÕES DE ATUALIZAÇÃO DO TABLET

## 🚀 COMO ATUALIZAR O TABLET COM BLUETOOTH

### 1. **Faça o Git Pull do Projeto**
```bash
git pull origin main
```

### 2. **Instale as Novas Dependências**
```bash
npm install
npm install @capacitor-community/bluetooth-serial
```

### 3. **Configure o Capacitor para Bluetooth**
Adicione no arquivo `capacitor.config.ts` (se não estiver):
```typescript
plugins: {
  BluetoothSerial: {
    connectTimeout: 60000,
    scanTimeout: 5000,
    enableHighAccuracy: true
  }
}
```

### 4. **Adicione Permissões Android**
No arquivo `android/app/src/main/AndroidManifest.xml`, adicione:
```xml
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
```

### 5. **Build e Sincronize**
```bash
npm run build
npx cap sync android
npx cap build android
```

### 6. **Gerar o APK**
```bash
cd android
./gradlew assembleDebug
```

### 7. **Localizar o APK**
O arquivo estará em:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 📋 ARQUIVO PARA TRANSFERIR AO TABLET

**Nome do Arquivo**: `app-debug.apk`
**Localização**: `android/app/build/outputs/apk/debug/app-debug.apk`

### Como Transferir:
1. **USB**: Copie o arquivo via cabo USB
2. **Email**: Envie por email e baixe no tablet  
3. **Google Drive**: Upload e download no tablet
4. **ADB**: `adb install app-debug.apk`

---

## ✅ VERIFICAÇÃO PÓS-INSTALAÇÃO

### 1. **Teste o Sistema Universal**
- Acesse `[URL]/totem`
- Selecione uma máquina
- Verifique se aparece o **Widget Universal de Pagamento**

### 2. **Teste o Bluetooth**
- Acesse `[URL]/admin`
- Vá para aba **"Bluetooth"**
- Teste "Habilitar Bluetooth"
- Teste "Buscar Dispositivos"

### 3. **Configure a Positivo L4**
- Pareie a maquininha via Admin Panel
- Execute teste de pagamento
- Verifique funcionamento no totem

---

## 🔧 NOVAS FUNCIONALIDADES DISPONÍVEIS

### ✅ **Widget Universal de Pagamento**
- Detecção automática: PayGO → TEF → Bluetooth → Manual
- Interface única para todos os métodos
- Fallback inteligente entre métodos

### ✅ **Bluetooth Integration**  
- Suporte universal para maquininhas Bluetooth
- Pareamento via Admin Panel
- Teste de conexão e pagamento

### ✅ **Admin Panel Melhorado**
- Nova aba "Bluetooth" 
- Monitor de status de todos os métodos
- Configuração centralizada
- Diagnósticos avançados

---

## 🆘 TROUBLESHOOTING

### Erro de Instalação:
```bash
# Limpe o cache e reinstale
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Erro de Build:
```bash
# Limpe e rebuild
npx cap clean android
npx cap sync android  
npx cap build android
```

### Bluetooth não funciona:
- Verifique permissões do Android
- Confirme que o tablet suporta Bluetooth
- Teste com maquininha no modo pareamento

---

## 📱 COMPATIBILIDADE

### Testado em:
- ✅ Android 7.0+
- ✅ Tablets com Bluetooth 4.0+  
- ✅ Positivo L4
- ✅ Maquininhas genéricas Bluetooth

### Não testado:
- ⚠️ iOS (necessita configuração adicional)
- ⚠️ Maquininhas proprietárias

---

**🔥 SISTEMA TOTALMENTE ATUALIZADO! 🔥**

*Data: $(date) - Versão: Universal Bluetooth v2.0*