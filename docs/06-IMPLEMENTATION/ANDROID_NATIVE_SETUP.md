# Configuração Android Nativo - TopLavanderia

## Visão Geral
Este guia detalha como configurar os plugins nativos Android para PayGO, TEF e USB.

## Pré-requisitos
- Android Studio instalado
- JDK 17+
- Android SDK 33+
- Projeto React exportado para GitHub

## Estrutura dos Plugins

### Plugins Criados
```
android/app/src/main/java/app/lovable/toplavanderia/
├── PayGOPlugin.java     # Integração PayGO Web SDK
├── TEFPlugin.java       # Integração TEF
└── USBPlugin.java       # Comunicação USB com pinpads
```

## Passo 1: Exportar Projeto

1. **Exportar para GitHub:**
   - Clique em "Export to Github" no Lovable
   - Clone o repositório localmente
   - Execute `npm install`

## Passo 2: Adicionar Plataforma Android

```bash
# Adicionar plataforma Android
npx cap add android

# Atualizar dependências nativas
npx cap update android

# Fazer build do projeto web
npm run build

# Sincronizar com Android
npx cap sync
```

## Passo 3: Configurar MainActivity.java

Abra `android/app/src/main/java/app/lovable/toplavanderia/MainActivity.java` e registre os plugins:

```java
package app.lovable.toplavanderia;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Registrar plugins customizados
        registerPlugin(PayGOPlugin.class);
        registerPlugin(TEFPlugin.class);
        registerPlugin(USBPlugin.class);
    }
}
```

## Passo 4: Atualizar AndroidManifest.xml

Adicione as permissões necessárias em `android/app/src/main/AndroidManifest.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <application
        android:allowBackup="false"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="true">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
            android:label="@string/title_activity_main"
            android:theme="@style/AppTheme.NoActionBarLaunch"
            android:launchMode="singleTask">

            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

            <!-- Intent filter para dispositivos USB -->
            <intent-filter>
                <action android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED" />
            </intent-filter>

            <meta-data
                android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED"
                android:resource="@xml/device_filter" />
        </activity>

    </application>

    <!-- Permissões -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
    
    <!-- Permissões USB -->
    <uses-feature android:name="android.hardware.usb.host" android:required="false" />

</manifest>
```

## Passo 5: Atualizar build.gradle

Adicione dependências necessárias em `android/app/build.gradle`:

```gradle
android {
    namespace "app.lovable.toplavanderia"
    compileSdkVersion rootProject.ext.compileSdkVersion
    defaultConfig {
        applicationId "app.lovable.toplavanderia"
        minSdkVersion rootProject.ext.minSdkVersion
        targetSdkVersion rootProject.ext.targetSdkVersion
        versionCode 1
        versionName "1.0"
        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
    }
    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
}

dependencies {
    implementation fileTree(dir: 'libs', include: ['*.jar'])
    implementation "androidx.appcompat:appcompat:$androidxAppCompatVersion"
    implementation "androidx.coordinatorlayout:coordinatorlayout:$coordinatorLayoutVersion"
    implementation "androidx.core:core-splashscreen:$coreSplashScreenVersion"
    implementation project(':capacitor-android')
    
    // Dependências adicionais para USB e comunicação
    implementation 'com.google.code.gson:gson:2.10.1'
    
    testImplementation "junit:junit:$junitVersion"
    androidTestImplementation "androidx.test.ext:junit:$androidxJunitVersion"
    androidTestImplementation "androidx.test.espresso:espresso-core:$androidxEspressoCoreVersion"
}
```

## Passo 6: Configuração de Segurança de Rede

Crie/atualize `android/app/src/main/res/xml/network_security_config.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Permitir HTTP para IPs locais (PayGO e TEF) -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">192.168.1.0/24</domain>
        <domain includeSubdomains="true">10.0.0.0/8</domain>
        <domain includeSubdomains="true">172.16.0.0/12</domain>
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">127.0.0.1</domain>
    </domain-config>
    
    <!-- HTTPS obrigatório para APIs externas -->
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system"/>
        </trust-anchors>
    </base-config>
</network-security-config>
```

## Passo 7: Build e Teste

### Build do APK

```bash
# Abrir no Android Studio
npx cap open android

# Ou fazer build via linha de comando
cd android
./gradlew assembleDebug

# APK será gerado em:
# android/app/build/outputs/apk/debug/app-debug.apk
```

### Instalar no Dispositivo

```bash
# Via Android Studio (recomendado)
# Run > Run 'app'

# Ou via adb
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## Passo 8: Testar Plugins

### Testar PayGO Plugin

```typescript
import PayGO from '@/plugins/paygo';

// Inicializar
const result = await PayGO.initialize({
  host: '192.168.1.100',
  port: 8080,
  automationKey: 'sua-chave'
});

// Processar pagamento
const payment = await PayGO.processPayment({
  amount: 10.50,
  paymentType: 'credit',
  orderId: 'ORDER-123'
});
```

### Testar TEF Plugin

```typescript
import TEF from '@/plugins/tef';

// Inicializar
await TEF.initialize({
  provider: 'elgin',
  endpoint: 'http://192.168.1.100:7000',
  merchantId: 'MERCHANT123',
  terminalId: 'TERM001'
});

// Processar pagamento
const payment = await TEF.processPayment({
  amount: 25.00,
  paymentType: 'credit',
  installments: 3,
  orderId: 'ORDER-456'
});
```

### Testar USB Plugin

```typescript
import USB from '@/plugins/usb';

// Detectar pinpad
const result = await USB.detectPinpad();
console.log('Pinpad detectado:', result.detected);

// Listar dispositivos
const devices = await USB.listDevices();
console.log('Dispositivos USB:', devices);
```

## Troubleshooting

### Problema: Plugins não encontrados

**Solução:**
```bash
npx cap sync android
cd android
./gradlew clean build
```

### Problema: Erro de permissão USB

**Solução:**
- Verificar se `device_filter.xml` está correto
- Verificar permissões no AndroidManifest.xml
- Reiniciar o dispositivo

### Problema: HTTP cleartext não permitido

**Solução:**
- Verificar `network_security_config.xml`
- Verificar `android:usesCleartextTraffic="true"` no AndroidManifest.xml

### Problema: PayGO não conecta

**Soluções:**
1. Verificar se PayGO Web SDK está rodando no tablet
2. Verificar IP e porta corretos
3. Testar conexão via browser: `http://192.168.1.100:8080/api/status`
4. Verificar firewall do Android

## Logs e Debug

### Visualizar logs Android

```bash
# Ver todos os logs
adb logcat

# Filtrar logs do app
adb logcat | grep "TopLavanderia"

# Filtrar logs dos plugins
adb logcat | grep "PayGO\|TEF\|USB"

# Limpar logs
adb logcat -c
```

### Debug no Android Studio

1. Abrir projeto Android no Android Studio
2. Tools > Android > Android Device Monitor
3. Conectar dispositivo via USB
4. Run > Debug 'app'
5. Colocar breakpoints nos plugins Java

## Referências

- [Capacitor Android Documentation](https://capacitorjs.com/docs/android)
- [Android USB Host Documentation](https://developer.android.com/guide/topics/connectivity/usb/host)
- [PayGO Web SDK Documentation](https://paygo.com.br/docs)
- [Supabase Android Documentation](https://supabase.com/docs)

## Próximos Passos

1. **Testar em dispositivo real** (tablet Positivo)
2. **Configurar assinatura do APK** para release
3. **Otimizar ProGuard rules** para reduzir tamanho do APK
4. **Implementar crash reporting** (Firebase Crashlytics)
5. **Configurar CI/CD** para builds automáticos
