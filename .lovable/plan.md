

# Copiar APK do PayGo Integrado para tablet_deploy

## O que fazer

Copiar o arquivo `PGIntegrado-v4.1.50.5_CERT_gertec-signed.apk` enviado pelo usuario para a pasta `tablet_deploy/paygo/`, que e onde ficam os instaladores do PayGo para o tablet.

## Acao

| Origem | Destino |
|--------|---------|
| `user-uploads://PGIntegrado-v4.1.50.5_CERT_gertec-signed.apk` | `tablet_deploy/paygo/PGIntegrado-v4.1.50.5_CERT_gertec-signed.apk` |

## Contexto

Este APK e o **PayGo Integrado** em modo CERT (certificacao/testes). Ele e pre-requisito obrigatorio para o funcionamento do sistema de pagamentos no tablet:

1. Deve ser instalado no tablet via ADB antes do app Top Lavanderia
2. Faz a ponte entre o app e o pinpad PPC930 via Bluetooth
3. A biblioteca `InterfaceAutomacao` no codigo Java depende deste app estar presente

## Atualizacoes adicionais

- Atualizar os scripts `install_tablet.sh` e `install_tablet.bat` para referenciar o nome correto do arquivo APK (atualmente referenciam nomes genericos como `PGIntegrado-CERT.apk`)
- Atualizar o `GUIA_INSTALACAO.md` com o nome exato do arquivo

