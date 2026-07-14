# APK Totem Top Lavanderia

Builds do totem nativo Android (`com.toplavanderia.app`) para Cielo Smart / DX8000.

## Cielo Lio Store â€” atualizaÃ§Ã£o (mesmo certificado do protÃ³tipo)

A Cielo **exige o mesmo certificado** da versÃ£o jÃ¡ publicada. O protÃ³tipo/certificaÃ§Ã£o usou assinatura **debug** (`~/.android/debug.keystore`).

```powershell
cd android
.\gradlew assembleCieloRelease -PcieloSameCertAsPrototype=true
```

SaÃ­da: `android/app/build/outputs/apk/cieloRelease/app-cieloRelease.apk`

- Sem minify (evita crash no startup)
- Assinatura **V1 + V2** (targetSdk 35 â€” V2 obrigatÃ³rio)
- Certificado **debug** = mesmo do APK homologado na maquininha

Envie: `releases/TopLavanderia-Totem-2.2.105.apk` (OFF bloqueado em poltrona; firmware 1.1.3)

### SHA-256 dos certificados (referÃªncia)

| Keystore | SHA-256 (inÃ­cio) | Uso |
|----------|------------------|-----|
| Debug (`androiddebugkey`) | `99:E6:CD:F0:...` | **Cielo Store** (protÃ³tipo jÃ¡ publicado) |
| Release (`toplavanderia-release.jks`) | `63:5A:ED:7E:...` | App novo / Play Store (nÃ£o usar para update Cielo) |

## Desenvolvimento local (ADB na LIO)

```powershell
cd android
.\gradlew assembleRelease -PuseDebugSigning=true
adb install -r app\build\outputs\apk\release\app-release.apk
```

## VersÃµes

| Arquivo | versionName | Uso |
|---------|-------------|-----|
| `TopLavanderia-Totem-2.2.105.apk` | 2.2.105 | **Atual** — bloqueia OFF automatico da poltrona (servidor+APK)
| `TopLavanderia-Totem-2.2.104.apk` | 2.2.104 | tarja presa + harden OFF MASSAGEM |
| `TopLavanderia-Totem-2.2.103.apk` | 2.2.103 | fix tarja presa na home (overlay bloqueava toques) |
| `TopLavanderia-Totem-2.2.102.apk` | 2.2.102 | poltrona sem OFF antecipado do Android; paginaÃ§Ã£o MÃ¡quinas estÃ¡vel |
| `TopLavanderia-Totem-2.2.101.apk` | 2.2.101 | fix crÃ©dito cafÃ©: enqueue antes de concluir TX; estorno se falhar |
| `TopLavanderia-Totem-2.2.100.apk` | 2.2.100 | tarja tambÃ©m no dÃ©bito; bypass de troco (Confirmar); PIX toca "NÃ£o imprimir" na tela de confirmaÃ§Ã£o |
| `TopLavanderia-Totem-2.2.99.apk` | 2.2.99 | dÃ©bito sem tarja + Confirmar na tela troco; PIX toca "NÃ£o imprimir" (coordenadas L400) |
| `TopLavanderia-Totem-2.2.98.apk` | 2.2.98 | remove tarja antes de Confirmar na tela de troco |
| `TopLavanderia-Totem-2.2.97.apk` | 2.2.97 | fecha pedido Cielo tambÃ©m no sucesso via broadcast (PIX), evitando "pedido anterior aberto" (-4281) |
| `TopLavanderia-Totem-2.2.96.apk` | 2.2.96 | confirmaÃ§Ã£o ESP32 robusta (relÃ© OU status running); troco L400 com toque por coordenada; "NÃ£o imprimir" cobre PIX |
| `TopLavanderia-Totem-2.2.95.apk` | 2.2.95 | confirma relÃ© ESP32 antes de OCUPADA; estorno Cielo automÃ¡tico se falhar |
| `TopLavanderia-Totem-2.2.94.apk` | 2.2.94 | PIX: sem cancelar por idle 60s, OCUPADA otimista pÃ³s-pagamento |
| `TopLavanderia-Totem-2.2.93.apk` | 2.2.93 | dÃ©bito/crÃ©dito sem tela de troco na L400 |
| `TopLavanderia-Totem-2.2.92.apk` | 2.2.92 | tarja fixa 10s na L400 (sem piscar), deep link sem orderId |
| `TopLavanderia-Totem-2.2.89.apk` | 2.2.89 | tela azul sem flash HOME, tarja 10s, toque "NÃ£o imprimir" sÃ³ apÃ³s aprovaÃ§Ã£o, broadcast Cielo |
| `TopLavanderia-Totem-2.2.33.apk` | 2.2.33 | HomologaÃ§Ã£o Cielo â€” volta Ã  grade pÃ³s-pagamento, mÃ¡quina OCUPADA, credenciais via edge function |
| `TopLavanderia-Totem-2.2.32-cieloStore.apk` | 2.2.32 | Fix corrida ESP32 / status OCUPADA apÃ³s pagamento |
| `TopLavanderia-Totem-2.2.31-cieloStore.apk` | 2.2.31 | Fluxo pagamento direto (crÃ©dito/dÃ©bito/PIX), sem telas extras |
| `TopLavanderia-Totem-2.2.30-cieloStore.apk` | 2.2.30 | Credenciais Cielo via totem-settings edge function |
| `TopLavanderia-Totem-2.2.29-cieloStore.apk` | 2.2.29 | Primeira build com edge function de credenciais |
| `TopLavanderia-Totem-2.2.28-cieloStore.apk` | 2.2.28 | Fix -4281, janitor pedidos, UX pÃ³s-pagamento |
| `TopLavanderia-Totem-2.2.16-cieloStore.apk` | 2.2.16 | **Fix crash L400** (modo imersivo antes de setContentView) |
| `TopLavanderia-Totem-2.2.15-cieloStore.apk` | 2.2.15 | Fix relÃ³gio Cielo (~27h skew) + detecÃ§Ã£o ESP online |
| `TopLavanderia-Totem-2.2.14-cieloStore.apk` | 2.2.14 | Fix detecÃ§Ã£o ESP online (relÃ³gio Cielo + lista mÃ¡quinas) |
| `TopLavanderia-Totem-2.2.13-cieloStore.apk` | 2.2.13 | Reenvio Cielo Store (cert debug + sem minify) |
| `TopLavanderia-Totem-2.2.12-cieloRelease.apk` | 2.2.12 | âŒ Assinatura release â€” rejeitado pela Cielo |

