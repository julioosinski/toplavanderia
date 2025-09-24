# Arquivos para Tablet Android - Totem PPC930

## 1. Arquivos Principais para Transferência

### 1.1. APK da Aplicação
**Localização após build:** `android/app/build/outputs/apk/release/app-release.apk`

**Como gerar:**
```bash
npm run build
npx cap sync android
npx cap build android --prod
```

### 1.2. Arquivos de Configuração

#### capacitor.config.ts
```json
{
  "appId": "app.lovable.toplavanderia",
  "appName": "toplavanderia",
  "webDir": "dist",
  "server": {
    "url": "https://1d41a6b9-83a6-47d2-99a8-147b204a13ef.lovableproject.com?forceHideBadge=true",
    "cleartext": true
  },
  "plugins": {
    "SplashScreen": {
      "launchShowDuration": 2000,
      "backgroundColor": "#ffffff"
    },
    "StatusBar": {
      "style": "dark",
      "backgroundColor": "#ffffff"
    }
  }
}
```

#### config_template.json (PayGO)
```json
{
  "paygo": {
    "host": "192.168.1.100",
    "port": 60906,
    "automationKey": "SUA_CHAVE_AQUI",
    "timeout": 30000,
    "retryAttempts": 3,
    "retryDelay": 2000
  },
  "kiosk": {
    "enabled": true,
    "preventNavigation": true,
    "fullscreen": true
  }
}
```

## 2. Arquivos de Suporte Android

### 2.1. Biblioteca PayGO
- `android/app/libs/InterfaceAutomacao-v2.1.0.6.aar`

### 2.2. Configurações USB (PPC930)
- `android/app/src/main/res/xml/device_filter.xml`
- `android/app/src/main/res/xml/file_paths.xml`

### 2.3. Manifesto Android
- `android/app/src/main/AndroidManifest.xml` (com permissões USB)

## 3. Documentação Essencial

### 3.1. Guias de Instalação
- `DEPLOYMENT_TOTEM/README_TOTEM.md`
- `DEPLOYMENT_TOTEM/build_instructions.md`
- `DEPLOYMENT_TOTEM/deployment_checklist.md`

### 3.2. Configuração PayGO
- `DEPLOYMENT_TOTEM/PAYGO_INTEGRATION_GUIDE.md`
- `PAYGO_PPC930_DOCUMENTATION.md`
- `docs/02-PAYGO-INTEGRATION/PAYGO_TROUBLESHOOTING.md`

### 3.3. Troubleshooting
- `docs/06-SUPPORT/FAQ.md`
- `docs/06-SUPPORT/CONTACT_INFO.md`

## 4. Checklist de Arquivos para Tablet

### ✅ Arquivos Obrigatórios:
- [ ] `app-release.apk` (aplicação principal)
- [ ] `capacitor.config.ts` (configuração)
- [ ] `config_template.json` (template PayGO)
- [ ] `README_TOTEM.md` (guia instalação)
- [ ] `deployment_checklist.md` (checklist implantação)

### ✅ Arquivos de Configuração PayGO:
- [ ] `PAYGO_INTEGRATION_GUIDE.md`
- [ ] `PAYGO_PPC930_DOCUMENTATION.md`
- [ ] `PAYGO_TROUBLESHOOTING.md`

### ✅ Documentação Técnica:
- [ ] `build_instructions.md`
- [ ] `FAQ.md`
- [ ] `CONTACT_INFO.md`

## 5. Estrutura Final para Tablet

```
tablet-files/
├── app-release.apk                    # Aplicação principal
├── config/
│   ├── capacitor.config.ts
│   └── config_template.json
├── docs/
│   ├── README_TOTEM.md
│   ├── deployment_checklist.md
│   ├── PAYGO_INTEGRATION_GUIDE.md
│   ├── PAYGO_PPC930_DOCUMENTATION.md
│   └── PAYGO_TROUBLESHOOTING.md
└── support/
    ├── FAQ.md
    └── CONTACT_INFO.md
```

## 6. Comandos para Preparar Arquivos

### 6.1. Build Completo
```bash
# 1. Instalar dependências
npm install

# 2. Build produção
npm run build

# 3. Sincronizar Capacitor
npx cap sync android

# 4. Gerar APK
npx cap build android --prod
```

### 6.2. Copiar Arquivos Essenciais
```bash
# Criar pasta de distribuição
mkdir tablet-deployment

# Copiar APK
cp android/app/build/outputs/apk/release/app-release.apk tablet-deployment/

# Copiar configurações
cp capacitor.config.ts tablet-deployment/config/
cp DEPLOYMENT_TOTEM/config_template.json tablet-deployment/config/

# Copiar documentação
cp -r docs/ tablet-deployment/
cp -r DEPLOYMENT_TOTEM/ tablet-deployment/docs/
```

## 7. Configurações Específicas do Tablet

### 7.1. Configuração de Rede
- IP fixo recomendado
- Porta 60906 aberta para PayGO
- Firewall configurado

### 7.2. Configuração Android
- Modo desenvolvedor ativado
- Instalação de fontes desconhecidas habilitada
- Modo kiosk configurado
- Auto-start da aplicação

### 7.3. Configuração PPC930
- Driver USB instalado
- Dispositivo reconhecido pelo sistema
- Teste de conectividade realizado

## 8. Testes Pré-Deployment

### ✅ Testes Obrigatórios:
- [ ] APK instala corretamente
- [ ] Aplicação abre sem erros
- [ ] PPC930 é detectado
- [ ] Conexão PayGO funcional
- [ ] Transação teste aprovada
- [ ] Modo kiosk ativo
- [ ] Interface responsiva

## 9. Suporte Pós-Instalação

### Contatos Técnicos:
- Suporte Aplicação: [INSERIR CONTATO]
- Suporte PayGO: [INSERIR CONTATO]
- Suporte Hardware: [INSERIR CONTATO]

### Logs para Diagnóstico:
- Chrome DevTools (chrome://inspect)
- Logs Android (adb logcat)
- Logs PayGO (interface admin)