package app.lovable.toplavanderia;

import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.HashMap;

/**
 * Capacitor plugin that bridges React/JS ↔ RealPayGoManager (InterfaceAutomacao).
 * 
 * NO HTTP calls. All payment processing goes through the real PayGo library
 * which communicates with the PPC930 pinpad via the PayGo Integrado APK.
 */
@CapacitorPlugin(name = "PayGO")
public class PayGOPlugin extends Plugin {
    private static final String TAG = "PayGOPlugin";

    private RealPayGoManager payGoManager;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    public void load() {
        super.load();
        Log.d(TAG, "PayGOPlugin loaded – creating RealPayGoManager");
        payGoManager = new RealPayGoManager(getContext());
    }

    // ==================== PLUGIN METHODS ====================

    @PluginMethod
    public void initialize(PluginCall call) {
        try {
            // RealPayGoManager auto-initializes in constructor, but we can
            // re-initialize if config changed
            if (!payGoManager.isInitialized()) {
                // Try re-creating the manager
                payGoManager = new RealPayGoManager(getContext());
            }

            JSObject result = new JSObject();
            result.put("success", payGoManager.isInitialized());
            result.put("message", payGoManager.isInitialized()
                    ? "PayGO inicializado com sucesso (InterfaceAutomacao)"
                    : "Falha ao inicializar PayGO. Verifique se o PayGo Integrado está instalado.");
            call.resolve(result);

        } catch (Exception e) {
            Log.e(TAG, "Error in initialize", e);
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("message", "Erro ao inicializar: " + e.getMessage());
            call.resolve(result);
        }
    }

    @PluginMethod
    public void checkStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("initialized", payGoManager.isInitialized());
        result.put("processing", payGoManager.isProcessing());
        result.put("connected", payGoManager.isInitialized());
        result.put("online", payGoManager.isInitialized());
        result.put("status", payGoManager.isInitialized() ? "ready" : "not_initialized");
        call.resolve(result);
    }

    @PluginMethod
    public void processPayment(PluginCall call) {
        try {
            double amount = call.getDouble("amount", 0.0);
            String paymentType = call.getString("paymentType", "credit");
            String orderId = call.getString("orderId", "");
            String description = call.getString("description", "Top Lavanderia");

            if (amount <= 0) {
                JSObject err = new JSObject();
                err.put("success", false);
                err.put("message", "Valor inválido");
                err.put("status", "error");
                call.resolve(err);
                return;
            }

            if (!payGoManager.isInitialized()) {
                JSObject err = new JSObject();
                err.put("success", false);
                err.put("message", "PayGO não inicializado. Instale o PayGo Integrado.");
                err.put("status", "error");
                call.resolve(err);
                return;
            }

            if (payGoManager.isProcessing()) {
                JSObject err = new JSObject();
                err.put("success", false);
                err.put("message", "Já há uma transação em processamento");
                err.put("status", "error");
                call.resolve(err);
                return;
            }

            Log.d(TAG, "processPayment: amount=" + amount + " type=" + paymentType + " order=" + orderId);

            // Set callback that resolves the Capacitor call
            payGoManager.setCallback(new RealPayGoManager.PayGoCallback() {
                @Override
                public void onPaymentSuccess(String authorizationCode, String transactionId) {
                    mainHandler.post(() -> {
                        JSObject result = new JSObject();
                        result.put("success", true);
                        result.put("message", "Pagamento aprovado");
                        result.put("status", "approved");
                        result.put("authorizationCode", authorizationCode);
                        result.put("transactionId", transactionId);
                        result.put("orderId", orderId);
                        result.put("amount", amount);
                        result.put("paymentType", paymentType);
                        call.resolve(result);

                        // Also notify JS listeners
                        notifyListeners("paymentSuccess", result);
                    });
                }

                @Override
                public void onPaymentError(String error) {
                    mainHandler.post(() -> {
                        JSObject result = new JSObject();
                        result.put("success", false);
                        result.put("message", error);
                        result.put("status", "denied");
                        result.put("orderId", orderId);
                        result.put("amount", amount);
                        result.put("paymentType", paymentType);
                        call.resolve(result);

                        JSObject event = new JSObject();
                        event.put("error", error);
                        event.put("message", error);
                        notifyListeners("paymentError", event);
                    });
                }

                @Override
                public void onPaymentProcessing(String message) {
                    mainHandler.post(() -> {
                        JSObject event = new JSObject();
                        event.put("message", message);
                        event.put("processing", true);
                        notifyListeners("paymentProcessing", event);
                    });
                }
            });

            // Delegate to RealPayGoManager (runs on background thread internally)
            payGoManager.processPayment(amount, paymentType, description, orderId);

        } catch (Exception e) {
            Log.e(TAG, "Error in processPayment", e);
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("message", "Erro no pagamento: " + e.getMessage());
            result.put("status", "error");
            call.resolve(result);
        }
    }

    @PluginMethod
    public void cancelPayment(PluginCall call) {
        payGoManager.cancelPayment();
        JSObject result = new JSObject();
        result.put("success", true);
        result.put("message", "Pagamento cancelado");
        call.resolve(result);
    }

    @PluginMethod
    public void cancelTransaction(PluginCall call) {
        // For now, just cancel any in-progress payment
        payGoManager.cancelPayment();
        JSObject result = new JSObject();
        result.put("success", true);
        result.put("message", "Transação cancelada");
        call.resolve(result);
    }

    @PluginMethod
    public void testPayGo(PluginCall call) {
        JSObject result = new JSObject();
        result.put("success", payGoManager.isInitialized());
        result.put("message", payGoManager.isInitialized()
                ? "PayGo inicializado – InterfaceAutomacao REAL ativa"
                : "PayGo NÃO inicializado – verifique PayGo Integrado APK");
        call.resolve(result);
    }

    @PluginMethod
    public void getSystemStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("initialized", payGoManager.isInitialized());
        result.put("online", payGoManager.isInitialized());
        result.put("clientConnected", payGoManager.isInitialized());
        result.put("usbDeviceDetected", detectUsbPinpad());
        result.put("libraryVersion", "InterfaceAutomacao-v2.1.0.6");
        result.put("timestamp", System.currentTimeMillis());
        call.resolve(result);
    }

    @PluginMethod
    public void testConnection(PluginCall call) {
        JSObject result = new JSObject();
        result.put("success", payGoManager.isInitialized());
        result.put("message", payGoManager.isInitialized()
                ? "Conexão OK – InterfaceAutomacao ativa"
                : "Falha – PayGo Integrado não disponível");
        call.resolve(result);
    }

    @PluginMethod
    public void detectPinpad(PluginCall call) {
        boolean detected = detectUsbPinpad();
        JSObject result = new JSObject();
        result.put("detected", detected);
        result.put("message", detected ? "Pinpad USB detectado" : "Nenhum pinpad USB detectado");
        call.resolve(result);
    }

    // ==================== HELPERS ====================

    private boolean detectUsbPinpad() {
        try {
            UsbManager usbManager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
            if (usbManager == null) return false;

            HashMap<String, UsbDevice> devices = usbManager.getDeviceList();
            for (UsbDevice device : devices.values()) {
                int vid = device.getVendorId();
                int pid = device.getProductId();
                // Known pinpad vendor/product IDs
                if (vid == 0x1FC9 || vid == 0x0403 || vid == 0x0483 ||
                    vid == 0x2BF9 || vid == 0x2C09 || vid == 0x0451) {
                    return true;
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error detecting USB pinpad", e);
        }
        return false;
    }
}
