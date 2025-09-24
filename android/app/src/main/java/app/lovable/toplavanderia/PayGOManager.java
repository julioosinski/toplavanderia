package app.lovable.toplavanderia;

import android.content.Context;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.util.Log;
import com.getcapacitor.JSObject;
import java.util.HashMap;

// PayGO Library Imports
import br.com.phoebus.android.payments.api.Credentials;
import br.com.phoebus.android.payments.api.PaymentClient;
import br.com.phoebus.android.payments.api.PaymentRequest;
import br.com.phoebus.android.payments.api.PaymentResponse;
import br.com.phoebus.android.payments.api.PaymentStatus;
import br.com.phoebus.android.payments.api.exception.ClientException;

public class PayGOManager {
    
    private static final String TAG = "PayGOManager";
    private Context context;
    private UsbManager usbManager;
    private boolean isInitialized = false;
    private String currentHost;
    private int currentPort;
    private String automationKey;
    
    // PayGO Client
    private PaymentClient paymentClient;
    private Credentials credentials;
    
    // PPC930 Device IDs
    private static final int PPC930_VENDOR_ID_1 = PayGOConfig.PPC930_VENDOR_ID_PRIMARY;
    private static final int PPC930_PRODUCT_ID_1 = PayGOConfig.PPC930_PRODUCT_ID_PRIMARY;
    private static final int PPC930_VENDOR_ID_2 = PayGOConfig.PPC930_VENDOR_ID_SECONDARY;
    private static final int PPC930_PRODUCT_ID_2 = PayGOConfig.PPC930_PRODUCT_ID_SECONDARY;
    
    public PayGOManager(Context context) {
        this.context = context;
        this.usbManager = (UsbManager) context.getSystemService(Context.USB_SERVICE);
    }
    
    public boolean initialize(String host, int port, String automationKey) {
        try {
            this.currentHost = host;
            this.currentPort = port;
            this.automationKey = automationKey;
            
            // Initialize PayGO credentials
            this.credentials = new Credentials();
            this.credentials.setLogicNumber("1");
            this.credentials.setSerial("PPC930");
            this.credentials.setAutomationKey(automationKey);
            
            // Initialize PayGO client
            this.paymentClient = new PaymentClient();
            this.paymentClient.bind(context);
            
            Log.i(TAG, "PayGO initialized successfully with host: " + host + ", port: " + port);
            
            this.isInitialized = true;
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize PayGO", e);
            return false;
        }
    }
    
    public boolean checkStatus() {
        if (!isInitialized) {
            return false;
        }
        
        try {
            // Check both USB connection and network connectivity
            boolean usbConnected = detectPPC930();
            // Add network connectivity check here if needed
            
            Log.i(TAG, "PayGO status check - USB: " + usbConnected);
            return usbConnected;
        } catch (Exception e) {
            Log.e(TAG, "Error checking PayGO status", e);
            return false;
        }
    }
    
    public JSObject processPayment(String paymentType, double amount, String orderId) {
        JSObject result = new JSObject();
        
        if (!isInitialized) {
            result.put("success", false);
            result.put("message", "PayGO not initialized");
            return result;
        }
        
        // Validate input parameters
        if (!PayGOConfig.isValidAmount(amount)) {
            result.put("success", false);
            result.put("message", "Invalid amount. Must be between " + PayGOConfig.MIN_AMOUNT + " and " + PayGOConfig.MAX_AMOUNT);
            return result;
        }
        
        if (!PayGOConfig.isValidOrderId(orderId)) {
            result.put("success", false);
            result.put("message", "Invalid order ID. Must not be empty and max " + PayGOConfig.MAX_ORDER_ID_LENGTH + " characters");
            return result;
        }
        
        try {
            // Create PayGO payment request
            PaymentRequest paymentRequest = new PaymentRequest();
            paymentRequest.setAmount(PayGOConfig.amountToCents(amount)); // Amount in cents
            paymentRequest.setOrderId(orderId);
            
            // Set payment type
            switch (paymentType.toLowerCase()) {
                case "credit":
                    paymentRequest.setPaymentType(PayGOConfig.PAYMENT_TYPE_CREDIT);
                    break;
                case "debit":
                    paymentRequest.setPaymentType(PayGOConfig.PAYMENT_TYPE_DEBIT);
                    break;
                case "pix":
                    paymentRequest.setPaymentType(PayGOConfig.PAYMENT_TYPE_PIX);
                    break;
                default:
                    result.put("success", false);
                    result.put("message", "Invalid payment type: " + paymentType);
                    return result;
            }
            
            Log.i(TAG, "Processing " + paymentType + " payment for amount: " + amount);
            
            // Process payment with PayGO library
            PaymentResponse paymentResponse = paymentClient.startPaymentV2(paymentRequest, credentials);
            
            result.put("success", paymentResponse.getResponseCode() == PaymentResponse.SUCCESS);
            result.put("paymentType", paymentType);
            result.put("amount", amount);
            result.put("orderId", orderId);
            result.put("transactionId", paymentResponse.getTransactionId());
            result.put("timestamp", System.currentTimeMillis());
            
            if (paymentResponse.getResponseCode() == PaymentResponse.SUCCESS) {
                result.put("message", "Payment processed successfully");
                result.put("status", "approved");
                result.put("nsu", paymentResponse.getAuthorisationCode());
                result.put("authorizationCode", paymentResponse.getAuthorisationCode());
            } else {
                result.put("message", paymentResponse.getResponseText());
                result.put("status", "denied");
            }
            
        } catch (ClientException e) {
            Log.e(TAG, "PayGO ClientException", e);
            result.put("success", false);
            result.put("message", "PayGO error: " + e.getMessage());
            result.put("status", "error");
        } catch (Exception e) {
            Log.e(TAG, "Error processing payment", e);
            result.put("success", false);
            result.put("message", "Payment processing error: " + e.getMessage());
            result.put("status", "error");
        }
        
        return result;
    }
    
    public boolean cancelTransaction() {
        if (!isInitialized) {
            return false;
        }
        
        try {
            // Cancel transaction with PayGO library
            Log.i(TAG, "Cancelling current transaction");
            PaymentResponse cancelResponse = paymentClient.abort(credentials);
            
            boolean success = cancelResponse.getResponseCode() == PaymentResponse.SUCCESS;
            Log.i(TAG, "Transaction cancellation result: " + success);
            
            return success;
        } catch (ClientException e) {
            Log.e(TAG, "PayGO ClientException during cancellation", e);
            return false;
        } catch (Exception e) {
            Log.e(TAG, "Error cancelling transaction", e);
            return false;
        }
    }
    
    public JSObject detectPinpad() {
        JSObject result = new JSObject();
        
        try {
            boolean detected = detectPPC930();
            UsbDevice ppc930Device = findPPC930Device();
            
            result.put("detected", detected);
            result.put("deviceName", detected ? "PPC930" : "Not found");
            
            if (ppc930Device != null) {
                result.put("vendorId", ppc930Device.getVendorId());
                result.put("productId", ppc930Device.getProductId());
                result.put("deviceId", ppc930Device.getDeviceId());
                result.put("serialNumber", ppc930Device.getSerialNumber());
            }
            
            Log.i(TAG, "PPC930 detection result: " + detected);
            
        } catch (Exception e) {
            Log.e(TAG, "Error detecting PPC930", e);
            result.put("detected", false);
            result.put("error", e.getMessage());
        }
        
        return result;
    }
    
    private boolean detectPPC930() {
        return findPPC930Device() != null;
    }
    
    private UsbDevice findPPC930Device() {
        if (usbManager == null) {
            return null;
        }
        
        HashMap<String, UsbDevice> deviceList = usbManager.getDeviceList();
        
        for (UsbDevice device : deviceList.values()) {
            int vendorId = device.getVendorId();
            int productId = device.getProductId();
            
            // Check for known PPC930 vendor/product ID combinations
            if ((vendorId == PPC930_VENDOR_ID_1 && productId == PPC930_PRODUCT_ID_1) ||
                (vendorId == PPC930_VENDOR_ID_2 && productId == PPC930_PRODUCT_ID_2)) {
                Log.i(TAG, "Found PPC930 device: " + device.getDeviceName());
                return device;
            }
        }
        
        return null;
    
    /**
     * Gets detailed PayGO system status including library version and device info
     */
    public JSObject getSystemStatus() {
        JSObject status = new JSObject();
        
        try {
            status.put("initialized", isInitialized);
            status.put("host", currentHost);
            status.put("port", currentPort);
            
            if (isInitialized && paymentClient != null) {
                status.put("clientConnected", true);
                status.put("libraryVersion", "PayGO v2.1.0.6");
            } else {
                status.put("clientConnected", false);
            }
            
            // Check USB device status
            boolean usbDetected = detectPPC930();
            status.put("usbDeviceDetected", usbDetected);
            
            if (usbDetected) {
                UsbDevice device = findPPC930Device();
                if (device != null) {
                    status.put("deviceInfo", new JSObject()
                        .put("vendorId", device.getVendorId())
                        .put("productId", device.getProductId())
                        .put("deviceName", device.getDeviceName())
                        .put("serialNumber", device.getSerialNumber()));
                }
            }
            
            status.put("timestamp", System.currentTimeMillis());
            
        } catch (Exception e) {
            Log.e(TAG, "Error getting system status", e);
            status.put("error", e.getMessage());
        }
        
        return status;
    }
    
    /**
     * Tests the PayGO connection and returns detailed results
     */
    public JSObject testConnection() {
        JSObject result = new JSObject();
        
        if (!isInitialized) {
            result.put("success", false);
            result.put("message", "PayGO not initialized");
            return result;
        }
        
        try {
            // Test USB connection
            boolean usbConnected = detectPPC930();
            result.put("usbConnection", usbConnected);
            
            // Test PayGO client
            if (paymentClient != null) {
                result.put("clientStatus", "connected");
                result.put("success", usbConnected);
                result.put("message", usbConnected ? "PayGO connection test successful" : "PPC930 device not detected");
            } else {
                result.put("clientStatus", "disconnected");
                result.put("success", false);
                result.put("message", "PayGO client not initialized");
            }
            
            result.put("timestamp", System.currentTimeMillis());
            
        } catch (Exception e) {
            Log.e(TAG, "Error testing PayGO connection", e);
            result.put("success", false);
            result.put("message", "Connection test failed: " + e.getMessage());
        }
        
        return result;
    }
}