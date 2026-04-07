package app.lovable.toplavanderia;

/**
 * Unified payment callback interface used by all payment managers
 * (RealPayGoManager, CieloLioManager, etc.)
 */
public interface PaymentCallback {
    void onPaymentSuccess(String authorizationCode, String transactionId);
    void onPaymentError(String error);
    void onPaymentProcessing(String message);
}
