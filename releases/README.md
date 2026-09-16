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

Envie: `releases/TopLavanderia-Totem-2.2.127-cielo.apk` (grade livre após pagar; pulso ESP em background)

### SHA-256 dos certificados (referÃªncia)

| Keystore | SHA-256 (inÃ­cio) | Uso |
|----------|------------------|-----|
| Debug (`androiddebugkey`) | `99:E6:CD:F0:...` | **Cielo Store** (protÃ³tipo jÃ¡ publicado) |
| Release (`toplavanderia-release.jks`) | `63:5A:ED:7E:...` | App novo / Play Store (nÃ£o usar para update Cielo) |

## Firmware ESP32 (lavadora/secadora)

Arquivo: `releases/ESP32_Lavadora_v2.3.2.ino` (template) ou
`ESP32_Lavadora_v2.3.2_relay2_PRONTO.ino` (já com LAUNDRY_ID do Sinuelo, sem placeholders).

> **Não use o v2.2.8.** O `gpio_hold_en` no GPIO2 (RTC_GPIO12) congelava o pad no
> estado do domínio RTC e o relé não acionava: o comando era confirmado, mas a
> máquina não recebia o crédito. O APK 2.2.125+ continua enfileirando ON; o pulso
> é 100% do firmware. v2.3.2: solta o RTC hold do GPIO2 e pulsa HIGH 1500 ms.

### Descobrir o pino do relé (v2.3.0+)

O GPIO do relé virou configuração de tempo de execução, salva na NVS. Abra
`http://<ip-da-placa>/` e use o painel **Descobrir o pino do relé**: cada botão
pulsa um GPIO por 1,2 s. Quando a máquina aceitar o crédito, clique em **Salvar pino**.

Pela linha de comando:

```bash
curl -X POST "http://192.168.3.183/pulse?gpio=5&ms=1200"   # testa sem salvar
curl -X POST "http://192.168.3.183/relay/gpio?gpio=5"      # grava na NVS
curl "http://192.168.3.183/status"                          # mostra relay_gpio
```

O pino ativo também aparece no `network_status` do heartbeat como `connected|gpio:N`.

Para gerar outro relay/ciclo: `node scripts/gen-lavadora-ino.mjs <relayPin> <cicloMin>`.

1. Abra no Arduino IDE (placa ESP32, partição **Minimal SPIFFS with OTA**).
2. Troque `__LAUNDRY_ID__` e `__MACHINE_NAME__` (ou gere o `.ino` em Admin → Configurar ESP32).
3. Compile e envie por USB. Wi-Fi continua pelo portal AP da placa (`TopLavanderia-…` / senha `toplav123`).
4. OTA remoto: compile o `.ino.bin` no Arduino IDE (Exportar binário) e envie no painel OTA com versão `v2.3.2`.

## Desenvolvimento local (ADB na LIO)

```powershell
cd android
.\gradlew assembleRelease -PuseDebugSigning=true
adb install -r app\build\outputs\apk\release\app-release.apk
```

## VersÃµes

| Arquivo | versionName | Uso |
|---------|-------------|-----|
| `TopLavanderia-Totem-2.2.127-cielo.apk` | 2.2.127 | **Atual** — grade livre na hora; pulso ESP em background |
| `TopLavanderia-Totem-2.2.126-cielo.apk` | 2.2.126 | esperava ESP confirmar o pulso antes de voltar à grade |
| `ESP32_Lavadora_v2.3.2.ino` | v2.3.2 | **Atual** — solta RTC hold do GPIO2 e pulsa HIGH 1500 ms |
| `ESP32_Lavadora_v2.3.1.ino` | v2.3.1 | GPIO2 HIGH 1500 ms, mas sem soltar o hold legado do v2.2.8 |
| `ESP32_Lavadora_v2.3.0.ino` | v2.3.0 | pino do relé configurável na página da placa + teste de pulso por GPIO |
| `ESP32_Lavadora_v2.2.9.ino` | v2.2.9 | pulso GPIO2 com reassert (sem hold) |
| `ESP32_Lavadora_v2.2.8.ino` | v2.2.8 | **Não usar** — gpio_hold derrubava o GPIO2; confirmava sem pulsar |
| `TopLavanderia-Totem-2.2.125-cielo.apk` | 2.2.125 | PIX: UI 90s, callback tardio 8 min, janitor não fecha PAID |
| `TopLavanderia-Totem-2.2.124-cielo.apk` | 2.2.124 | pagamento aprovado reentrega comando ESP; sem falso "em uso" |
| `ESP32_Lavadora_v2.2.7.ino` | v2.2.7 | Firmware lavadora/secadora — timeout HTTP 20s + poll 3s |
| `TopLavanderia-Totem-2.2.123-cielo.apk` | 2.2.123 | café: cobra preço do produto; confirma credito (não ON) |
| `TopLavanderia-Totem-2.2.122-cielo.apk` | 2.2.122 | Stone Deeplink (pay/cancel) + Cielo sessions |
| `TopLavanderia-Totem-2.2.121-cielo.apk` | 2.2.121 | payment_sessions; reserva atômica; reconciliação Cielo; não cancela TX autorizada |
| `TopLavanderia-Totem-2.2.120-cielo.apk` | 2.2.120 | pagamentos sequenciais sem travar; confirm ESP robusto; estorno por TX |
| `TopLavanderia-Totem-2.2.119-cielo.apk` | 2.2.119 | confirm ESP estendido; snapshot estorno por TX; needs_refund |
| `TopLavanderia-Totem-2.2.118-cielo.apk` | 2.2.118 | confirm ESP 25s+15s; estorno se falhar; reclaim 20s |
| `TopLavanderia-Totem-2.2.105.apk` | 2.2.105 | bloqueia OFF automatico da poltrona (servidor+APK) |
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

