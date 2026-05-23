# APK Totem Top Lavanderia

Builds do totem nativo Android (`com.toplavanderia.app`) para Cielo Smart / DX8000.

## Cielo Lio Store (produção) — use este

```powershell
cd android
.\gradlew assembleCieloRelease
```

Saída: `android/app/build/outputs/apk/cieloRelease/app-cieloRelease.apk`

Copie para `releases/TopLavanderia-Totem-2.2.12-cieloRelease.apk` e **envie este arquivo** à Cielo (assinatura `toplavanderia-release.jks`).

Teste antes de enviar:

```powershell
adb uninstall com.toplavanderia.app
adb install -r releases/TopLavanderia-Totem-2.2.12-cieloRelease.apk
```

Na primeira abertura, configure o **CNPJ** da lavanderia.

## Desenvolvimento local (mesma assinatura debug da LIO)

```powershell
cd android
.\gradlew assembleRelease -PuseDebugSigning=true
adb install -r app\build\outputs\apk\release\app-release.apk
```

## Versões

| Arquivo | versionName | Uso |
|---------|-------------|-----|
| `TopLavanderia-Totem-2.2.12-cieloRelease.apk` | 2.2.12 | **Cielo Store** — sem PayGo no boot, sem minify |
| `TopLavanderia-Totem-2.2.11.apk` | 2.2.11 | Testes ADB debug-sign |
