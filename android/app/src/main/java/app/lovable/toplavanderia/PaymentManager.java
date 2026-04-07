package app.lovable.toplavanderia;

/**
 * Unified interface for payment managers (PayGo, Cielo LIO, etc.)
 * Each provider implements this interface so PayGOPlugin can route
 * without provider-specific if/else logic.
 */
public interface PaymentManager {
    void setCallback(PaymentCallback callback);
    void processPayment(double amount, String paymentType, String description, String orderId);
    void cancelPayment();
    boolean isProcessing();
    boolean isInitialized();
}
