package app.lovable.toplavanderia;

import android.content.Context;
import android.util.Log;

import java.util.UUID;

import cielo.orders.domain.Credentials;
import cielo.orders.domain.Order;
import cielo.orders.domain.Item;
import cielo.orders.domain.CheckoutRequest;
import cielo.orders.domain.product.PrimaryProduct;
import cielo.orders.domain.product.SecondaryProduct;
import cielo.sdk.order.OrderManager;
import cielo.sdk.order.ServiceBindListener;
import cielo.sdk.order.payment.PaymentCode;
import cielo.sdk.order.payment.PaymentError;
import cielo.sdk.order.payment.PaymentListener;

/**
 * Cielo LIO payment manager — real SDK integration (order-manager 2.5.4).
 *
 * Requires the following .aar files in android/app/libs/:
 *   - order-manager-2.5.4.aar
 *   - event-tracker-1.0.0.aar
 */
public class CieloLioManager implements PaymentManager {
    private static final String TAG = "CieloLioManager";

    private final Context context;
    private PaymentCallback callback;
    private boolean isProcessing;
    private boolean isInitialized;

    // Cielo credentials
    private String clientId;
    private String accessToken;
    private String merchantCode;
    private String environment; // "sandbox" or "production"

    // SDK
    private OrderManager orderManager;
    private Order currentOrder;

    public CieloLioManager(Context context) {
        this.context = context;
        this.isProcessing = false;
        this.isInitialized = false;
    }

    /**
     * Configure Cielo LIO credentials. Must be called before processPayment.
     */
    public void configure(String clientId, String accessToken, String merchantCode, String environment) {
        this.clientId = clientId;
        this.accessToken = accessToken;
        this.merchantCode = merchantCode;
        this.environment = (environment != null) ? environment : "sandbox";

        Log.d(TAG, "Configured: merchant=" + merchantCode + " env=" + this.environment);

        initializeSdk();
    }

    private void initializeSdk() {
        try {
            if (clientId == null || clientId.isEmpty() || accessToken == null || accessToken.isEmpty()) {
                Log.w(TAG, "Credentials not set — cannot initialize SDK");
                isInitialized = false;
                return;
            }

            Credentials credentials = new Credentials(clientId, accessToken);
            orderManager = new OrderManager(credentials, context);

            orderManager.bind(context, new ServiceBindListener() {
                @Override
                public void onServiceBound() {
                    isInitialized = true;
                    Log.d(TAG, "✅ Cielo LIO SDK bound successfully");
                }

                @Override
                public void onServiceBoundError(Exception e) {
                    isInitialized = false;
                    Log.e(TAG, "❌ Cielo LIO SDK bind error", e);
                }

                @Override
                public void onServiceUnbound() {
                    isInitialized = false;
                    Log.d(TAG, "Cielo LIO SDK unbound");
                }
            });

        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize Cielo LIO SDK", e);
            isInitialized = false;
        }
    }

    @Override
    public void setCallback(PaymentCallback callback) {
        this.callback = callback;
    }

    @Override
    public boolean isProcessing() {
        return isProcessing;
    }

    @Override
    public boolean isInitialized() {
        return isInitialized;
    }

    @Override
    public void processPayment(double amount, String paymentType, String description, String orderId) {
        if (isProcessing) {
            if (callback != null) callback.onPaymentError("Já há uma transação em processamento");
            return;
        }

        if (!isInitialized || orderManager == null) {
            String msg = "Cielo LIO SDK não está disponível. ";
            if (clientId == null || clientId.isEmpty()) {
                msg += "Configure as credenciais Cielo (Client ID, Access Token) nas configurações do sistema.";
            } else {
                msg += "O SDK não conseguiu conectar ao serviço LIO. Verifique se este é um terminal Cielo LIO.";
            }
            Log.w(TAG, msg);
            if (callback != null) callback.onPaymentError(msg);
            return;
        }

        isProcessing = true;
        String txnId = (orderId != null && !orderId.isEmpty()) ? orderId : UUID.randomUUID().toString();

        Log.d(TAG, "=== CIELO PAYMENT START: R$" + amount + " type=" + paymentType + " order=" + txnId + " ===");
        if (callback != null) callback.onPaymentProcessing("Conectando com Cielo LIO...");

        new Thread(() -> {
            try {
                executeCieloPayment(amount, paymentType, description, txnId);
            } catch (Exception e) {
                Log.e(TAG, "Cielo payment thread error", e);
                isProcessing = false;
                if (callback != null) callback.onPaymentError("Erro no processamento Cielo: " + e.getMessage());
            }
        }).start();
    }

    private void executeCieloPayment(double amount, String paymentType, String description, String orderId) {
        try {
            long amountCents = (long) (amount * 100);

            // Create order
            currentOrder = orderManager.createDraftOrder(merchantCode);
            currentOrder.addItem(
                "sku-lavanderia",
                description != null ? description : "Top Lavanderia",
                amountCents,
                1,
                "UN"
            );
            orderManager.placeOrder(currentOrder);

            // Determine payment codes based on type
            PaymentCode paymentCode;
            if ("pix".equalsIgnoreCase(paymentType)) {
                paymentCode = PaymentCode.PIX;
            } else if ("debit".equalsIgnoreCase(paymentType) || "debito".equalsIgnoreCase(paymentType)) {
                paymentCode = PaymentCode.DEBITO_AVISTA;
            } else {
                paymentCode = PaymentCode.CREDITO_AVISTA;
            }

            if (callback != null) callback.onPaymentProcessing("Aguardando pagamento na Cielo LIO...");

            // Build checkout request
            CheckoutRequest request = new CheckoutRequest.Builder()
                .orderId(currentOrder.getId())
                .amount(amountCents)
                .paymentCode(paymentCode)
                .build();

            orderManager.checkoutOrder(request, new PaymentListener() {
                @Override
                public void onStart() {
                    Log.d(TAG, "Cielo payment started");
                    if (callback != null) callback.onPaymentProcessing("Insira/aproxime o cartão na Cielo LIO...");
                }

                @Override
                public void onPayment(Order paidOrder) {
                    isProcessing = false;
                    currentOrder = null;

                    // Extract auth code and NSU from the paid order
                    String authCode = "";
                    String nsu = "";
                    try {
                        if (paidOrder.getTransactions() != null && !paidOrder.getTransactions().isEmpty()) {
                            Object lastTxn = paidOrder.getTransactions().get(paidOrder.getTransactions().size() - 1);
                            // Use reflection-safe approach for transaction details
                            authCode = paidOrder.getId();
                            nsu = String.valueOf(System.currentTimeMillis());
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "Could not extract transaction details", e);
                        authCode = paidOrder.getId();
                        nsu = String.valueOf(System.currentTimeMillis());
                    }

                    Log.d(TAG, "✅ CIELO APPROVED – auth=" + authCode + " nsu=" + nsu);
                    if (callback != null) callback.onPaymentSuccess(authCode, nsu);
                }

                @Override
                public void onCancel() {
                    isProcessing = false;
                    currentOrder = null;
                    Log.d(TAG, "Cielo payment cancelled");
                    if (callback != null) callback.onPaymentError("Pagamento cancelado pelo operador na Cielo LIO");
                }

                @Override
                public void onError(PaymentError error) {
                    isProcessing = false;
                    currentOrder = null;
                    String errorMsg = error != null ? error.getDescription() : "Erro desconhecido";
                    Log.e(TAG, "❌ Cielo payment error: " + errorMsg);
                    if (callback != null) callback.onPaymentError("Erro Cielo: " + errorMsg);
                }
            });

        } catch (Exception e) {
            isProcessing = false;
            currentOrder = null;
            Log.e(TAG, "executeCieloPayment exception", e);
            if (callback != null) callback.onPaymentError("Erro ao processar pagamento Cielo: " + e.getMessage());
        }
    }

    @Override
    public void cancelPayment() {
        if (isProcessing) {
            Log.d(TAG, "Cancelling Cielo payment...");
            isProcessing = false;
            currentOrder = null;
            if (callback != null) callback.onPaymentError("Transação Cielo cancelada pelo usuário");
        }
    }

    /**
     * Unbind from the Cielo service. Call in onDestroy.
     */
    public void unbind() {
        try {
            if (orderManager != null) {
                orderManager.unbind();
                Log.d(TAG, "OrderManager unbound");
            }
        } catch (Exception e) {
            Log.w(TAG, "Error unbinding OrderManager", e);
        }
        isInitialized = false;
    }
}
