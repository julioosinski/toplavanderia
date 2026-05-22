# APK Totem Top Lavanderia

Builds oficiais do totem nativo Android (`com.toplavanderia.app`) para Cielo Smart / DX8000.

## Instalação (maquininha Cielo)

Assinatura debug (compatível com LIO já instalada):

```powershell
adb install -r releases/TopLavanderia-Totem-2.2.11.apk
```

Build local:

```powershell
cd android
.\gradlew assembleRelease -PuseDebugSigning=true
```

Saída: `android/app/build/outputs/apk/release/app-release.apk`

## Versões

| Arquivo | versionName | Notas |
|---------|-------------|--------|
| `TopLavanderia-Totem-2.2.11.apk` | 2.2.11 | PIX payload Cielo, scroll admin, PIN admin fix, relatórios |
