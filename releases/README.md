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

Envie: `releases/TopLavanderia-Totem-2.2.101.apk` (crédito café enfileirado antes de concluir TX)

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
| `TopLavanderia-Totem-2.2.101.apk` | 2.2.101 | **Atual** — fix crédito café: enqueue antes de concluir TX; estorno se falhar |
| `TopLavanderia-Totem-2.2.100.apk` | 2.2.100 | tarja também no débito; bypass de troco (Confirmar); PIX toca "Não imprimir" na tela de confirmação |
| `TopLavanderia-Totem-2.2.99.apk` | 2.2.99 | débito sem tarja + Confirmar na tela troco; PIX toca "Não imprimir" (coordenadas L400) |
| `TopLavanderia-Totem-2.2.98.apk` | 2.2.98 | remove tarja antes de Confirmar na tela de troco |
| `TopLavanderia-Totem-2.2.97.apk` | 2.2.97 | fecha pedido Cielo também no sucesso via broadcast (PIX), evitando "pedido anterior aberto" (-4281) |
| `TopLavanderia-Totem-2.2.96.apk` | 2.2.96 | confirmação ESP32 robusta (relé OU status running); troco L400 com toque por coordenada; "Não imprimir" cobre PIX |
| `TopLavanderia-Totem-2.2.95.apk` | 2.2.95 | confirma relé ESP32 antes de OCUPADA; estorno Cielo automático se falhar |
| `TopLavanderia-Totem-2.2.94.apk` | 2.2.94 | PIX: sem cancelar por idle 60s, OCUPADA otimista pós-pagamento |
| `TopLavanderia-Totem-2.2.93.apk` | 2.2.93 | débito/crédito sem tela de troco na L400 |
| `TopLavanderia-Totem-2.2.92.apk` | 2.2.92 | tarja fixa 10s na L400 (sem piscar), deep link sem orderId |
| `TopLavanderia-Totem-2.2.89.apk` | 2.2.89 | tela azul sem flash HOME, tarja 10s, toque "Não imprimir" só após aprovação, broadcast Cielo |
| `TopLavanderia-Totem-2.2.33.apk` | 2.2.33 | Homologação Cielo — volta à grade pós-pagamento, máquina OCUPADA, credenciais via edge function |
| `TopLavanderia-Totem-2.2.32-cieloStore.apk` | 2.2.32 | Fix corrida ESP32 / status OCUPADA após pagamento |
| `TopLavanderia-Totem-2.2.31-cieloStore.apk` | 2.2.31 | Fluxo pagamento direto (crédito/débito/PIX), sem telas extras |
| `TopLavanderia-Totem-2.2.30-cieloStore.apk` | 2.2.30 | Credenciais Cielo via totem-settings edge function |
| `TopLavanderia-Totem-2.2.29-cieloStore.apk` | 2.2.29 | Primeira build com edge function de credenciais |
| `TopLavanderia-Totem-2.2.28-cieloStore.apk` | 2.2.28 | Fix -4281, janitor pedidos, UX pós-pagamento |
| `TopLavanderia-Totem-2.2.16-cieloStore.apk` | 2.2.16 | **Fix crash L400** (modo imersivo antes de setContentView) |
| `TopLavanderia-Totem-2.2.15-cieloStore.apk` | 2.2.15 | Fix relógio Cielo (~27h skew) + detecção ESP online |
| `TopLavanderia-Totem-2.2.14-cieloStore.apk` | 2.2.14 | Fix detecção ESP online (relógio Cielo + lista máquinas) |
| `TopLavanderia-Totem-2.2.13-cieloStore.apk` | 2.2.13 | Reenvio Cielo Store (cert debug + sem minify) |
| `TopLavanderia-Totem-2.2.12-cieloRelease.apk` | 2.2.12 | ❌ Assinatura release — rejeitado pela Cielo |
