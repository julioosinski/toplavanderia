# ⚡ QUICK START - BUILD APK TOTEM

## 🎯 CONFIGURAÇÃO RÁPIDA (5 MINUTOS)

### 1️⃣ Configurar ID da Lavanderia

**Antes de fazer o build**, abra o arquivo:

```
android/app/src/main/java/app/lovable/toplavanderia/SupabaseHelper.java
```

**Edite a linha 30:**

```java
// ANTES:
private static final String DEFAULT_LAUNDRY_ID = "567a7bb6-8d26-4d9c-bbe3-f8dcc28e7569";

// DEPOIS (use o ID da sua lavanderia):
private static final String DEFAULT_LAUNDRY_ID = "SEU_LAUNDRY_ID_AQUI";
```

**Como obter o ID da lavanderia:**

```sql
-- Execute no Supabase SQL Editor
SELECT id, name, cnpj FROM laundries WHERE is_active = true;
```

Copie o `id` da lavanderia desejada.

---

### 2️⃣ Build do APK

```bash
# Navegar para pasta android
cd android

# Limpar build anterior
./gradlew clean

# Gerar APK de Release
./gradlew assembleRelease
```

**APK gerado em:**
```
android/app/build/outputs/apk/release/app-release.apk
```

---

### 3️⃣ Instalar no Tablet

**Pré-requisito:** PayGO Integrado CERT instalado

```bash
# Instalar PayGO (apenas primeira vez)
adb install tablet_package/paygo_files/PGIntegrado-v4.1.50.5_CERT_geral_250605.zip

# Instalar Top Lavanderia
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

---

### 4️⃣ Configurar PayGO no Tablet

1. Abrir **PayGO Integrado**
2. Conectar **PPC930** via USB
3. **Parear** dispositivo
4. Configurar **ponto de captura**
5. Testar transação de **R$ 0,01**

---

### 5️⃣ Testar Totem

1. Abrir **Top Lavanderia** no tablet
2. Verificar máquinas carregadas
3. Selecionar máquina disponível (verde)
4. Fazer transação teste
5. Verificar pagamento aprovado
6. Verificar máquina mudou para ocupada

---

## 🔧 COMANDOS ÚTEIS

### Ver Logs em Tempo Real

```bash
adb logcat | grep -E "TotemActivity|RealPayGoManager|SupabaseHelper"
```

### Verificar Status do App

```bash
adb shell dumpsys package com.toplavanderia.app | grep -E "versionCode|versionName"
```

### Desinstalar e Reinstalar

```bash
adb uninstall com.toplavanderia.app
adb install android/app/build/outputs/apk/release/app-release.apk
```

---

## ✅ CHECKLIST MÍNIMO

- [ ] ID da lavanderia configurado em `SupabaseHelper.java`
- [ ] APK buildado com sucesso
- [ ] PayGO Integrado CERT instalado no tablet
- [ ] PPC930 conectado e pareado
- [ ] Top Lavanderia instalado no tablet
- [ ] Máquinas carregando corretamente
- [ ] Pagamento teste aprovado

---

## 🆘 PROBLEMAS COMUNS

### Máquinas não aparecem

**Causa:** `laundry_id` incorreto ou WiFi desconectado

**Solução:**
1. Verificar `laundry_id` em `SupabaseHelper.java`
2. Verificar tablet conectado ao WiFi
3. Rebuild APK e reinstalar

### PayGO não funciona

**Causa:** PayGO Integrado não instalado ou PPC930 não pareado

**Solução:**
1. Instalar PayGO Integrado CERT
2. Abrir PayGO e parear PPC930
3. Testar transação de R$ 0,01

### App não abre automaticamente

**Causa:** Modo kiosk não configurado

**Solução:**
```bash
adb shell cmd package set-home-activity com.toplavanderia.app/.TotemActivity
```

---

## 📚 DOCUMENTAÇÃO COMPLETA

Ver **README_BUILD_APK.md** para guia detalhado.

---

## 🎉 PRONTO!

Seu totem está configurado e pronto para uso!
