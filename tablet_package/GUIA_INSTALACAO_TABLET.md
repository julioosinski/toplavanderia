# Guia de Instalação no Tablet Android

## ⚠️ **IMPORTANTE: Processo Correto**

O arquivo `install_tablet.bat` deve ser executado no **COMPUTADOR WINDOWS**, não no tablet Android!

## 📋 **Pré-requisitos**

### No Computador:
- [ ] Windows 10/11
- [ ] Android SDK instalado (ADB)
- [ ] Tablet conectado via USB
- [ ] Depuração USB habilitada no tablet

### No Tablet:
- [ ] Android 5.1+ (API 22+)
- [ ] PPC930 conectado via USB
- [ ] Conexão de rede disponível

## 🚀 **Passo a Passo**

### **1. Preparar o Tablet**
1. Conectar tablet ao computador via USB
2. No tablet: Configurações > Sobre o dispositivo > Tocar 7 vezes em "Número da versão"
3. Voltar para Configurações > Opções do desenvolvedor
4. Ativar "Depuração USB"
5. Permitir depuração USB quando solicitado

### **2. Verificar Conexão**
No computador, abrir Prompt de Comando:
```cmd
adb devices
```
Deve aparecer algo como:
```
List of devices attached
ABC123456789    device
```

### **3. Instalar PayGo Integrado**
```cmd
# Para testes (CERT)
adb install paygo_files\PGIntegrado-v4.1.50.5_CERT_geral_250605.apk

# Para produção (PROD)
adb install paygo_files\PGIntegrado-v4.1.50.5_PROD_geral_250605.apk
```

### **4. Configurar PayGo Integrado no Tablet**
1. Abrir "PayGo Integrado" no tablet
2. Clicar em "Parear Bluetooth"
3. Selecionar PPC930 na lista
4. Inserir senha de pareamento se solicitado
5. Configurar dispositivo

### **5. Instalar Ponto de Captura**
1. No PayGo Integrado: Iniciar operação administrativa
2. Selecionar "INSTALACAO"
3. Inserir senha técnica: `314159`
4. Indicar o ponto de captura
5. Inserir CNPJ do estabelecimento
6. Confirmar servidor e porta TCP
7. Aguardar impressão do comprovante

### **6. Compilar e Instalar Top Lavanderia**
No computador:
```cmd
# Instalar dependências
npm install

# Build do React
npm run build

# Build do Android
npx cap build android

# Instalar no tablet
npx cap run android
```

## 🔧 **Scripts Alternativos**

### **Script PowerShell (Recomendado)**
```powershell
# Verificar conexão
adb devices

# Instalar PayGo CERT
adb install paygo_files\PGIntegrado-v4.1.50.5_CERT_geral_250605.apk

# Instalar PayGo PROD
adb install paygo_files\PGIntegrado-v4.1.50.5_PROD_geral_250605.apk

# Verificar instalação
adb shell pm list packages | findstr paygo
```

### **Script Bash (Linux/Mac)**
```bash
#!/bin/bash
echo "Instalando PayGo no tablet..."

# Verificar conexão
adb devices

# Instalar PayGo CERT
adb install paygo_files/PGIntegrado-v4.1.50.5_CERT_geral_250605.apk

# Instalar PayGo PROD
adb install paygo_files/PGIntegrado-v4.1.50.5_PROD_geral_250605.apk

echo "Instalação concluída!"
```

## 🐛 **Solução de Problemas**

### **ADB não encontrado**
```cmd
# Instalar Android SDK
# Adicionar ao PATH: C:\Users\[USER]\AppData\Local\Android\Sdk\platform-tools
```

### **Dispositivo não detectado**
1. Verificar cabo USB
2. Verificar se depuração USB está ativada
3. Tentar outro cabo USB
4. Reiniciar tablet e computador

### **APK não instala**
```cmd
# Forçar instalação
adb install -r paygo_files\PGIntegrado-v4.1.50.5_CERT_geral_250605.apk

# Verificar logs
adb logcat | findstr "PackageManager"
```

### **PayGo não conecta**
1. Verificar se PPC930 está conectado
2. Verificar configurações de rede
3. Reiniciar PayGo Integrado
4. Verificar logs: `adb logcat | findstr "PayGo"`

## 📱 **Instalação Manual no Tablet**

Se não conseguir usar ADB, pode instalar manualmente:

1. **Transferir APKs para o tablet**
2. **No tablet:**
   - Ir para Configurações > Segurança
   - Ativar "Fontes desconhecidas"
   - Abrir gerenciador de arquivos
   - Localizar e instalar os APKs

## ✅ **Verificação Final**

Após instalação, verificar:
- [ ] PayGo Integrado abre normalmente
- [ ] PPC930 detectado e pareado
- [ ] Ponto de captura instalado
- [ ] Top Lavanderia compila e instala
- [ ] Testes de pagamento funcionando

## 📞 **Suporte**

Se ainda tiver problemas:
1. Verificar logs do Android
2. Documentar erros encontrados
3. Contactar equipe de desenvolvimento
