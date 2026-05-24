# APK Totem Top Lavanderia

Builds do totem nativo Android (`com.toplavanderia.app`) para Cielo Smart / DX8000.

## Cielo Lio Store — atualização (mesmo certificado do protótipo)

A Cielo **exige o mesmo certificado** da versão já publicada. O protótipo/certificação usou assinatura **debug** (`~/.android/debug.keystore`).

```powershell
cd android
.\gradlew assembleCieloRelease -PcieloSameCertAsPrototype=true
```

Saída: `android/app/build/outputs/apk/cieloRelease/app-cieloRelease.apk`

- Sem minify (evita crash no startup)
- Assinatura **V1 + V2** (targetSdk 35 — V2 obrigatório)
- Certificado **debug** = mesmo do APK homologado na maquininha

Envie: `releases/TopLavanderia-Totem-2.2.14-cieloStore.apk` (ou 2.2.13 se ainda não publicou)

### SHA-256 dos certificados (referência)

| Keystore | SHA-256 (início) | Uso |
|----------|------------------|-----|
| Debug (`androiddebugkey`) | `99:E6:CD:F0:...` | **Cielo Store** (protótipo já publicado) |
| Release (`toplavanderia-release.jks`) | `63:5A:ED:7E:...` | App novo / Play Store (não usar para update Cielo) |

## Desenvolvimento local (ADB na LIO)

```powershell
cd android
.\gradlew assembleRelease -PuseDebugSigning=true
adb install -r app\build\outputs\apk\release\app-release.apk
```

## Versões

| Arquivo | versionName | Uso |
|---------|-------------|-----|
| `TopLavanderia-Totem-2.2.14-cieloStore.apk` | 2.2.14 | **Fix detecção ESP online** (relógio Cielo + lista máquinas) |
| `TopLavanderia-Totem-2.2.13-cieloStore.apk` | 2.2.13 | Reenvio Cielo Store (cert debug + sem minify) |
| `TopLavanderia-Totem-2.2.12-cieloRelease.apk` | 2.2.12 | ❌ Assinatura release — rejeitado pela Cielo |
