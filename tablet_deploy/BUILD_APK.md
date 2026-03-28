# Como Compilar o APK - Top Lavanderia

## Pré-requisitos

- Android Studio instalado
- **Java JDK 17** (alinhado ao `compileOptions` do app)
- Android SDK (**compileSdk / targetSdk 35**; **minSdk 23** — Capacitor 7)
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

### 3. Capacitor no `build.gradle`

No repositório atual, `android/app/build.gradle` já inclui as dependências do Capacitor e `apply from: 'capacitor.build.gradle'`. Se estiver restaurando um backup antigo com essas linhas comentadas, descomente-as antes de compilar.

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

## Sincronizar código com a pasta `tablet_deploy`

- **Fonte da verdade para build:** `android/app/` (projeto Capacitor completo).
- A pasta `tablet_deploy/android-src/` é um **espelho** para backup e referência (inclui o mesmo `build.gradle` e as classes Java do pacote `app.lovable.toplavanderia`).
- Após alterar Java no Android Studio, atualize o espelho copiando de:
  ```
  android/app/src/main/java/app/lovable/toplavanderia/
  ```
  para `tablet_deploy/android-src/java/` (ou mantenha o espelho via script/controle de versão).

## Problemas Comuns

### Erro de classes duplicadas
Já está tratado no `build.gradle` com `packagingOptions` e `pickFirst`.

### Capacitor não encontrado
Rode `npx cap sync android` antes de compilar.

### InterfaceAutomacao não encontrada
Certifique-se que o arquivo `.aar` está em `android/app/libs/`.
