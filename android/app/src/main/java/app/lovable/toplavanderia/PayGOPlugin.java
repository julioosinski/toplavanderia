package app.lovable.toplavanderia;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import android.content.Context;
import android.util.Log;

@CapacitorPlugin(name = "PayGO")
public class PayGOPlugin extends Plugin {
    
    private static final String TAG = "PayGOPlugin";
    private PayGOManager paygoManager;
    
    @Override
    public void load() {
        paygoManager = new PayGOManager(getContext());
    }
    
    @PluginMethod
    public void initialize(PluginCall call) {
        String host = call.getString("host", "192.168.1.100");
        Integer port = call.getInt("port", 9999);
        String automationKey = call.getString("automationKey", "");
        
        try {
            boolean success = paygoManager.initialize(host, port, automationKey);
            JSObject result = new JSObject();
            result.put("success", success);
            result.put("message", success ? "PayGO initialized successfully" : "Failed to initialize PayGO");
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error initializing PayGO", e);
            call.reject("Failed to initialize PayGO: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void checkStatus(PluginCall call) {
        try {
            boolean isConnected = paygoManager.checkStatus();
            JSObject result = new JSObject();
            result.put("connected", isConnected);
            result.put("status", isConnected ? "connected" : "disconnected");
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error checking PayGO status", e);
            call.reject("Failed to check status: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void processPayment(PluginCall call) {
        String paymentType = call.getString("paymentType", "credit");
        Double amount = call.getDouble("amount", 0.0);
        String orderId = call.getString("orderId", "");
        
        try {
            JSObject result = paygoManager.processPayment(paymentType, amount, orderId);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error processing payment", e);
            call.reject("Failed to process payment: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void cancelTransaction(PluginCall call) {
        try {
            boolean success = paygoManager.cancelTransaction();
            JSObject result = new JSObject();
            result.put("success", success);
            result.put("message", success ? "Transaction cancelled" : "Failed to cancel transaction");
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error cancelling transaction", e);
            call.reject("Failed to cancel transaction: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void detectPinpad(PluginCall call) {
        try {
            JSObject result = paygoManager.detectPinpad();
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error detecting pinpad", e);
            call.reject("Failed to detect pinpad: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void getSystemStatus(PluginCall call) {
        try {
            JSObject result = paygoManager.getSystemStatus();
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error getting system status", e);
            call.reject("Failed to get system status: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void testConnection(PluginCall call) {
        try {
            JSObject result = paygoManager.testConnection();
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error testing connection", e);
            call.reject("Failed to test connection: " + e.getMessage());
        }
    }
}