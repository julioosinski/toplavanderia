package app.lovable.toplavanderia;

/**
 * PayGO Configuration Constants
 * Contains all necessary configuration parameters for PayGO integration
 */
public class PayGOConfig {
    
    // Default PayGO Settings
    public static final String DEFAULT_HOST = "192.168.1.100";
    public static final int DEFAULT_PORT = 3000;
    public static final String DEFAULT_LOGIC_NUMBER = "1";
    public static final String DEFAULT_SERIAL = "PPC930";
    
    // Payment Types
    public static final int PAYMENT_TYPE_CREDIT = 1;
    public static final int PAYMENT_TYPE_DEBIT = 2;
    public static final int PAYMENT_TYPE_PIX = 3;
    
    // Response Codes
    public static final int SUCCESS = 0;
    public static final int ERROR_DEVICE_NOT_FOUND = -1;
    public static final int ERROR_PAYMENT_CANCELLED = -2;
    public static final int ERROR_INVALID_AMOUNT = -3;
    public static final int ERROR_CONNECTION_FAILED = -4;
    public static final int ERROR_AUTHENTICATION_FAILED = -5;
    
    // Timeout Settings (in milliseconds)
    public static final int CONNECTION_TIMEOUT = 30000; // 30 seconds
    public static final int PAYMENT_TIMEOUT = 120000;   // 2 minutes
    public static final int CANCELLATION_TIMEOUT = 10000; // 10 seconds
    
    // PPC930 USB Device IDs
    public static final int PPC930_VENDOR_ID_PRIMARY = 8137;
    public static final int PPC930_PRODUCT_ID_PRIMARY = 5169;
    public static final int PPC930_VENDOR_ID_SECONDARY = 1027;
    public static final int PPC930_PRODUCT_ID_SECONDARY = 24577;
    
    // Validation Constants
    public static final double MIN_AMOUNT = 0.01;
    public static final double MAX_AMOUNT = 99999.99;
    public static final int MAX_ORDER_ID_LENGTH = 50;
    
    /**
     * Validates if an amount is within acceptable limits
     */
    public static boolean isValidAmount(double amount) {
        return amount >= MIN_AMOUNT && amount <= MAX_AMOUNT;
    }
    
    /**
     * Validates if an order ID is acceptable
     */
    public static boolean isValidOrderId(String orderId) {
        return orderId != null && 
               !orderId.trim().isEmpty() && 
               orderId.length() <= MAX_ORDER_ID_LENGTH;
    }
    
    /**
     * Converts amount to cents (PayGO expects amount in cents)
     */
    public static int amountToCents(double amount) {
        return (int) Math.round(amount * 100);
    }
    
    /**
     * Converts cents to amount
     */
    public static double centsToAmount(int cents) {
        return cents / 100.0;
    }
}