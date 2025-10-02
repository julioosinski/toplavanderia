package app.lovable.toplavanderia;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbManager;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import org.json.JSONException;

import java.util.HashMap;

/**
 * Plugin Capacitor para comunicação USB com pinpads
 * 
 * Permite detectar e comunicar com dispositivos USB como:
 * - PPC930 da Positivo
 * - Outros pinpads USB
 */
@CapacitorPlugin(
    name = "USB",
    permissions = {
        @Permission(strings = { "android.permission.USB_PERMISSION" }, alias = "usb")
    }
)
public class USBPlugin extends Plugin {
    
    private static final String ACTION_USB_PERMISSION = "app.lovable.toplavanderia.USB_PERMISSION";
    private UsbManager usbManager;
    private UsbDevice currentDevice;
    private UsbDeviceConnection connection;
    
    /**
     * BroadcastReceiver para permissões USB
     */
    private final BroadcastReceiver usbReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            
            if (ACTION_USB_PERMISSION.equals(action)) {
                synchronized (this) {
                    UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
                    
                    if (intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)) {
                        if (device != null) {
                            notifyListeners("usbPermissionGranted", createDeviceObject(device));
                        }
                    } else {
                        notifyListeners("usbPermissionDenied", new JSObject());
                    }
                }
            }
        }
    };
    
    @Override
    public void load() {
        super.load();
        usbManager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
        
        // Registrar receiver para permissões USB
        IntentFilter filter = new IntentFilter(ACTION_USB_PERMISSION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(usbReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(usbReceiver, filter);
        }
    }
    
    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        try {
            getContext().unregisterReceiver(usbReceiver);
        } catch (Exception e) {
            // Receiver já desregistrado
        }
        
        if (connection != null) {
            connection.close();
            connection = null;
        }
    }
    
    /**
     * Listar dispositivos USB conectados
     */
    @PluginMethod
    public void listDevices(PluginCall call) {
        try {
            HashMap<String, UsbDevice> deviceList = usbManager.getDeviceList();
            JSArray devices = new JSArray();
            
            for (UsbDevice device : deviceList.values()) {
                devices.put(createDeviceObject(device));
            }
            
            JSObject result = new JSObject();
            result.put("devices", devices);
            result.put("count", devices.length());
            
            call.resolve(result);
            
        } catch (Exception e) {
            JSObject error = new JSObject();
            error.put("message", e.getMessage());
            call.reject("Erro ao listar dispositivos USB", error);
        }
    }
    
    /**
     * Detectar pinpad PPC930 ou similar
     */
    @PluginMethod
    public void detectPinpad(PluginCall call) {
        try {
            HashMap<String, UsbDevice> deviceList = usbManager.getDeviceList();
            
            // IDs conhecidos de pinpads
            final int POSITIVO_VENDOR_ID = 0x2BF9;
            final int PPC930_PRODUCT_ID = 0x0930;
            
            for (UsbDevice device : deviceList.values()) {
                // Verificar se é um pinpad conhecido
                if (device.getVendorId() == POSITIVO_VENDOR_ID || 
                    device.getProductId() == PPC930_PRODUCT_ID) {
                    
                    JSObject result = new JSObject();
                    result.put("detected", true);
                    result.put("deviceName", device.getDeviceName());
                    result.put("vendorId", String.format("0x%04X", device.getVendorId()));
                    result.put("productId", String.format("0x%04X", device.getProductId()));
                    result.put("message", "Pinpad detectado: " + device.getDeviceName());
                    
                    call.resolve(result);
                    return;
                }
            }
            
            // Nenhum pinpad encontrado
            JSObject result = new JSObject();
            result.put("detected", false);
            result.put("message", "Nenhum pinpad detectado");
            
            call.resolve(result);
            
        } catch (Exception e) {
            JSObject error = new JSObject();
            error.put("detected", false);
            error.put("message", "Erro ao detectar pinpad: " + e.getMessage());
            call.reject("Erro ao detectar pinpad", error);
        }
    }
    
    /**
     * Solicitar permissão para usar dispositivo USB
     */
    @PluginMethod
    public void requestPermission(PluginCall call) {
        try {
            String deviceName = call.getString("deviceName", "");
            
            if (deviceName.isEmpty()) {
                throw new Exception("Nome do dispositivo não fornecido");
            }
            
            HashMap<String, UsbDevice> deviceList = usbManager.getDeviceList();
            UsbDevice device = deviceList.get(deviceName);
            
            if (device == null) {
                throw new Exception("Dispositivo não encontrado: " + deviceName);
            }
            
            if (usbManager.hasPermission(device)) {
                JSObject result = new JSObject();
                result.put("granted", true);
                result.put("message", "Permissão já concedida");
                call.resolve(result);
                return;
            }
            
            // Solicitar permissão
            PendingIntent permissionIntent = PendingIntent.getBroadcast(
                getContext(), 
                0, 
                new Intent(ACTION_USB_PERMISSION),
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? 
                    PendingIntent.FLAG_MUTABLE : 
                    PendingIntent.FLAG_UPDATE_CURRENT
            );
            
            usbManager.requestPermission(device, permissionIntent);
            
            JSObject result = new JSObject();
            result.put("requested", true);
            result.put("message", "Solicitação de permissão enviada");
            
            call.resolve(result);
            
        } catch (Exception e) {
            JSObject error = new JSObject();
            error.put("granted", false);
            error.put("message", e.getMessage());
            call.reject("Erro ao solicitar permissão USB", error);
        }
    }
    
    /**
     * Conectar a um dispositivo USB
     */
    @PluginMethod
    public void connect(PluginCall call) {
        try {
            String deviceName = call.getString("deviceName", "");
            
            if (deviceName.isEmpty()) {
                throw new Exception("Nome do dispositivo não fornecido");
            }
            
            HashMap<String, UsbDevice> deviceList = usbManager.getDeviceList();
            UsbDevice device = deviceList.get(deviceName);
            
            if (device == null) {
                throw new Exception("Dispositivo não encontrado");
            }
            
            if (!usbManager.hasPermission(device)) {
                throw new Exception("Permissão USB não concedida");
            }
            
            connection = usbManager.openDevice(device);
            
            if (connection == null) {
                throw new Exception("Falha ao abrir dispositivo USB");
            }
            
            currentDevice = device;
            
            JSObject result = new JSObject();
            result.put("connected", true);
            result.put("message", "Conectado ao dispositivo USB");
            
            call.resolve(result);
            
        } catch (Exception e) {
            JSObject error = new JSObject();
            error.put("connected", false);
            error.put("message", e.getMessage());
            call.reject("Erro ao conectar USB", error);
        }
    }
    
    /**
     * Desconectar dispositivo USB
     */
    @PluginMethod
    public void disconnect(PluginCall call) {
        try {
            if (connection != null) {
                connection.close();
                connection = null;
                currentDevice = null;
            }
            
            JSObject result = new JSObject();
            result.put("disconnected", true);
            result.put("message", "Desconectado do dispositivo USB");
            
            call.resolve(result);
            
        } catch (Exception e) {
            JSObject error = new JSObject();
            error.put("message", e.getMessage());
            call.reject("Erro ao desconectar USB", error);
        }
    }
    
    // ========== MÉTODOS AUXILIARES ==========
    
    private JSObject createDeviceObject(UsbDevice device) {
        JSObject obj = new JSObject();
        obj.put("deviceName", device.getDeviceName());
        obj.put("vendorId", String.format("0x%04X", device.getVendorId()));
        obj.put("productId", String.format("0x%04X", device.getProductId()));
        obj.put("deviceClass", device.getDeviceClass());
        obj.put("deviceSubclass", device.getDeviceSubclass());
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            obj.put("manufacturerName", device.getManufacturerName());
            obj.put("productName", device.getProductName());
            obj.put("serialNumber", device.getSerialNumber());
        }
        
        return obj;
    }
}
