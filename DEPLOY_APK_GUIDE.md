# 📱 Guia Completo: Deploy APK Top Lavanderia PayGO

## 🎯 Pré-requisitos

### No Computador de Build
- ✅ Node.js 18+ instalado
- ✅ Android SDK configurado (variável `ANDROID_HOME`)
- ✅ Java JDK 17+ instalado
- ✅ Git instalado

### No Tablet Android
- ✅ Android 8.0+ (API Level 26+)
- ✅ Modo desenvolvedor ativado
- ✅ Depuração USB habilitada (para instalação via ADB)
- ✅ WiFi configurado e estável
- ✅ Porta USB funcional (para Pinpad PPC930)

### Arquivos Necessários
- ✅ `InterfaceAutomacao-v2.1.0.6.aar` (biblioteca PayGO)
- ✅ `my-release-key.keystore` (para build de produção)

---

## 📦 Etapa 1: Preparar Biblioteca PayGO

1. **Baixar o Kit PayGO v4.1.50.5** (já deve ter recebido do fornecedor)

2. **Copiar biblioteca para o projeto:**
```bash
# Criar pasta libs se não existir
mkdir -p android/app/libs

# Copiar arquivo .aar
cp /caminho/para/InterfaceAutomacao-v2.1.0.6.aar android/app/libs/
```

3. **Verificar se foi copiado:**
```bash
ls -lh android/app/libs/
# Deve mostrar: InterfaceAutomacao-v2.1.0.6.aar
```

---

## 🔨 Etapa 2: Build do APK

### Opção A: Build Automático (Recomendado)

```bash
# Dar permissão de execução ao script
chmod +x build_production_apk.sh

# Executar build
./build_production_apk.sh
```

O script irá:
- ✅ Instalar dependências
- ✅ Build do React
- ✅ Sync Capacitor
- ✅ Gerar APK (Debug ou Release)
- ✅ Assinar APK (se Release)
- ✅ Copiar para pasta `dist/`

### Opção B: Build Manual

#### Debug (para testes):
```bash
npm install
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

APK gerado em: `android/app/build/outputs/apk/debug/app-debug.apk`

#### Release (produção):
```bash
npm install
npm run build
npx cap sync android
cd android

# Build
./gradlew assembleRelease

# Assinar APK
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
  -keystore ../my-release-key.keystore \
  app/build/outputs/apk/release/app-release-unsigned.apk \
  toplavanderia

# Otimizar (zipalign)
zipalign -v 4 \
  app/build/outputs/apk/release/app-release-unsigned.apk \
  app/build/outputs/apk/release/app-release-signed.apk
```

APK gerado em: `android/app/build/outputs/apk/release/app-release-signed.apk`

---

## 📲 Etapa 3: Instalar no Tablet

### Via ADB (Cabo USB)

1. **Conectar tablet ao computador via USB**

2. **Verificar conexão:**
```bash
adb devices
# Deve mostrar: List of devices attached
#               XXXXXXXXXX      device
```

3. **Instalar APK:**
```bash
# Debug
adb install dist/toplavanderia-paygo-debug-YYYYMMDD.apk

# Ou Release
adb install dist/toplavanderia-paygo-release-YYYYMMDD.apk
```

4. **Verificar instalação:**
```bash
adb shell pm list packages | grep toplavanderia
# Deve mostrar: package:app.lovable.toplavanderia
```

### Via Transferência Direta

1. **Copiar APK para o tablet:**
   - USB: Copiar arquivo para pasta `Download/` do tablet
   - Email: Enviar APK por email e baixar no tablet
   - Cloud: Upload no Google Drive e baixar no tablet

2. **No tablet:**
   - Abrir gerenciador de arquivos
   - Navegar até pasta com APK
   - Tocar no arquivo APK
   - Permitir instalação de fontes desconhecidas (se solicitado)
   - Instalar

---

## ⚙️ Etapa 4: Configurar Tablet

### 4.1. Configurações do Sistema

```bash
# Ligar tela sempre ativa
adb shell settings put system screen_off_timeout 2147483647

# Desativar sons do sistema
adb shell settings put system notification_sound null
adb shell settings put system alarm_alert null

# Ajustar brilho
adb shell settings put system screen_brightness 200
```

### 4.2. Modo Kiosk (Launcher)

**Opção 1: Via ADB**
```bash
# Definir app como launcher padrão
adb shell pm disable-user --user 0 com.android.launcher3

# Iniciar app automaticamente
adb shell am start -n app.lovable.toplavanderia/.MainActivity
```

**Opção 2: Manual no Tablet**
1. Instalar app "Kiosk Browser" ou "Fully Kiosk Browser"
2. Configurar para iniciar `app.lovable.toplavanderia`
3. Habilitar "Iniciar no boot"
4. Desativar botões de navegação

### 4.3. Conectar Hardware

1. **WiFi:**
   - Conectar à rede WiFi da lavanderia
   - Configurar IP estático (recomendado):
     ```
     IP: 192.168.0.50
     Gateway: 192.168.0.1
     DNS: 8.8.8.8
     ```

2. **Pinpad PPC930:**
   - Conectar cabo USB do Pinpad ao tablet
   - Tablet deve mostrar notificação "Dispositivo USB conectado"
   - Abrir app e verificar em "Diagnóstico de Conexões"

3. **ESP32s:**
   - Garantir que ESP32s estão na mesma rede WiFi
   - Anotar IPs de cada ESP32
   - Configurar IPs no painel de administração

---

## 🔧 Etapa 5: Configuração Inicial do App

### 5.1. Primeiro Acesso (Modo Admin)

1. **Abrir app no tablet**

2. **Entrar no modo Admin:**
   - Clicar 10 vezes no logo
   - Inserir PIN de administrador

3. **Configurar Conexões:**

**PayGO/TEF:**
```
Host: 192.168.0.100 (IP do servidor PayGO)
Porta: 3000
Chave de Automação: [sua chave]
CNPJ: [seu CNPJ]
Timeout: 30000ms
```

**ESP32s:**
```
Lavadora 01:
  - ID: lavadora_01
  - IP: 192.168.0.101
  - Relé 1: Lavadora
  - Relé 2: Secadora

Lavadora 02:
  - ID: lavadora_02
  - IP: 192.168.0.102
  - Relé 1: Lavadora
  - Relé 2: Secadora
```

4. **Executar Diagnóstico:**
   - Abrir "Diagnóstico de Conexões"
   - Clicar "Executar Diagnóstico"
   - Verificar se todos os testes passam ✅

---

## 🧪 Etapa 6: Testes de Validação

### Teste 1: Pagamento → Ativação

1. **Modo Totem:**
   - Selecionar máquina
   - Inserir valor (ex: R$ 10,00)
   - Processar pagamento no Pinpad
   - **Verificar:**
     - ✅ Pagamento aprovado
     - ✅ Máquina ativou fisicamente
     - ✅ Timer iniciou no app
     - ✅ Status mudou para "Em uso"

### Teste 2: ESP32 Offline

1. **Desligar um ESP32**
2. **Tentar iniciar máquina**
3. **Verificar:**
   - ⚠️ Mensagem "ESP32 offline - comando na fila"
   - ✅ Transação criada
   - ✅ Comando salvo em `pending_commands`

4. **Religiar ESP32**
5. **Verificar:**
   - ✅ Máquina ativa automaticamente (retry)
   - ✅ Comando removido da fila

### Teste 3: Pinpad Desconectado

1. **Desconectar Pinpad USB**
2. **Tentar pagamento**
3. **Verificar:**
   - ⚠️ Mensagem "Pinpad não detectado"
   - ❌ Não permite continuar

4. **Reconectar Pinpad**
5. **Verificar:**
   - ✅ Notificação "Pinpad conectado"
   - ✅ Pagamento funciona normalmente

### Teste 4: Múltiplos Pagamentos

1. **Iniciar 2 máquinas simultaneamente**
2. **Processar 2 pagamentos em paralelo**
3. **Verificar:**
   - ✅ Ambas as máquinas ativam
   - ✅ Transações separadas
   - ✅ Timers independentes

---

## 📊 Etapa 7: Monitoramento

### Logs em Tempo Real

**Via ADB:**
```bash
# Logs do Android
adb logcat -s "TotemActivity:I" "PayGOPlugin:I" "Capacitor:I"

# Logs do app
adb logcat | grep "toplavanderia"
```

**No Tablet:**
- Abrir "Modo Admin" → "Logs do Sistema"
- Filtrar por: `paygo`, `esp32`, `payment`

### Verificar Status no Banco de Dados

**Transações:**
```sql
SELECT 
  id, 
  machine_id, 
  payment_method, 
  status, 
  total_amount, 
  created_at 
FROM transactions 
ORDER BY created_at DESC 
LIMIT 10;
```

**Comandos Pendentes:**
```sql
SELECT 
  esp32_id, 
  relay_pin, 
  action, 
  status, 
  retry_count, 
  created_at 
FROM pending_commands 
WHERE status = 'pending';
```

**Status ESP32:**
```sql
SELECT 
  esp32_id, 
  is_online, 
  last_heartbeat, 
  ip_address 
FROM esp32_status;
```

---

## 🔒 Etapa 8: Segurança e Backup

### Backup do Keystore

```bash
# Copiar keystore para local seguro
cp my-release-key.keystore ~/Backups/toplavanderia-keystore-$(date +%Y%m%d).keystore

# Criar backup criptografado
gpg -c ~/Backups/toplavanderia-keystore-YYYYMMDD.keystore
```

⚠️ **NUNCA** committar o keystore no Git!

### Backup do Banco de Dados

```bash
# Exportar via Supabase CLI
supabase db dump -f backup_$(date +%Y%m%d).sql

# Ou via painel Supabase
# Database → Backups → Download
```

---

## 🚨 Troubleshooting

### Problema: APK não instala

**Erro: INSTALL_FAILED_UPDATE_INCOMPATIBLE**
```bash
# Desinstalar versão antiga
adb uninstall app.lovable.toplavanderia

# Reinstalar
adb install dist/app.apk
```

### Problema: Pinpad não detectado

1. **Verificar cabo USB**
2. **Verificar permissões USB:**
```bash
adb shell pm grant app.lovable.toplavanderia android.permission.USB_PERMISSION
```

3. **Ver logs:**
```bash
adb logcat | grep USB
```

### Problema: ESP32 sempre offline

1. **Ping do tablet:**
```bash
adb shell ping -c 5 192.168.0.101
```

2. **Verificar firewall/rede**

3. **Verificar IP no banco:**
```sql
SELECT esp32_id, ip_address, last_heartbeat FROM esp32_status;
```

### Problema: PayGO não responde

1. **Verificar serviço PayGO:**
```bash
# No servidor PayGO
ps aux | grep paygo
netstat -tuln | grep 3000
```

2. **Testar conexão:**
```bash
curl http://192.168.0.100:3000/status
```

---

## 📞 Suporte

Para problemas não resolvidos:

1. **Logs:** Coletar logs via `adb logcat > logs.txt`
2. **Screenshots:** Tirar prints dos erros
3. **Contato:** Enviar para suporte técnico

---

## ✅ Checklist Final

Antes de liberar para produção:

- [ ] APK release assinado gerado
- [ ] APK instalado no tablet
- [ ] Biblioteca PayGO presente
- [ ] Pinpad PPC930 conectado e detectado
- [ ] ESP32s conectados e respondendo
- [ ] WiFi estável configurado
- [ ] Modo Kiosk ativado
- [ ] Testes de pagamento aprovados
- [ ] Testes de ESP32 offline aprovados
- [ ] Backup do keystore feito
- [ ] Backup do banco feito
- [ ] Monitoramento configurado
- [ ] Equipe treinada

🎉 **Sistema pronto para produção!**
