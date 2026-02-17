# Top Lavanderia - Pacote para Tablet

## Visão Geral

Pasta com todos os arquivos necessários para instalar e configurar o sistema Top Lavanderia com integração PayGo PPC930 em um tablet Android.

## Estrutura

```
tablet_deploy/
├── android-src/          # Código Java nativo para compilar o APK
│   ├── java/             # 12 arquivos .java (plugins, managers, helpers)
│   ├── libs/             # InterfaceAutomacao-v2.1.0.6.aar
│   ├── xml/              # device_filter, file_paths, network_security_config
│   ├── AndroidManifest.xml
│   └── build.gradle
├── paygo/                # APKs do PayGo Integrado (CERT + PROD)
├── config/               # capacitor.config.ts + template de configuração
├── docs/                 # Guia de instalação, checklist, troubleshooting
├── scripts/              # Scripts de instalação (Windows + Linux/Mac)
├── BUILD_APK.md          # Como compilar o APK
└── README.md             # Este arquivo
```

## Instalação Rápida

1. **Compilar o APK** → ver `BUILD_APK.md`
2. **Instalar PayGo Integrado** no tablet (pasta `paygo/`)
3. **Instalar o APK** do Top Lavanderia no tablet
4. **Configurar** → ver `docs/GUIA_INSTALACAO.md`

## Arquivos Críticos

| Arquivo | Função |
|---------|--------|
| `MainActivity.java` | BridgeActivity do Capacitor (carrega o React no WebView) |
| `PayGOPlugin.java` | Plugin Capacitor → chama RealPayGoManager (sem HTTP) |
| `RealPayGoManager.java` | Integração REAL com InterfaceAutomacao (crédito/débito/PIX) |
| `InterfaceAutomacao-v2.1.0.6.aar` | Biblioteca PayGo para comunicação com PPC930 |

## Requisitos

- Android 5.1+ (API 22+)
- PPC930 conectado via USB/Bluetooth
- PayGo Integrado APK instalado
- Conexão de rede para Supabase

## Versão

- **App**: 2.0.0
- **PayGo Integrado**: v4.1.50.5
- **InterfaceAutomacao**: v2.1.0.6
