package app.lovable.toplavanderia;

/**
 * Unified interface for payment managers (PayGo, Cielo LIO, etc.)
 */
public interface PaymentManager {
    void setCallback(PaymentCallback callback);
    void processPayment(double amount, String paymentType, String description, String orderId);
    void cancelPayment();
    boolean isProcessing();
    boolean isInitialized();
}
