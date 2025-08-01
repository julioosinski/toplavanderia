# Instruções de Build para Totem

## 1. Preparação do Ambiente de Build

### Pré-requisitos:
- Node.js 18+ instalado
- Git configurado
- Android Studio (para Android) ou Xcode (para iOS)

## 2. Comandos de Build

### 2.1. Build Web (Desenvolvimento/Teste)
```bash
# Instalar dependências
npm install

# Build para produção
npm run build

# A pasta 'dist/' contém os arquivos para deploy web
```

### 2.2. Build Mobile com Capacitor

#### Para Android:
```bash
# Gerar build web
npm run build

# Sincronizar com Capacitor
npx cap sync android

# Abrir Android Studio para build final
npx cap open android

# Ou build direto por linha de comando
npx cap run android --prod
```

#### Para iOS:
```bash
# Gerar build web
npm run build

# Sincronizar com Capacitor
npx cap sync ios

# Abrir Xcode para build final
npx cap open ios

# Ou build direto por linha de comando
npx cap run ios --prod
```

## 3. Configurações Específicas do Totem

### 3.1. Modo Kiosk (capacitor.config.ts)
```typescript
{
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

### 3.2. Configurações Android (android/app/src/main/AndroidManifest.xml)
```xml
<!-- Adicionar para modo kiosk -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<!-- Para manter tela sempre ligada -->
<uses-permission android:name="android.permission.WAKE_LOCK" />

<!-- Categoria launcher para kiosk -->
<category android:name="android.intent.category.HOME" />
<category android:name="android.intent.category.DEFAULT" />
```

## 4. Arquivos Finais para Transferência

### Para Deploy Web:
- Pasta `dist/` completa
- Arquivo `capacitor.config.ts`
- Documentação de configuração

### Para Android:
- Arquivo APK gerado: `android/app/build/outputs/apk/release/app-release.apk`
- Configurações de instalação
- Guias de configuração

### Para iOS:
- Arquivo IPA ou instalação via TestFlight
- Perfil de provisionamento
- Certificados necessários

## 5. Checklist Pré-Deploy

- [ ] Build executado sem erros
- [ ] Testes de funcionalidade básica
- [ ] Configurações PayGO verificadas
- [ ] Modo kiosk testado
- [ ] Conectividade de rede validada
- [ ] Interface responsiva confirmada
- [ ] Documentação atualizada