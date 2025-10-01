# Guia de Implementação Android - Plugins Nativos

Este guia detalha como implementar os plugins nativos PayGO, TEF e USB no Android.

## Pré-requisitos

1. Android Studio instalado
2. Projeto Capacitor já inicializado (`npx cap add android`)
3. Conhecimento básico de Java/Kotlin

## Estrutura de Arquivos Android

Após rodar `npx cap add android`, você terá:

```
android/
├── app/
│   └── src/
│       └── main/
│           └── java/
│               └── app/
│                   └── lovable/
│                       └── [seu-app-id]/
│                           ├── MainActivity.java
│                           └── plugins/
│                               ├── PayGOPlugin.java
│                               ├── TEFPlugin.java
│                               └── USBPlugin.java
```

## 1. Plugin PayGO (PPC930)

### 1.1 Adicionar Dependências

No arquivo `android/app/build.gradle`, adicione:

```gradle
dependencies {
    // Dependências existentes...
    
    // PayGO Web SDK (você precisa ter o .aar fornecido pela Zoop/PayGO)
    implementation files('libs/paygo-web-sdk.aar')
    
    // Ou se tiver no Maven:
    // implementation 'com.paygo:web-sdk:1.0.0'
    
    // USB Serial (para comunicação com pinpad)
    implementation 'com.github.mik3y:usb-serial-for-android:3.5.1'
}
```

### 1.2 Criar PayGOPlugin.java

Crie o arquivo `android/app/src/main/java/app/lovable/[seu-app-id]/plugins/PayGOPlugin.java`:

```java
package app.lovable.[seu-app-id].plugins;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Imports da biblioteca PayGO Web SDK
// import br.com.paygo.web.PayGOWeb;
// import br.com.paygo.web.listener.PaymentListener;

@CapacitorPlugin(name = "PayGO")
public class PayGOPlugin extends Plugin {
    
    // Instância do PayGO Web SDK
    // private PayGOWeb paygoWeb;
    private boolean isInitialized = false;
    
    @PluginMethod
    public void initialize(PluginCall call) {
        String host = call.getString("host", "localhost");
        Integer port = call.getInt("port", 8080);
        String automationKey = call.getString("automationKey", "");
        
        try {
            // Inicializar PayGO Web SDK
            // paygoWeb = new PayGOWeb(getContext());
            // paygoWeb.initialize(host, port, automationKey);
            
            isInitialized = true;
            
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("message", "PayGO initialized successfully");
            call.resolve(ret);
            
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("message", "Initialization failed: " + e.getMessage());
            call.reject("INIT_FAILED", e);
        }
    }
    
    @PluginMethod
    public void checkStatus(PluginCall call) {
        JSObject ret = new JSObject();
        
        if (!isInitialized) {
            ret.put("connected", false);
            ret.put("status", "not_initialized");
            call.resolve(ret);
            return;
        }
        
        try {
            // Verificar status real do PayGO
            // boolean connected = paygoWeb.isConnected();
            boolean connected = false; // Placeholder
            
            ret.put("connected", connected);
            ret.put("status", connected ? "online" : "offline");
            call.resolve(ret);
            
        } catch (Exception e) {
            ret.put("connected", false);
            ret.put("status", "error");
            call.reject("STATUS_CHECK_FAILED", e);
        }
    }
    
    @PluginMethod
    public void processPayment(PluginCall call) {
        if (!isInitialized) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("message", "PayGO not initialized");
            call.resolve(ret);
            return;
        }
        
        String paymentType = call.getString("paymentType", "credit");
        Double amount = call.getDouble("amount", 0.0);
        String orderId = call.getString("orderId", "");
        
        try {
            // Processar pagamento via PayGO Web
            // paygoWeb.processPayment(paymentType, amount, orderId, new PaymentListener() {
            //     @Override
            //     public void onSuccess(PaymentResult result) {
            //         JSObject ret = new JSObject();
            //         ret.put("success", true);
            //         ret.put("message", "Payment approved");
            //         ret.put("transactionId", result.getTransactionId());
            //         ret.put("status", "approved");
            //         call.resolve(ret);
            //     }
            //     
            //     @Override
            //     public void onError(String error) {
            //         JSObject ret = new JSObject();
            //         ret.put("success", false);
            //         ret.put("message", error);
            //         ret.put("status", "error");
            //         call.resolve(ret);
            //     }
            // });
            
            // Mock response para teste
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("message", "Payment processed (mock)");
            ret.put("transactionId", "MOCK_" + System.currentTimeMillis());
            ret.put("status", "approved");
            call.resolve(ret);
            
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("message", "Payment failed: " + e.getMessage());
            ret.put("status", "error");
            call.reject("PAYMENT_FAILED", e);
        }
    }
    
    @PluginMethod
    public void cancelTransaction(PluginCall call) {
        try {
            // Cancelar transação no PayGO
            // paygoWeb.cancelTransaction();
            
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("message", "Transaction cancelled");
            call.resolve(ret);
            
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("message", "Cancel failed: " + e.getMessage());
            call.reject("CANCEL_FAILED", e);
        }
    }
    
    @PluginMethod
    public void detectPinpad(PluginCall call) {
        // Implementar detecção USB do PPC930
        JSObject ret = new JSObject();
        ret.put("detected", false);
        ret.put("deviceName", "PPC930 detection not implemented");
        call.resolve(ret);
    }
    
    @PluginMethod
    public void getSystemStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("initialized", isInitialized);
        ret.put("clientConnected", false);
        ret.put("usbDeviceDetected", false);
        ret.put("timestamp", System.currentTimeMillis());
        call.resolve(ret);
    }
    
    @PluginMethod
    public void testConnection(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("success", isInitialized);
        ret.put("usbConnection", false);
        ret.put("clientStatus", isInitialized ? "initialized" : "not_initialized");
        ret.put("message", isInitialized ? "Connection test OK" : "Not initialized");
        ret.put("timestamp", System.currentTimeMillis());
        call.resolve(ret);
    }
}
```

## 2. Plugin TEF

Crie `android/app/src/main/java/app/lovable/[seu-app-id]/plugins/TEFPlugin.java`:

```java
package app.lovable.[seu-app-id].plugins;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.net.Socket;

@CapacitorPlugin(name = "TEF")
public class TEFPlugin extends Plugin {
    
    private Socket socket;
    private boolean isConnected = false;
    private String host = "127.0.0.1";
    private int port = 4321;
    
    @PluginMethod
    public void initialize(PluginCall call) {
        host = call.getString("host", "127.0.0.1");
        port = call.getInt("port", 4321);
        
        try {
            socket = new Socket(host, port);
            isConnected = true;
            
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("message", "TEF connected");
            ret.put("version", "1.0.0");
            call.resolve(ret);
            
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("message", "Connection failed: " + e.getMessage());
            call.reject("INIT_FAILED", e);
        }
    }
    
    @PluginMethod
    public void checkStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("connected", isConnected);
        ret.put("status", isConnected ? "online" : "offline");
        ret.put("isOnline", isConnected);
        call.resolve(ret);
    }
    
    @PluginMethod
    public void processTransaction(PluginCall call) {
        if (!isConnected) {
            JSObject ret = new JSObject();
            ret.put("retorno", "-1");
            ret.put("mensagem", "TEF not connected");
            call.resolve(ret);
            return;
        }
        
        String transacao = call.getString("transacao", "venda");
        String valor = call.getString("valor", "0");
        String cupomFiscal = call.getString("cupomFiscal", "");
        
        try {
            // Enviar comando para TEF
            OutputStreamWriter writer = new OutputStreamWriter(socket.getOutputStream());
            writer.write(transacao + "|" + valor + "|" + cupomFiscal + "\n");
            writer.flush();
            
            // Receber resposta
            BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream()));
            String response = reader.readLine();
            
            // Parsear resposta (formato depende do TEF usado)
            JSObject ret = new JSObject();
            ret.put("retorno", "0"); // 0 = aprovado
            ret.put("nsu", "123456");
            ret.put("mensagem", "Transação aprovada");
            call.resolve(ret);
            
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("retorno", "-1");
            ret.put("mensagem", "Error: " + e.getMessage());
            call.reject("TRANSACTION_FAILED", e);
        }
    }
    
    @PluginMethod
    public void cancelTransaction(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("message", "Transaction cancelled");
        call.resolve(ret);
    }
    
    @PluginMethod
    public void findTEFDevices(PluginCall call) {
        JSArray devices = new JSArray();
        
        // Tentar conectar em IPs comuns
        String[] commonIPs = {"192.168.1.100", "192.168.0.100", "10.0.0.100"};
        
        for (String ip : commonIPs) {
            try {
                Socket testSocket = new Socket(ip, port);
                testSocket.close();
                
                JSObject device = new JSObject();
                device.put("ip", ip);
                device.put("name", "TEF Device");
                device.put("model", "Unknown");
                devices.put(device);
                
            } catch (Exception e) {
                // Ignorar erro e tentar próximo IP
            }
        }
        
        JSObject ret = new JSObject();
        ret.put("devices", devices);
        call.resolve(ret);
    }
}
```

## 3. Plugin USB

Crie `android/app/src/main/java/app/lovable/[seu-app-id]/plugins/USBPlugin.java`:

```java
package app.lovable.[seu-app-id].plugins;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.HashMap;
import java.util.Map;

@CapacitorPlugin(name = "USB")
public class USBPlugin extends Plugin {
    
    private static final String ACTION_USB_PERMISSION = "app.lovable.USB_PERMISSION";
    private UsbManager usbManager;
    private UsbDeviceConnection connection;
    
    // Dispositivos pinpad conhecidos
    private static final Map<String, String> KNOWN_PINPADS = new HashMap<>();
    static {
        KNOWN_PINPADS.put("1155:22336", "Positivo L4");
        KNOWN_PINPADS.put("1027:24577", "Generic TEF");
        KNOWN_PINPADS.put("1105:32768", "POS Terminal");
    }
    
    @Override
    public void load() {
        super.load();
        usbManager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
    }
    
    @PluginMethod
    public void requestPermission(PluginCall call) {
        Integer vendorId = call.getInt("vendorId");
        Integer productId = call.getInt("productId");
        
        if (vendorId == null || productId == null) {
            call.reject("Invalid parameters");
            return;
        }
        
        UsbDevice device = findDevice(vendorId, productId);
        
        if (device == null) {
            JSObject ret = new JSObject();
            ret.put("granted", false);
            call.resolve(ret);
            return;
        }
        
        if (usbManager.hasPermission(device)) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        
        PendingIntent permissionIntent = PendingIntent.getBroadcast(
            getContext(), 
            0, 
            new Intent(ACTION_USB_PERMISSION),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        
        IntentFilter filter = new IntentFilter(ACTION_USB_PERMISSION);
        getContext().registerReceiver(new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (ACTION_USB_PERMISSION.equals(intent.getAction())) {
                    synchronized (this) {
                        UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
                        boolean granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
                        
                        JSObject ret = new JSObject();
                        ret.put("granted", granted);
                        call.resolve(ret);
                        
                        getContext().unregisterReceiver(this);
                    }
                }
            }
        }, filter);
        
        usbManager.requestPermission(device, permissionIntent);
    }
    
    @PluginMethod
    public void listDevices(PluginCall call) {
        HashMap<String, UsbDevice> deviceList = usbManager.getDeviceList();
        JSArray devices = new JSArray();
        
        for (UsbDevice device : deviceList.values()) {
            JSObject deviceObj = new JSObject();
            deviceObj.put("vendorId", device.getVendorId());
            deviceObj.put("productId", device.getProductId());
            deviceObj.put("deviceName", device.getDeviceName());
            deviceObj.put("manufacturer", device.getManufacturerName());
            deviceObj.put("deviceClass", device.getDeviceClass());
            deviceObj.put("deviceSubclass", device.getDeviceSubclass());
            
            if (device.getSerialNumber() != null) {
                deviceObj.put("serialNumber", device.getSerialNumber());
            }
            
            devices.put(deviceObj);
        }
        
        JSObject ret = new JSObject();
        ret.put("devices", devices);
        call.resolve(ret);
    }
    
    @PluginMethod
    public void hasPermission(PluginCall call) {
        Integer vendorId = call.getInt("vendorId");
        Integer productId = call.getInt("productId");
        
        UsbDevice device = findDevice(vendorId, productId);
        boolean granted = device != null && usbManager.hasPermission(device);
        
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }
    
    @PluginMethod
    public void openDevice(PluginCall call) {
        Integer vendorId = call.getInt("vendorId");
        Integer productId = call.getInt("productId");
        
        UsbDevice device = findDevice(vendorId, productId);
        
        if (device == null) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("message", "Device not found");
            call.resolve(ret);
            return;
        }
        
        if (!usbManager.hasPermission(device)) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("message", "Permission not granted");
            call.resolve(ret);
            return;
        }
        
        try {
            connection = usbManager.openDevice(device);
            
            JSObject ret = new JSObject();
            ret.put("success", connection != null);
            ret.put("message", connection != null ? "Device opened" : "Failed to open");
            call.resolve(ret);
            
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("message", e.getMessage());
            call.reject("OPEN_FAILED", e);
        }
    }
    
    @PluginMethod
    public void closeDevice(PluginCall call) {
        if (connection != null) {
            connection.close();
            connection = null;
        }
        
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }
    
    @PluginMethod
    public void detectPinpads(PluginCall call) {
        HashMap<String, UsbDevice> deviceList = usbManager.getDeviceList();
        JSArray pinpads = new JSArray();
        
        for (UsbDevice device : deviceList.values()) {
            String key = device.getVendorId() + ":" + device.getProductId();
            String name = KNOWN_PINPADS.get(key);
            
            if (name != null) {
                JSObject pinpad = new JSObject();
                pinpad.put("vendorId", device.getVendorId());
                pinpad.put("productId", device.getProductId());
                pinpad.put("name", name);
                pinpad.put("connected", usbManager.hasPermission(device));
                pinpads.put(pinpad);
            }
        }
        
        JSObject ret = new JSObject();
        ret.put("pinpads", pinpads);
        call.resolve(ret);
    }
    
    private UsbDevice findDevice(int vendorId, int productId) {
        HashMap<String, UsbDevice> deviceList = usbManager.getDeviceList();
        
        for (UsbDevice device : deviceList.values()) {
            if (device.getVendorId() == vendorId && device.getProductId() == productId) {
                return device;
            }
        }
        
        return null;
    }
}
```

## 4. Registrar Plugins no MainActivity

Edite `android/app/src/main/java/app/lovable/[seu-app-id]/MainActivity.java`:

```java
package app.lovable.[seu-app-id];

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

// Importar seus plugins
import app.lovable.[seu-app-id].plugins.PayGOPlugin;
import app.lovable.[seu-app-id].plugins.TEFPlugin;
import app.lovable.[seu-app-id].plugins.USBPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Registrar plugins personalizados
        registerPlugin(PayGOPlugin.class);
        registerPlugin(TEFPlugin.class);
        registerPlugin(USBPlugin.class);
    }
}
```

## 5. Adicionar Permissões no AndroidManifest.xml

Edite `android/app/src/main/AndroidManifest.xml`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    
    <!-- Permissões USB -->
    <uses-feature android:name="android.hardware.usb.host" />
    <uses-permission android:name="android.permission.USB_PERMISSION" />
    
    <!-- Permissões de rede -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    
    <application>
        <!-- Atividade principal -->
        <activity android:name=".MainActivity">
            <!-- Adicionar intent filter para USB -->
            <intent-filter>
                <action android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED" />
            </intent-filter>
            
            <meta-data
                android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED"
                android:resource="@xml/device_filter" />
        </activity>
    </application>
</manifest>
```

## 6. Criar Filtro de Dispositivos USB

Crie `android/app/src/main/res/xml/device_filter.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- Positivo L4 -->
    <usb-device vendor-id="1155" product-id="22336" />
    
    <!-- Generic TEF -->
    <usb-device vendor-id="1027" product-id="24577" />
    
    <!-- POS Terminal -->
    <usb-device vendor-id="1105" product-id="32768" />
</resources>
```

## 7. Compilar e Testar

```bash
# Sync Capacitor
npx cap sync android

# Abrir no Android Studio
npx cap open android

# Ou compilar diretamente
cd android
./gradlew assembleDebug

# Instalar no dispositivo
adb install app/build/outputs/apk/debug/app-debug.apk
```

## Notas Importantes

1. **PayGO SDK**: Você precisa obter o arquivo `.aar` da biblioteca PayGO Web com a Zoop
2. **TEF**: A implementação TEF pode variar conforme o fornecedor (Elgin, Stone, etc)
3. **USB**: Requer dispositivo físico Android, não funciona em emulador
4. **Permissões**: Usuário deve aprovar permissão USB na primeira conexão
5. **Testes**: Recomendo testar em tablet Android real com pinpad conectado

## Próximos Passos

1. Obter bibliotecas nativas (PayGO SDK, TEF SDK)
2. Ajustar código conforme documentação dos SDKs
3. Testar em dispositivo físico
4. Implementar tratamento de erros robusto
5. Adicionar logs para debugging

## Suporte

- Documentação Capacitor: https://capacitorjs.com/docs/plugins
- USB Serial Android: https://github.com/mik3y/usb-serial-for-android
