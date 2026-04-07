package app.lovable.toplavanderia;

import android.content.Context;
import android.util.Log;

import java.util.UUID;

/**
 * Cielo LIO payment manager — placeholder until SDK is added to build.gradle.
 * See android/app/.../CieloLioManager.java for full documentation.
 */
public class CieloLioManager implements PaymentManager {
    private static final String TAG = "CieloLioManager";

    private final Context context;
    private PaymentCallback callback;
    private boolean isProcessing;
    private boolean isInitialized;
    private String clientId;
    private String accessToken;
    private String merchantCode;
    private String environment;

    public CieloLioManager(Context context) {
        this.context = context;
        this.isProcessing = false;
        this.isInitialized = false;
    }

    public void configure(String clientId, String accessToken, String merchantCode, String environment) {
        this.clientId = clientId;
        this.accessToken = accessToken;
        this.merchantCode = merchantCode;
        this.environment = (environment != null) ? environment : "sandbox";
        Log.d(TAG, "Configured: merchant=" + merchantCode + " env=" + this.environment);
    }

    @Override
    public void setCallback(PaymentCallback callback) { this.callback = callback; }

    @Override
    public boolean isProcessing() { return isProcessing; }

    @Override
    public boolean isInitialized() { return isInitialized; }

    @Override
    public void processPayment(double amount, String paymentType, String description, String orderId) {
        if (isProcessing) { if (callback != null) callback.onPaymentError("Já há transação em processamento"); return; }
        if (!isInitialized) {
            String msg = (clientId == null || clientId.isEmpty())
                ? "Configure as credenciais Cielo nas configurações do sistema."
                : "SDK Cielo LIO precisa ser adicionado ao build.gradle.";
            if (callback != null) callback.onPaymentError("Cielo LIO indisponível: " + msg);
            return;
        }
        isProcessing = false;
        if (callback != null) callback.onPaymentError("Cielo LIO SDK não implementado no build atual.");
    }

    @Override
    public void cancelPayment() {
        if (isProcessing) { isProcessing = false; if (callback != null) callback.onPaymentError("Cielo cancelada"); }
    }
}
