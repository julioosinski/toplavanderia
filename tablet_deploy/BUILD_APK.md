# Como Compilar o APK - Top Lavanderia

## Pré-requisitos

- Android Studio instalado
- Java JDK 8+
- Android SDK (API 22+ e 34)
- Node.js 18+

## Passo a Passo

### 1. Build do React (frontend)

```bash
# Na raiz do projeto
npm install
npm run build
```

Isso gera a pasta `dist/` com o app React compilado.

### 2. Sincronizar com Capacitor

```bash
npx cap sync android
```

Isso copia o `dist/` para `android/app/src/main/assets/public/`.

### 3. IMPORTANTE: Descomentar dependências do Capacitor

Abra `android/app/build.gradle` e **descomente** as linhas do Capacitor:

```gradle
// ANTES (comentado):
// implementation project(':capacitor-android')
// implementation project(':capacitor-app')
// implementation project(':capacitor-device')
// implementation project(':capacitor-splash-screen')
// implementation project(':capacitor-status-bar')

// DEPOIS (descomentado):
implementation project(':capacitor-android')
implementation project(':capacitor-app')
implementation project(':capacitor-device')
implementation project(':capacitor-splash-screen')
implementation project(':capacitor-status-bar')
```

Também descomente a última linha:
```gradle
// ANTES:
// apply from: 'capacitor.build.gradle'

// DEPOIS:
apply from: 'capacitor.build.gradle'
```

### 4. Compilar o APK

```bash
cd android
./gradlew assembleRelease
```

O APK será gerado em:
```
android/app/build/outputs/apk/release/app-release.apk
```

### 5. Instalar no tablet

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

## Substituindo Arquivos Java

Se precisar atualizar os arquivos Java no projeto Android, copie de `android-src/java/` para:
```
android/app/src/main/java/app/lovable/toplavanderia/
```

## Problemas Comuns

### Erro de classes duplicadas
Já está tratado no `build.gradle` com `packagingOptions` e `pickFirst`.

### Capacitor não encontrado
Rode `npx cap sync android` antes de compilar.

### InterfaceAutomacao não encontrada
Certifique-se que o arquivo `.aar` está em `android/app/libs/`.
