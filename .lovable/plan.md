

## Análise: Implementação atual vs Documentação Cielo

### O que está CORRETO

- **URI de pagamento**: `lio://payment?request=$base64&urlCallback=order://response` — ✅
- **AndroidManifest**: `<queries>` com `com.ads.lio.uriappclient`, `<meta-data cs_integration_type="uri">`, CieloResponseActivity com scheme `order://response` — ✅
- **Payload JSON**: campos `accessToken`, `clientID`, `reference`, `value`, `items[]`, `paymentCode` — ✅
- **paymentCode values**: `CREDITO_AVISTA`, `DEBITO_AVISTA`, `PIX` — ✅
- **Response parsing**: extrai `authCode` e `externalId` do array `payments[]` — ✅
- **minSdk 24** — ✅ (docs exigem ≥24)

### O que precisa MUDAR

#### 1. `tablet_deploy/CieloLioManager.java` — usa SDK antigo (CRÍTICO)

A versão em `tablet_deploy/android-src/java/CieloLioManager.java` usa o **SDK OrderManager** (`.aar`), que a Cielo está **descontinuando**. A documentação diz explicitamente:

> "Recomendamos fortemente a migração para a integração via Deep link, que oferece uma solução mais leve, flexível e segura."
> "29/08: Fim do suporte a apps não adaptados (sem Deep Link ou SDK < 2.1.0)"
> "15/10: Corte definitivo"

**Ação**: Substituir o arquivo `tablet_deploy/android-src/java/CieloLioManager.java` pela versão Deep Link que já existe em `android/app/src/main/java/.../CieloLioManager.java`. Copiar também o `CieloResponseActivity.java`.

#### 2. Campo `installments` — tipo incorreto (MENOR)

A documentação especifica que `installments` é tipo **string**. Nosso código envia como **int** (`payload.put("installments", 0)`).

**Ação**: Mudar para `payload.put("installments", "0")` no `CieloLioManager.java`.

#### 3. Response parsing incompleta

A documentação mostra que a resposta contém campos úteis que não estamos extraindo:
- `cieloCode` (NSU Cielo)
- `brand` (bandeira do cartão)
- `paymentFields.statusCode` (1=Autorizada, 2=Cancelada, 0=PIX)
- `mask` (cartão mascarado)

**Ação**: Melhorar `consumeDeepLinkResponse` para extrair `cieloCode` como NSU e `authCode` corretamente, e verificar `paymentFields.statusCode` para confirmar aprovação.

#### 4. Build release sem otimização

`minifyEnabled false` e `shrinkResources false` no release build. Para conformidade com limite de 70 MB.

**Ação**: Ativar `minifyEnabled true` e `shrinkResources true` no bloco `release` do `build.gradle`.

### Arquivos a modificar

| Arquivo | Ação |
|---|---|
| `android/app/.../CieloLioManager.java` | Corrigir tipo `installments` para string; melhorar parsing da resposta |
| `tablet_deploy/android-src/java/CieloLioManager.java` | Substituir SDK por versão Deep Link |
| `tablet_deploy/android-src/java/CieloResponseActivity.java` | Criar (copiar da versão principal) |
| `tablet_deploy/android-src/AndroidManifest.xml` | Adicionar CieloResponseActivity + queries |
| `android/app/build.gradle` | Ativar minify/shrink no release |

