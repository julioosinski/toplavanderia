# 🚀 GUIA COMPLETO - BUILD APK TOTEM

## ✅ RESUMO DAS IMPLEMENTAÇÕES

### Arquitetura Escolhida: **TOTEM 100% NATIVO**

A arquitetura nativa foi implementada com:
- ✅ `TotemActivity` como launcher principal
- ✅ Modo kiosk ativado (HOME + DEFAULT)
- ✅ Orientação landscape forçada
- ✅ Tela sempre ligada (`keepScreenOn`)
- ✅ Integração PayGO Real com PPC930
- ✅ Conexão Supabase com filtro de lavanderia
- ✅ Detecção automática USB do PPC930

---

## 📋 PRÉ-REQUISITOS

### 1. Ambiente de Desenvolvimento

```bash
# Java JDK 11 ou superior
java -version

# Android SDK
# Instalar via Android Studio ou SDK Tools

# Gradle 8.1.4 (incluído no projeto)
cd android
./gradlew --version

# ADB (Android Debug Bridge)
adb version
```

### 2. PayGO Integrado CERT

**Arquivo:** `tablet_package/paygo_files/PGIntegrado-v4.1.50.5_CERT_geral_250605.zip`

**Instalação:**
```bash
adb install tablet_package/paygo_files/PGIntegrado-v4.1.50.5_CERT_geral_250605.zip
```

**Configuração do PayGO:**
1. Abrir PayGO Integrado no tablet
2. Conectar PPC930 via USB
3. Parear dispositivo
4. Configurar ponto de captura
5. Testar transação de R$ 0,01

---

## 🔧 CONFIGURAÇÃO DA LAVANDERIA

### Opção 1: Hardcoded (Recomendado para Produção Única)

**Arquivo:** `android/app/src/main/java/app/lovable/toplavanderia/SupabaseHelper.java`

```java
// Linha 30
private static final String DEFAULT_LAUNDRY_ID = "567a7bb6-8d26-4d9c-bbe3-f8dcc28e7569";
```

**Alterar para o ID da sua lavanderia:**
```sql
-- Consultar no Supabase
SELECT id, name FROM laundries WHERE is_active = true;
```

### Opção 2: SharedPreferences (Recomendado para Múltiplos Tablets)

**Configurar via ADB após instalação:**
```bash
# Configurar ID da lavanderia
adb shell am broadcast \
  -a com.toplavanderia.app.SET_LAUNDRY \
  --es laundry_id "567a7bb6-8d26-4d9c-bbe3-f8dcc28e7569"
```

**Verificar configuração:**
```bash
adb shell run-as com.toplavanderia.app \
  cat shared_prefs/totem_config.xml
```

---

## 🏗️ BUILD DO APK

### Passo 1: Limpar Build Anterior

```bash
cd android
./gradlew clean
```

### Passo 2: Build Debug (Para Testes)

```bash
./gradlew assembleDebug
```

**APK gerado em:**
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### Passo 3: Build Release (Para Produção)

```bash
./gradlew assembleRelease
```

**APK gerado em:**
```
android/app/build/outputs/apk/release/app-release-unsigned.apk
```

### Passo 4: Assinar APK (Opcional)

**Criar keystore:**
```bash
keytool -genkey -v \
  -keystore toplavanderia.keystore \
  -alias toplavanderia \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

**Configurar em `android/app/build.gradle`:**
```gradle
android {
    signingConfigs {
        release {
            storeFile file('toplavanderia.keystore')
            storePassword 'sua_senha_forte'
            keyAlias 'toplavanderia'
            keyPassword 'sua_senha_forte'
        }
    }
    
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

**Build assinado:**
```bash
./gradlew assembleRelease
```

---

## 📱 INSTALAÇÃO NO TABLET

### 1. Conectar Tablet via USB

```bash
# Ativar modo desenvolvedor no tablet:
# Configurações > Sobre o tablet > Tocar 7x em "Número da compilação"

# Ativar depuração USB:
# Configurações > Sistema > Opções do desenvolvedor > Depuração USB

# Verificar conexão
adb devices
```

### 2. Instalar PayGO Integrado CERT

```bash
cd tablet_package
adb install paygo_files/PGIntegrado-v4.1.50.5_CERT_geral_250605.zip
```

**Configurar PayGO:**
1. Abrir PayGO Integrado
2. Conectar PPC930 via USB
3. Parear dispositivo
4. Configurar ponto de captura

### 3. Instalar Top Lavanderia APK

```bash
cd ../android
adb install app/build/outputs/apk/release/app-release.apk
```

**Ou para atualizar:**
```bash
adb install -r app/build/outputs/apk/release/app-release.apk
```

### 4. Configurar Modo Kiosk

**Opção A: Launcher Nativo (Android 9+)**
```bash
adb shell pm enable com.android.launcher3
adb shell cmd package set-home-activity com.toplavanderia.app/.TotemActivity
```

**Opção B: Kiosk Browser (Recomendado)**
1. Instalar "Kiosk Browser Lockdown" da Play Store
2. Definir Top Lavanderia como app padrão
3. Desabilitar botões de navegação
4. Proteger com PIN

### 5. Configurar WiFi

```bash
# Conectar à rede WiFi da lavanderia
# Configurações > WiFi > Conectar

# Recomendado: IP fixo
# Configurações > WiFi > Rede conectada > Avançado > IP fixo
```

---

## ✅ CHECKLIST DE TESTES

### 1. Testes Iniciais

- [ ] App abre automaticamente ao ligar tablet
- [ ] Tela em orientação paisagem (landscape)
- [ ] Tela permanece sempre ligada
- [ ] WiFi conectado e estável
- [ ] Supabase acessível (ícone de status verde)

### 2. Testes de Máquinas

- [ ] Máquinas carregadas do Supabase
- [ ] Apenas máquinas da lavanderia configurada
- [ ] Status correto (online/offline baseado em ESP32)
- [ ] Máquinas disponíveis (verde) clicáveis
- [ ] Máquinas ocupadas (vermelho) não clicáveis
- [ ] Máquinas offline (cinza) não clicáveis

### 3. Testes de PayGO/PPC930

- [ ] PPC930 detectado via USB
- [ ] PayGO Integrado instalado e configurado
- [ ] Teste de transação R$ 0,01 aprovado
- [ ] Código de autorização retornado
- [ ] Comprovante gerado (opcional)

### 4. Testes de Pagamento Real

**Teste 1: Pagamento Aprovado**
```
1. Selecionar máquina disponível (verde)
2. Confirmar valor (ex: R$ 15,00)
3. Inserir cartão de crédito no PPC930
4. Digitar senha
5. Aguardar aprovação
6. Verificar mensagem de sucesso
7. Verificar máquina mudou para "OCUPADA" (vermelho)
8. Verificar transação salva no Supabase
```

**Teste 2: Pagamento Recusado**
```
1. Usar cartão sem saldo
2. Verificar mensagem de erro clara
3. Verificar volta para seleção de máquina
4. Verificar transação NÃO foi salva
5. Verificar máquina permanece "LIVRE" (verde)
```

**Teste 3: Cancelamento**
```
1. Iniciar transação
2. Cancelar no PPC930 (tecla vermelha)
3. Verificar volta para seleção
4. Verificar máquina permanece "LIVRE"
```

### 5. Testes de Integração Supabase

**Verificar transação salva:**
```sql
SELECT 
  t.id,
  t.machine_id,
  m.name as machine_name,
  t.total_amount,
  t.payment_method,
  t.status,
  t.created_at
FROM transactions t
LEFT JOIN machines m ON t.machine_id = m.id
WHERE t.laundry_id = '567a7bb6-8d26-4d9c-bbe3-f8dcc28e7569'
ORDER BY t.created_at DESC
LIMIT 10;
```

**Verificar status da máquina:**
```sql
SELECT 
  m.name,
  m.status,
  m.esp32_id,
  e.is_online as esp32_online
FROM machines m
LEFT JOIN esp32_status e ON m.esp32_id = e.esp32_id
WHERE m.laundry_id = '567a7bb6-8d26-4d9c-bbe3-f8dcc28e7569';
```

---

## 🔍 DEBUG E TROUBLESHOOTING

### Ver Logs do App

```bash
# Logs em tempo real
adb logcat | grep -E "TotemActivity|RealPayGoManager|SupabaseHelper"

# Salvar logs em arquivo
adb logcat > totem_logs.txt

# Ver apenas erros
adb logcat *:E
```

### Logs Importantes

**Inicialização:**
```
TotemActivity: === TOTEM INICIADO ===
SupabaseHelper: === CONFIGURAÇÃO DO TOTEM ===
SupabaseHelper: Laundry ID: 567a7bb6-...
RealPayGoManager: === INICIALIZANDO PAYGO REAL ===
RealPayGoManager: ✅ PayGo API inicializada com sucesso
```

**Carregamento de Máquinas:**
```
SupabaseHelper: Buscando máquinas da lavanderia: 567a7bb6-...
SupabaseHelper: Máquinas carregadas do Supabase: 6
SupabaseHelper: === CARREGANDO STATUS DOS ESP32s ===
```

**Pagamento:**
```
RealPayGoManager: === INICIANDO PAGAMENTO REAL COM PPC930 ===
RealPayGoManager: Valor: R$ 15.0
RealPayGoManager: === EXECUTANDO TRANSAÇÃO REAL COM PPC930 ===
RealPayGoManager: === TRANSAÇÃO APROVADA PELA PPC930 ===
RealPayGoManager: === PAGAMENTO REAL CONCLUÍDO ===
```

### Problemas Comuns

#### 1. PayGO não inicializado

**Erro:**
```
RealPayGoManager: ❌ Erro ao inicializar PayGo API
```

**Solução:**
```bash
# Verificar se PayGO Integrado está instalado
adb shell pm list packages | grep paygo

# Reinstalar se necessário
adb install -r PGIntegrado-v4.1.50.5_CERT_geral_250605.zip
```

#### 2. PPC930 não detectado

**Erro:**
```
USB_DEVICE_ATTACHED not received
```

**Solução:**
1. Verificar cabo USB está conectado
2. Verificar tablet reconhece USB:
   ```bash
   adb shell ls /dev/bus/usb
   ```
3. Verificar `device_filter.xml` tem IDs corretos
4. Reiniciar tablet

#### 3. Máquinas não carregam

**Erro:**
```
SupabaseHelper: Erro ao buscar máquinas do Supabase: 401
```

**Solução:**
1. Verificar WiFi conectado
2. Verificar URL Supabase correta
3. Verificar ANON_KEY válida
4. Verificar `laundry_id` existe na tabela `laundries`

#### 4. Transação não salva

**Erro:**
```
SupabaseHelper: Erro ao criar transação no Supabase: 403
```

**Solução:**
Verificar RLS policies na tabela `transactions`:
```sql
-- Deve ter policy para INSERT sem autenticação
-- ou com autenticação de dispositivo
```

---

## 📦 DISTRIBUIÇÃO

### Arquivo APK Final

**Nome:** `TopLavanderia-Totem-v2.0.0.apk`

**Tamanho:** ~15-20 MB

**Inclui:**
- ✅ Integração PayGO Real
- ✅ Biblioteca InterfaceAutomacao
- ✅ Configuração Supabase
- ✅ Modo Kiosk
- ✅ Detecção USB PPC930

### Transferir para Múltiplos Tablets

```bash
# Via ADB WiFi (após primeira instalação USB)
adb tcpip 5555
adb connect 192.168.1.100:5555
adb install -r TopLavanderia-Totem-v2.0.0.apk

# Configurar laundry_id específico
adb shell am broadcast \
  -a com.toplavanderia.app.SET_LAUNDRY \
  --es laundry_id "LAUNDRY_ID_AQUI"
```

### Pacote Completo para Cliente

```
tablet_package/
├── TopLavanderia-Totem-v2.0.0.apk
├── PGIntegrado-v4.1.50.5_CERT_geral_250605.zip
├── MANUAL_INSTALACAO.pdf
├── MANUAL_CONFIGURACAO_PAYGO.pdf
└── TROUBLESHOOTING.pdf
```

---

## 🎯 PRÓXIMOS PASSOS

### Melhorias Futuras

1. **Configuração Remota**
   - Tela oculta de configuração (7 toques no logo)
   - Configurar `laundry_id` sem rebuild
   - Testar PayGO
   - Testar conexão Supabase

2. **Atualização OTA**
   - Verificar versão no Supabase
   - Download automático de APK atualizado
   - Instalação silenciosa (requer root ou MDM)

3. **Monitoramento**
   - Heartbeat a cada 5 minutos
   - Status do tablet (online/offline)
   - Alertas de problemas

4. **Analytics**
   - Tempo médio de transação
   - Taxa de sucesso de pagamentos
   - Horários de pico

---

## 📞 SUPORTE

### Logs do Totem

```bash
# Exportar logs para análise
adb logcat -d > totem_logs_$(date +%Y%m%d_%H%M%S).txt
```

### Dados do Sistema

```bash
# Informações do dispositivo
adb shell getprop | grep -E "model|version|fingerprint"

# Status do app
adb shell dumpsys package com.toplavanderia.app
```

### Contato

- 📧 Email: suporte@toplavanderia.com
- 📱 WhatsApp: (11) 99999-9999
- 🌐 Portal: https://admin.toplavanderia.com

---

## ✅ VERSÃO

**Versão APK:** 2.0.0  
**Data:** 2025-01-23  
**Autor:** Lovable AI + Top Lavanderia Team  
**Arquitetura:** Nativo Android + PayGO Real  
**Status:** ✅ Pronto para Produção
