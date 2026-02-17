

# Organizar Arquivos para o Tablet em Uma Pasta

## Objetivo

Criar uma pasta `tablet_deploy/` na raiz do projeto com todos os arquivos necessarios para instalar e configurar o sistema no tablet Android com PPC930. Isso facilita o processo: basta copiar essa pasta para um pendrive ou transferir via ADB.

## Estrutura da Pasta

```text
tablet_deploy/
├── android-src/                          # Codigo Java nativo (para build do APK)
│   ├── java/
│   │   ├── MainActivity.java
│   │   ├── PayGOPlugin.java
│   │   ├── RealPayGoManager.java
│   │   ├── USBPlugin.java
│   │   ├── TEFPlugin.java
│   │   ├── RealPayGoIntegration.java
│   │   ├── RealPinpadManager.java
│   │   ├── PinpadManager.java
│   │   ├── PDVManager.java
│   │   ├── DatabaseHelper.java
│   │   ├── SupabaseHelper.java
│   │   └── MachineStatusMonitor.java
│   ├── libs/
│   │   └── InterfaceAutomacao-v2.1.0.6.aar
│   ├── xml/
│   │   ├── device_filter.xml
│   │   ├── file_paths.xml
│   │   └── network_security_config.xml
│   ├── AndroidManifest.xml
│   └── build.gradle
│
├── paygo/                                # APKs do PayGo Integrado
│   ├── PGIntegrado-CERT.zip             # Ambiente de teste
│   └── PGIntegrado-PROD.zip             # Ambiente de producao
│
├── config/
│   ├── capacitor.config.ts
│   └── config_template.json             # Template de config PayGO (host, porta, chave)
│
├── docs/
│   ├── GUIA_INSTALACAO.md               # Passo a passo completo
│   ├── CHECKLIST.md                     # Checklist de verificacao
│   └── TROUBLESHOOTING.md              # Solucao de problemas
│
├── scripts/
│   ├── install_tablet.bat               # Instalacao Windows
│   └── install_tablet.sh                # Instalacao Linux/Mac
│
├── BUILD_APK.md                         # Como compilar o APK
└── README.md                            # Visao geral do pacote
```

## O Que Vai em Cada Pasta

### `android-src/` - Codigo nativo
Todos os arquivos Java, XML e a biblioteca `.aar` necessarios para compilar o APK. Inclui os arquivos criticos recem-atualizados:
- `MainActivity.java` (BridgeActivity com plugins)
- `PayGOPlugin.java` (integrado ao RealPayGoManager)
- `RealPayGoManager.java` (com suporte a credito/debito/PIX)

### `paygo/` - APKs do PayGo Integrado
Os instaladores do PayGo Integrado (CERT para testes, PROD para producao) que ja existem em `tablet_package/paygo_files/`.

### `config/` - Configuracoes
Template de configuracao do PayGO e o `capacitor.config.ts` do projeto.

### `docs/` - Documentacao consolidada
Um unico guia de instalacao claro, um checklist e um troubleshooting. Consolida os varios MDs espalhados no projeto.

### `scripts/` - Scripts de instalacao
Scripts `.bat` (Windows) e `.sh` (Linux/Mac) para instalar via ADB.

## Detalhes Tecnicos

### Arquivos a criar/copiar:

| Origem | Destino | Acao |
|--------|---------|------|
| `android/app/src/main/java/app/lovable/toplavanderia/*.java` (13 arquivos) | `tablet_deploy/android-src/java/` | Copiar todos os .java relevantes |
| `android/app/libs/InterfaceAutomacao-v2.1.0.6.aar` | `tablet_deploy/android-src/libs/` | Copiar |
| `android/app/src/main/res/xml/*.xml` | `tablet_deploy/android-src/xml/` | Copiar device_filter, file_paths, network_security_config |
| `android/app/src/main/AndroidManifest.xml` | `tablet_deploy/android-src/` | Copiar |
| `android/app/build.gradle` | `tablet_deploy/android-src/` | Copiar |
| `capacitor.config.ts` | `tablet_deploy/config/` | Copiar |
| `DEPLOYMENT_TOTEM/config_template.json` | `tablet_deploy/config/` | Copiar |
| `tablet_package/paygo_files/*.zip` | `tablet_deploy/paygo/` | Copiar os 2 ZIPs |
| N/A | `tablet_deploy/docs/GUIA_INSTALACAO.md` | Criar - consolida os guias existentes |
| N/A | `tablet_deploy/docs/CHECKLIST.md` | Criar - baseado no deployment_checklist.md |
| N/A | `tablet_deploy/docs/TROUBLESHOOTING.md` | Criar - baseado nos troubleshooting existentes |
| `tablet_package/install_tablet.bat` | `tablet_deploy/scripts/` | Copiar e atualizar |
| N/A | `tablet_deploy/scripts/install_tablet.sh` | Criar versao Linux/Mac |
| N/A | `tablet_deploy/BUILD_APK.md` | Criar - instrucoes de compilacao |
| N/A | `tablet_deploy/README.md` | Criar - visao geral do pacote |

### Arquivos Java excluidos (legados/debug, nao necessarios):
- `SimpleMainActivity.java` - Activity legada
- `TotemActivity.java` - Substituida pela MainActivity
- `AdminActivity.java` - Activity legada
- `BroadcastPinpadManager.java` - Debug apenas
- `DebugPinpadManager.java` - Debug apenas
- `SimplePinpadManager.java` - Debug apenas
- `WorkingPayGoManager.java` - Versao antiga

### Nota importante sobre o build.gradle:
As dependencias do Capacitor estao comentadas no `build.gradle` atual. O `BUILD_APK.md` incluira instrucoes para descomentar as linhas do Capacitor antes de compilar.

