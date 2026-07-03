package app.lovable.toplavanderia;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Cielo Smart integration via Deep Link (UriApp), compatible with Cielo Emulator.
 *
 * Flow:
 * - Build payment payload
 * - Open lio://payment?... with callback order://response
 * - Handle callback in CieloResponseActivity and dispatch to this manager
 */
public class CieloLioManager implements PaymentManager {
    private static final String TAG = "CieloLioManager";
    private static CieloLioManager activeInstance;
    private static String lastConsumedCallbackSignature;
    private static long lastConsumedCallbackAtMs;
    private static long lastDeepLinkLaunchAtMs;
    private static long cieloCooldownUntilMs;
    private static final long MIN_MS_BETWEEN_DEEP_LINKS = 4000L;
    private static final long MIN_MS_BETWEEN_SUCCESSIVE_PAYMENTS = 2000L;
    private static final long COOLDOWN_AFTER_4281_MS = 15000L;
    /** Sem callback Cielo — só avisa após 3 min (não libera antes: evita -4281). */
    private static final long PROCESSING_WATCHDOG_MS = 180000L;
    private static final long REVERSAL_CALLBACK_TIMEOUT_MS = 120_000L;
    private static long lastSuccessfulPaymentAtMs;
    private static Runnable pendingEndSessionRunnable;
    private static int pendingEndSessionId;
    private static final Handler END_SESSION_HANDLER = new Handler(Looper.getMainLooper());
    private static final String PREFS_CHECKOUT = "cielo_checkout_binding";
    private static final String KEY_BOUND_OPERATION = "operation_id";
    private static final String KEY_BOUND_MACHINE = "machine_id";
    private static final String KEY_BOUND_TX = "pending_tx_id";
    private static final String KEY_BOUND_STARTED = "started_at";

    public static void cancelScheduledEndSession() {
        if (pendingEndSessionRunnable != null) {
            END_SESSION_HANDLER.removeCallbacks(pendingEndSessionRunnable);
            pendingEndSessionRunnable = null;
        }
    }

    private final Context context;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private Runnable processingWatchdogRunnable;
    private PaymentCallback callback;
    private boolean isProcessing;
    private boolean isInitialized;

    private String clientId;
    private String accessToken;
    private String merchantCode;
    private String environment;
    private String pendingReference;
    private long pendingAmountCents;
    private String pendingPaymentCode;
    private String pendingCloudOrderId;
    private String lastConfiguredSignature;
    /** credit | pix | card — inferido do retorno Cielo para alinhar Supabase/recibo. */
    private volatile String lastDetectedSupabasePaymentMethod;
    private long boundTotemOperationId;
    private String boundMachineId;
    private String boundPendingTxId;
    private volatile boolean successDelivered;
    /** Garante que o fechamento do pedido pago roda uma única vez por checkout (deep link ou broadcast). */
    private volatile boolean paidOrderCleanupDone;
    private ApprovedPaymentSnapshot lastApprovedPayment;
    private static volatile ReversalWaitState pendingReversal;

    public static final class ApprovedPaymentSnapshot {
        public final String paymentId;
        public final String authCode;
        public final String cieloCode;
        public final long amountCents;

        ApprovedPaymentSnapshot(String paymentId, String authCode, String cieloCode, long amountCents) {
            this.paymentId = paymentId == null ? "" : paymentId;
            this.authCode = authCode == null ? "" : authCode;
            this.cieloCode = cieloCode == null ? "" : cieloCode;
            this.amountCents = amountCents;
        }
    }

    private static final class ReversalWaitState {
        final CountDownLatch latch = new CountDownLatch(1);
        volatile boolean success;
        volatile String errorMessage = "";
    }

    public CieloLioManager(Context context) {
        this.context = context;
        this.isProcessing = false;
        this.isInitialized = false;
        CieloOrderJanitor.loadLearnedMerchantId(context);
    }

    public void configure(String clientId, String accessToken, String merchantCode, String environment) {
        String nextClientId = safe(clientId);
        String nextAccessToken = safe(accessToken);
        String nextMerchantCode = safe(merchantCode);
        String nextEnvironment = (environment != null && !environment.isEmpty()) ? environment : "sandbox";
        String signature = nextClientId + "|" + nextAccessToken + "|" + nextMerchantCode + "|" + nextEnvironment;
        boolean credentialsUnchanged = signature.equals(lastConfiguredSignature)
            && !nextClientId.isEmpty() && !nextAccessToken.isEmpty();

        this.clientId = nextClientId;
        this.accessToken = nextAccessToken;
        this.merchantCode = nextMerchantCode;
        this.environment = nextEnvironment;

        // Deep link only requires credentials locally to build request.
        this.isInitialized = !this.clientId.isEmpty() && !this.accessToken.isEmpty();
        if (credentialsUnchanged) {
            return;
        }
        lastConfiguredSignature = signature;

        if (looksLikeUuidMerchantCode(this.merchantCode)) {
            Log.e(TAG, "merchantCode parece UUID/lavanderia — use o código EC numérico da Cielo (painel Admin → Configurações)");
        }
        if ("sandbox".equalsIgnoreCase(this.environment)) {
            Log.w(TAG, "cielo_environment=sandbox em terminal de produção costuma falhar — use production + token de produção");
        }

        Log.d(TAG, "Configured Deep Link Cielo: merchant=" + this.merchantCode + " env=" + this.environment
            + " initialized=" + this.isInitialized);

        if (isInitialized) {
            final String cId = this.clientId;
            final String cToken = this.accessToken;
            final String cMerchant = merchantCodeForJanitor();
            final String cEnv = this.environment;
            new Thread(() -> {
                int n = CieloOrderJanitor.closeOpenOrdersQuick(
                    cId, cToken, cMerchant, CieloOrderJanitor.resolveEnvironment(cEnv));
                Log.i(TAG, "Limpeza ao iniciar: " + n + " pedido(s) encerrado(s)"
                    + (CieloOrderJanitor.hadRecentAuthFailure() ? " (API 401 — credenciais inválidas)" : ""));
            }, "cielo-startup-purge").start();
        }
    }

    /** EC Cielo é numérico; UUID no banco (id da lavanderia) quebra pagamento na LIO. */
    public static boolean looksLikeUuidMerchantCode(String merchantCode) {
        if (merchantCode == null || merchantCode.isEmpty()) {
            return false;
        }
        String m = merchantCode.trim();
        return m.length() >= 32 && m.indexOf('-') >= 0;
    }

    public String getConfigurationError() {
        if (!isInitialized) {
            return "Credenciais Cielo não configuradas (Client ID e Access Token no painel admin).";
        }
        return null;
    }

    @Override
    public void setCallback(PaymentCallback callback) {
        this.callback = callback;
    }

    @Override
    public boolean isProcessing() {
        return isProcessing;
    }

    /** Pagamento aberto na Cielo há tempo demais sem callback. */
    public boolean isProcessingStale() {
        return isProcessing
            && lastDeepLinkLaunchAtMs > 0L
            && System.currentTimeMillis() - lastDeepLinkLaunchAtMs >= PROCESSING_WATCHDOG_MS;
    }

    /** Só após watchdog — evita segundo checkout enquanto Cielo ainda processa (-4281). */
    public void releaseStaleProcessingIfNeeded() {
        if (!isProcessingStale()) {
            return;
        }
        Log.w(TAG, "Watchdog: pagamento sem callback há " + PROCESSING_WATCHDOG_MS + "ms");
        finishProcessingAfterCallback();
        CieloPaymentSessionHelper.endSession(context);
        notifyPaymentError("Tempo esgotado aguardando resposta da Cielo. Tente novamente.");
    }

    @Override
    public boolean isInitialized() {
        return isInitialized;
    }

    @Override
    public void processPayment(double amount, String paymentType, String description, String orderId) {
        new Thread(() -> processPaymentWorker(amount, paymentType, description, orderId), "cielo-pay").start();
    }

    private void processPaymentWorker(double amount, String paymentType, String description, String orderId) {
        releaseStaleProcessingIfNeeded();
        long now = System.currentTimeMillis();
        if (now < cieloCooldownUntilMs) {
            notifyPaymentError("Aguarde alguns segundos: terminal Cielo finalizando pedido anterior.");
            return;
        }
        if (isProcessing) {
            notifyPaymentError("Ja ha uma transacao em processamento");
            return;
        }
        if (now - lastDeepLinkLaunchAtMs < MIN_MS_BETWEEN_DEEP_LINKS) {
            notifyPaymentError("Aguarde: pagamento anterior ainda aberto na Cielo.");
            return;
        }
        long sinceLastSuccess = now - lastSuccessfulPaymentAtMs;
        if (lastSuccessfulPaymentAtMs > 0 && sinceLastSuccess < MIN_MS_BETWEEN_SUCCESSIVE_PAYMENTS) {
            long waitSec = (MIN_MS_BETWEEN_SUCCESSIVE_PAYMENTS - sinceLastSuccess + 999L) / 1000L;
            notifyPaymentError("Aguarde " + waitSec + " segundos: terminal Cielo finalizando o pagamento anterior.");
            return;
        }

        if (!isInitialized) {
            notifyPaymentError("Credenciais Cielo nao configuradas (Client ID e Access Token).");
            return;
        }

        try {
            long baseCents = Math.round(amount * 100.0d);
            long amountCents = CieloAmountDedup.chargeCents(context, baseCents);
            String reference = buildUniqueCieloReference();
            if (orderId != null && !orderId.isEmpty()) {
                Log.d(TAG, "Pending Supabase (correlação local): " + orderId);
            }

            String paymentCode = resolvePaymentCode(paymentType);
            String merchant = merchantCodeForJanitor();
            String cieloEnv = CieloOrderJanitor.resolveEnvironment(environment);
            // pm clear antes do checkout quebra deviceKey/hasConnectivity → -4281. Só REST janitor.
            int purged = CieloOrderJanitor.closeOpenOrdersQuick(
                clientId, accessToken, merchant, cieloEnv);
            Log.i(TAG, "Pré-checkout: cloud=" + purged + " pedido(s) merchant=" + merchant);

            // Deep link direto — sem orderId na nuvem (evita fluxo parcial/troco na L400).
            pendingCloudOrderId = null;

            JSONObject payload = buildPaymentPayload(amountCents, paymentCode, description, reference);
            Log.i(TAG, "Payload Cielo: " + payload.toString());
            Log.d(TAG, "Cielo checkout: type=" + paymentType + " code=" + paymentCode
                + " cents=" + amountCents + " purged=" + purged + " cloudOrder=none");

            String base64 = Base64.encodeToString(payload.toString().getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP);
            String checkoutUri = "lio://payment?request=" + Uri.encode(base64) + "&urlCallback=order://response";
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(checkoutUri));

            activeInstance = this;
            isProcessing = true;
            paidOrderCleanupDone = false;
            scheduleProcessingWatchdog();
            pendingReference = reference;
            pendingAmountCents = amountCents;
            pendingPaymentCode = paymentCode;
            CieloPaymentSessionHelper.beginSession(context, paymentCode);
            final boolean blockAlternateCapture = !"PIX".equalsIgnoreCase(paymentCode);

            mainHandler.post(() -> {
                if (callback != null) {
                    callback.onPaymentProcessing("Abrindo pagamento na Cielo...");
                }
                CieloPaymentForegroundService.start(context);
                lastDeepLinkLaunchAtMs = System.currentTimeMillis();
                try {
                    context.startActivity(intent);
                    Log.d(TAG, "Deep link Cielo enviado (ref=" + reference + ")");
                    if (blockAlternateCapture) {
                        scheduleAccessibilityTarja(context);
                    }
                } catch (android.content.ActivityNotFoundException e) {
                    handleLaunchFailure("App de pagamento Cielo não instalado neste terminal.");
                } catch (Exception e) {
                    handleLaunchFailure("Erro ao abrir pagamento Cielo: " + e.getMessage());
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "Erro ao preparar pagamento Cielo", e);
            notifyPaymentError("Erro ao iniciar pagamento Cielo: " + e.getMessage());
        }
    }

    private void handleLaunchFailure(String message) {
        finishProcessingAfterCallback();
        dropActiveInstance();
        clearBoundCheckout();
        CieloPaymentForegroundService.stop(context);
        CieloPaymentSessionHelper.endSession(context);
        clearPendingTransaction();
        if (callback != null) {
            callback.onPaymentError(message);
        }
    }

    private void notifyPaymentError(String message) {
        mainHandler.post(() -> {
            if (callback != null) {
                callback.onPaymentError(message);
            }
        });
    }

    @Override
    public void cancelPayment() {
        if (isProcessing) {
            finishProcessingAfterCallback();
            dropActiveInstance();
            CieloPaymentForegroundService.stop(context);
            CieloPaymentSessionHelper.endSession(context);
            clearPendingTransaction();
            if (callback != null) {
                callback.onPaymentError("Transacao Cielo cancelada pelo usuario");
            }
        }
    }

    /**
     * Called by CieloResponseActivity when callback order://response arrives.
     */
    public static void handleDeepLinkResponse(Uri uri) {
        if (pendingReversal != null) {
            new Thread(() -> consumeReversalDeepLinkResponse(uri), "cielo-reversal-callback").start();
            return;
        }
        if (activeInstance == null) {
            Log.w(TAG, "Resposta Cielo sem instancia ativa — tentando reidratar checkout");
            activeInstance = tryRehydrateActiveInstance();
        }
        if (activeInstance == null) {
            Log.w(TAG, "Resposta Cielo recebida sem instancia ativa — ignorada");
            return;
        }
        new Thread(() -> activeInstance.consumeDeepLinkResponse(uri), "cielo-callback").start();
    }

    /** Vincula operação do totem — sobrevive ao timeout de inatividade durante PIX na Cielo. */
    public void bindTotemCheckout(long operationId, String machineId, String pendingTxId) {
        boundTotemOperationId = operationId;
        boundMachineId = machineId == null ? "" : machineId.trim();
        boundPendingTxId = pendingTxId == null ? "" : pendingTxId.trim();
        successDelivered = false;
        persistBoundCheckout();
    }

    public long getBoundTotemOperationId() {
        if (boundTotemOperationId > 0) {
            return boundTotemOperationId;
        }
        return loadBoundOperationIdFromPrefs();
    }

    public String getBoundMachineId() {
        if (boundMachineId != null && !boundMachineId.isEmpty()) {
            return boundMachineId;
        }
        return context.getApplicationContext()
            .getSharedPreferences(PREFS_CHECKOUT, Context.MODE_PRIVATE)
            .getString(KEY_BOUND_MACHINE, "");
    }

    public String getBoundPendingTxId() {
        if (boundPendingTxId != null && !boundPendingTxId.isEmpty()) {
            return boundPendingTxId;
        }
        return context.getApplicationContext()
            .getSharedPreferences(PREFS_CHECKOUT, Context.MODE_PRIVATE)
            .getString(KEY_BOUND_TX, "");
    }

    public boolean matchesBoundOperation(long operationId) {
        return operationId > 0 && operationId == getBoundTotemOperationId();
    }

    public void clearBoundCheckout() {
        boundTotemOperationId = 0L;
        boundMachineId = "";
        boundPendingTxId = "";
        successDelivered = false;
        context.getApplicationContext()
            .getSharedPreferences(PREFS_CHECKOUT, Context.MODE_PRIVATE)
            .edit()
            .clear()
            .apply();
    }

    /** Broadcast Buzios quando deep link atrasa (comum no PIX). */
    public static void tryCompleteFromBroadcast(Context context, String source) {
        CieloLioManager mgr = activeInstance;
        if (mgr == null) {
            mgr = tryRehydrateActiveInstance();
        }
        if (mgr == null) {
            return;
        }
        if (mgr.successDelivered) {
            return;
        }
        if (!mgr.isProcessing && mgr.getBoundTotemOperationId() <= 0) {
            return;
        }
        Log.i(TAG, "Aprovação via broadcast — completando checkout (" + source + ")");
        mgr.deliverPaymentSuccess("CIELO_BROADCAST", "broadcast-" + System.currentTimeMillis(), "broadcast:" + source);
        // Broadcast não traz o id do pedido; fecha todos os pedidos abertos do EC para
        // evitar que o próximo checkout falhe com "pedido anterior aberto" (-4281).
        mgr.schedulePaidOrderCleanup(null);
    }

    private static CieloLioManager tryRehydrateActiveInstance() {
        if (activeInstance != null) {
            return activeInstance;
        }
        return null;
    }

    private void persistBoundCheckout() {
        context.getApplicationContext()
            .getSharedPreferences(PREFS_CHECKOUT, Context.MODE_PRIVATE)
            .edit()
            .putLong(KEY_BOUND_OPERATION, boundTotemOperationId)
            .putString(KEY_BOUND_MACHINE, boundMachineId)
            .putString(KEY_BOUND_TX, boundPendingTxId)
            .putLong(KEY_BOUND_STARTED, System.currentTimeMillis())
            .apply();
    }

    private long loadBoundOperationIdFromPrefs() {
        return context.getApplicationContext()
            .getSharedPreferences(PREFS_CHECKOUT, Context.MODE_PRIVATE)
            .getLong(KEY_BOUND_OPERATION, 0L);
    }

    private void consumeDeepLinkResponse(Uri uri) {
        if (isDuplicateCallback(uri)) {
            if (successDelivered) {
                Log.w(TAG, "Callback Cielo duplicado ignorado (sucesso já entregue)");
                finishProcessingAfterCallback();
                return;
            }
            Log.w(TAG, "Callback Cielo duplicado — reprocessando (sucesso ainda não entregue)");
        }

        finishProcessingAfterCallback();
        CieloPaymentForegroundService.stop(context);

        if (uri == null) {
            CieloPaymentSessionHelper.endSession(context);
            notifyPaymentError("Resposta Cielo invalida");
            return;
        }

        try {
            String responseBase64 = uri.getQueryParameter("response");
            String responseCode = uri.getQueryParameter("responsecode");

            if (responseBase64 == null || responseBase64.isEmpty()) {
                notifyPaymentError("Resposta Cielo sem payload");
                return;
            }

            String decoded = new String(Base64.decode(responseBase64, Base64.DEFAULT), StandardCharsets.UTF_8);
            Log.d(TAG, "Cielo callback recebido: responsecode=" + responseCode + " payloadLen=" + decoded.length());

            JSONObject json = new JSONObject(decoded);

            // Error payload: {"code":1,"reason":"..."}
            if (json.has("code") && json.has("reason")) {
                int code = json.optInt("code", -1);
                String reason = json.optString("reason", "Erro desconhecido");
                Log.w(TAG, "Cielo erro (code=" + code + "): " + reason + " | payload=" + decoded);
                schedulePostCheckoutCleanup("error-code-" + code);
                if (CieloOrderJanitor.is4281Error(reason)) {
                    CieloLocalOrderPurge.clearStuckLocalOrders(context, 0L);
                }
                notifyPaymentError(formatCieloErrorMessage(code, reason));
                return;
            }

            // Doc Cielo: responsecode=0 sucesso; =2 cancelamento/erro.
            if ("2".equals(responseCode)) {
                schedulePostCheckoutCleanup("cancelled");
                notifyPaymentError("Pagamento cancelado ou recusado (responsecode=2)");
                return;
            }
            if (responseCode != null && !responseCode.isEmpty() && !"0".equals(responseCode)) {
                rejectSuspiciousCallback("Resposta Cielo não confirmada (responsecode=" + responseCode + ")");
                return;
            }

            String authCode = "";
            String cieloCode = "";
            String brand = "";
            String mask = "";
            String txnId = json.optString("id", String.valueOf(System.currentTimeMillis()));
            String responseReference = json.optString("reference", "");

            if (!isExpectedReference(responseReference)) {
                rejectSuspiciousCallback("Referencia Cielo divergente (ref=" + responseReference + ")");
                return;
            }

            JSONArray payments = json.optJSONArray("payments");
            if (payments == null || payments.length() == 0) {
                rejectSuspiciousCallback("Resposta Cielo sem pagamento confirmado");
                return;
            }

            JSONObject payment = payments.getJSONObject(payments.length() - 1);
            authCode = payment.optString("authCode", "");
            cieloCode = payment.optString("cieloCode", "");
            brand = payment.optString("brand", "");
            mask = payment.optString("mask", "");
            String externalId = payment.optString("externalId", "");
            if (!externalId.isEmpty()) {
                txnId = externalId;
            }

            long paidAmount = payment.optLong("amount", json.optLong("paidAmount", -1));
            if (!isExpectedAmount(paidAmount)) {
                rejectSuspiciousCallback("Valor Cielo divergente (esperado=" + pendingAmountCents + ", recebido=" + paidAmount + ")");
                return;
            }

            boolean isPixPayment = "PIX".equalsIgnoreCase(pendingPaymentCode);

            // Verify statusCode from paymentFields (1=Authorized cartão, 2=Cancelled, 0=PIX)
            JSONObject paymentFields = payment.optJSONObject("paymentFields");
            if (paymentFields != null) {
                String statusCode = paymentFields.optString("statusCode", "");
                if ("2".equals(statusCode)) {
                    notifyPaymentError("Transacao cancelada pela Cielo (statusCode=2)");
                    activeInstance = null;
                    return;
                }
                if (!isPixPayment && !statusCode.isEmpty() && !"1".equals(statusCode)) {
                    rejectSuspiciousCallback("Pagamento Cielo não autorizado (statusCode=" + statusCode + ")");
                    return;
                }
            }

            if (!isPixPayment && authCode.isEmpty() && cieloCode.isEmpty()) {
                rejectSuspiciousCallback("Resposta Cielo sem código de autorização (cartão)");
                return;
            }

            if (authCode.isEmpty()) {
                authCode = cieloCode.isEmpty() ? txnId : cieloCode;
            }

            String paymentId = payment.optString("id", "");
            if (paymentId.isEmpty()) {
                paymentId = json.optString("id", "");
            }
            if (paymentId.isEmpty()) {
                paymentId = txnId;
            }
            long snapshotAmount = paidAmount > 0 ? paidAmount : pendingAmountCents;
            lastApprovedPayment = new ApprovedPaymentSnapshot(
                paymentId,
                authCode,
                cieloCode,
                snapshotAmount
            );

            lastDetectedSupabasePaymentMethod = resolveSupabaseMethodFromCieloPayment(payment);
            rememberMerchantFromPayment(payment);

            CieloPrintDismissScheduler.onApprovedDetected(context, "deeplink-success");
            deliverPaymentSuccess(authCode, txnId, "deeplink-success");

            String cieloOrderId = json.optString("id", "");
            if (cieloOrderId.isEmpty() && pendingCloudOrderId != null) {
                cieloOrderId = pendingCloudOrderId;
            }
            schedulePaidOrderCleanup(cieloOrderId);

            Log.d(TAG, "Cielo APPROVED: ref=" + pendingReference + " solicitado=" + pendingPaymentCode
                + " detectadoSupabase=" + lastDetectedSupabasePaymentMethod + " brand=" + brand + " maskSuffix=" + lastFour(mask));
        } catch (Exception e) {
            Log.e(TAG, "Erro ao processar callback Cielo", e);
            notifyPaymentError("Erro ao processar retorno Cielo: " + e.getMessage());
        } finally {
            scheduleEndPaymentSession();
            clearPendingTransaction();
            dropActiveInstance();
        }
    }

    private void scheduleEndPaymentSession() {
        cancelScheduledEndSession();
        pendingEndSessionId = CieloPaymentSessionHelper.getSessionId(context);
        pendingEndSessionRunnable = () -> {
            if (CieloPaymentSessionHelper.getSessionId(context) == pendingEndSessionId
                    && CieloPaymentSessionHelper.hasActiveSession(context)) {
                CieloPaymentSessionHelper.endSession(context);
            }
        };
        END_SESSION_HANDLER.postDelayed(pendingEndSessionRunnable, 30000L);
    }

    private void scheduleProcessingWatchdog() {
        cancelProcessingWatchdog();
        processingWatchdogRunnable = () -> {
            if (isProcessing) {
                Log.w(TAG, "Watchdog: sem callback Cielo em " + PROCESSING_WATCHDOG_MS + "ms");
                finishProcessingAfterCallback();
                CieloPaymentSessionHelper.endSession(context);
                notifyPaymentError("Tempo esgotado aguardando resposta da Cielo. Tente novamente.");
            }
        };
        mainHandler.postDelayed(processingWatchdogRunnable, PROCESSING_WATCHDOG_MS);
    }

    private void cancelProcessingWatchdog() {
        if (processingWatchdogRunnable != null) {
            mainHandler.removeCallbacks(processingWatchdogRunnable);
            processingWatchdogRunnable = null;
        }
    }

    private void finishProcessingAfterCallback() {
        cancelProcessingWatchdog();
        isProcessing = false;
    }

    private void dropActiveInstance() {
        if (activeInstance == this) {
            activeInstance = null;
        }
    }

    /**
     * Consome o método inferido na última resposta de sucesso (chamar na thread do callback).
     */
    public synchronized String takeLastDetectedSupabasePaymentMethod() {
        String s = lastDetectedSupabasePaymentMethod;
        lastDetectedSupabasePaymentMethod = null;
        return s;
    }

    /** Tarja inferior via assistente Cielo (TYPE_ACCESSIBILITY_OVERLAY — sem "Exibir sobre apps"). */
    private void scheduleAccessibilityTarja(Context context) {
        if (!CieloReceiptAccessibilityHelper.isServiceEnabled(context)) {
            Log.w(TAG, "Assistente Cielo inativo — tarja e Não imprimir não funcionarão");
            return;
        }
        mainHandler.postDelayed(() -> {
            if (!CieloPaymentSessionHelper.isCardShieldEnabled(context)) {
                return;
            }
            CieloReceiptAccessibilityService.requestBottomTarja(context);
        }, 1500L);
    }

    private JSONObject buildPaymentPayload(long amountCents, String paymentCode, String description,
                                           String reference) throws Exception {
        JSONObject payload = new JSONObject();
        payload.put("accessToken", accessToken);
        payload.put("clientID", clientId);
        payload.put("reference", reference);
        payload.put("value", String.valueOf(amountCents));
        payload.put("email", "totem@toplavanderia.local");

        String ec = merchantCodeForJanitor();
        if (CieloOrderJanitor.looksLikeCieloEc(ec)) {
            payload.put("merchantCode", ec);
        }

        if (paymentCode != null && !paymentCode.isEmpty()) {
            payload.put("paymentCode", paymentCode);
            applyDirectPaymentCodes(payload, paymentCode);
            if (!"PIX".equalsIgnoreCase(paymentCode)) {
                // Doc Cielo: installments 0 = à vista — omitir na L400 abre fluxo de troco indevido.
                payload.put("installments", 0);
            }
        }

        JSONArray items = new JSONArray();
        JSONObject item = new JSONObject();
        item.put("name", description != null && !description.isEmpty() ? description : "Top Lavanderia");
        item.put("quantity", 1);
        item.put("sku", "LAV-" + reference.substring(Math.max(0, reference.length() - 8)));
        item.put("unitOfMeasure", "unidade");
        item.put("unitPrice", (int) amountCents);
        items.put(item);
        payload.put("items", items);

        return payload;
    }

    /** primaryCode/secondaryCode reforçam paymentCode — firmware L400 produção exige para pular troco. */
    private void applyDirectPaymentCodes(JSONObject payload, String paymentCode) throws Exception {
        if ("DEBITO_AVISTA".equalsIgnoreCase(paymentCode)) {
            payload.put("primaryCode", "2000");
            payload.put("secondaryCode", "1");
        } else if ("CREDITO_AVISTA".equalsIgnoreCase(paymentCode)) {
            payload.put("primaryCode", "1000");
            payload.put("secondaryCode", "1");
        }
    }

    /**
     * Mapeia payment_method do Supabase a partir do objeto payment do callback Cielo.
     * @see <a href="https://developercielo.github.io/manual/cielo-lio">Manual Cielo LIO</a> (paymentFields.productName, statusCode)
     */
    private String resolveSupabaseMethodFromCieloPayment(JSONObject payment) {
        String brand = payment != null ? payment.optString("brand", "") : "";
        JSONObject pf = payment != null ? payment.optJSONObject("paymentFields") : null;
        if (pf != null) {
            String productName = pf.optString("productName", "");
            String primary = pf.optString("primaryProductName", "");
            String secondary = pf.optString("secondaryProductName", "");
            String combined = (productName + " " + primary + " " + secondary).toUpperCase(Locale.ROOT);
            if (combined.contains("PIX")) {
                return "pix";
            }
            // Doc: captura QRCODE = 6 — pagamento via QR (ex.: PIX no fluxo misto)
            String cardCaptureType = pf.optString("cardCaptureType", "");
            if ("6".equals(cardCaptureType) && (brand == null || brand.isEmpty())) {
                return "pix";
            }
            // Doc: statusCode — 0 em contexto PIX; 1 autorizada (cartão)
            String statusCode = pf.optString("statusCode", "");
            if ("0".equals(statusCode) && (brand == null || brand.isEmpty()) && !combined.contains("DEBITO")) {
                return "pix";
            }
            if (combined.contains("DEBITO") || combined.contains("DÉBITO")) {
                return "debit";
            }
        }
        if (pendingPaymentCode != null) {
            if ("PIX".equalsIgnoreCase(pendingPaymentCode)) {
                return "pix";
            }
            if ("DEBITO_AVISTA".equalsIgnoreCase(pendingPaymentCode)) {
                return "debit";
            }
        }
        return "credit";
    }

    private String resolvePaymentCode(String paymentType) {
        if (paymentType == null || paymentType.isEmpty()) {
            Log.w(TAG, "resolvePaymentCode: tipo vazio, usando CREDITO_AVISTA");
            return "CREDITO_AVISTA";
        }
        String t = paymentType.trim();
        if ("pix".equalsIgnoreCase(t)
                || "wallet".equalsIgnoreCase(t)
                || "carteira".equalsIgnoreCase(t)
                || "carteira_virtual".equalsIgnoreCase(t)
                || "pagamento_carteira_virtual".equalsIgnoreCase(t)) {
            return "PIX";
        }
        if ("debit".equalsIgnoreCase(t) || "debito".equalsIgnoreCase(t)) {
            return "DEBITO_AVISTA";
        }
        return "CREDITO_AVISTA";
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    /** Referência alfanumérica compacta (evita truncamento/colisão na Cielo). */
    private static String buildUniqueCieloReference() {
        long now = System.currentTimeMillis();
        int rnd = ThreadLocalRandom.current().nextInt(100000);
        return String.format(Locale.US, "TL%013d%05d", now, rnd);
    }

    private static boolean isDuplicateCallback(Uri uri) {
        if (uri == null) {
            return false;
        }
        String response = uri.getQueryParameter("response");
        String responseCode = uri.getQueryParameter("responsecode");
        String signature = (responseCode == null ? "" : responseCode) + "|"
            + (response == null ? "" : response);
        long now = System.currentTimeMillis();
        synchronized (CieloLioManager.class) {
            if (!signature.isEmpty()
                    && signature.equals(lastConsumedCallbackSignature)
                    && (now - lastConsumedCallbackAtMs) < 8000L) {
                return true;
            }
            lastConsumedCallbackSignature = signature;
            lastConsumedCallbackAtMs = now;
        }
        return false;
    }

    private void deliverPaymentSuccess(String authCode, String txnId, String source) {
        if (successDelivered) {
            Log.d(TAG, "Sucesso já entregue — ignorando " + source);
            return;
        }
        successDelivered = true;
        Log.i(TAG, "Pagamento aprovado (" + source + ") auth=" + authCode + " txn=" + txnId);
        if (callback != null) {
            final String auth = authCode == null ? "" : authCode;
            final String txn = txnId == null ? "" : txnId;
            mainHandler.post(() -> {
                if (callback != null) {
                    callback.onPaymentSuccess(auth, txn);
                }
            });
        }
    }

    private boolean isExpectedReference(String responseReference) {
        if (pendingReference == null || pendingReference.isEmpty()) {
            return false;
        }
        if (pendingReference.equals(responseReference)) {
            return true;
        }
        if ("PIX".equalsIgnoreCase(pendingPaymentCode)
                && (responseReference == null || responseReference.isEmpty())) {
            Log.w(TAG, "PIX: reference vazia no callback — aceitando pela sessão");
            return true;
        }
        return false;
    }

    private boolean isExpectedAmount(long paidAmount) {
        if (pendingAmountCents <= 0) {
            return false;
        }
        if (paidAmount == pendingAmountCents) {
            return true;
        }
        // PIX: alguns firmwares omitem amount no callback ou retornam 0 apesar da autorização.
        if ("PIX".equalsIgnoreCase(pendingPaymentCode) && paidAmount <= 0) {
            Log.w(TAG, "PIX: amount ausente/zero no callback; aceitando pela referência e paymentCode");
            return true;
        }
        return false;
    }

    private String formatCieloErrorMessage(int code, String reason) {
        String r = reason == null ? "" : reason;
        String lower = r.toLowerCase(Locale.ROOT);
        if (lower.contains("-990")
                || lower.contains("optin")
                || lower.contains("opt-in")
                || lower.contains("nao elegivel")
                || lower.contains("não elegível")
                || lower.contains("nao elegivel")) {
            return "Erro Cielo (-990): PIX não habilitado neste terminal/estabelecimento. "
                + "Habilite em Minha Conta Cielo → Autorizações → PIX e confira o merchantCode nas configurações do totem.";
        }
        if (lower.contains("-4007") || lower.contains("4007")) {
            return "Erro Cielo (-4007): produto não permitido (ex.: débito). Verifique contrato Cielo e merchantCode.";
        }
        if (lower.contains("json") && (lower.contains("inválid") || lower.contains("invalid"))) {
            return "Erro Cielo: parâmetros inválidos no pedido de pagamento. Detalhe: " + r;
        }
        if (lower.contains("4281") || lower.contains("ja efetuada") || lower.contains("já efetuada") || lower.contains("already")) {
            cieloCooldownUntilMs = System.currentTimeMillis() + 8000L;
            CieloLocalOrderPurge.clearStuckLocalOrders(context, 0L);
            CieloOrderJanitor.scheduleCleanupWithRetry(
                clientId, accessToken, merchantCodeForJanitor(),
                CieloOrderJanitor.resolveEnvironment(environment), "4281");
            return "Erro Cielo (-4281): mesma combinação cartão + valor bloqueada pelo adquirente.\n"
                + "Tente de novo — o app alterna centavos automaticamente entre cobranças.";
        }
        if (lower.contains("4061") || lower.contains("falha de conex") || lower.contains("contactar a cielo")) {
            return "Erro Cielo (-4061): terminal sem conexão com os servidores de pagamento da Cielo.\n"
                + "Verifique Wi-Fi/dados móveis e, em Configurações → Data e hora, "
                + "ative \"Usar data e hora da rede\" (relógio errado causa este erro).";
        }
        return "Erro Cielo (" + code + "): " + r;
    }

    private void rejectSuspiciousCallback(String message) {
        Log.w(TAG, message + " (ref=" + pendingReference + ", cents=" + pendingAmountCents + ")");
        notifyPaymentError(message);
    }

    private void clearPendingTransaction() {
        pendingReference = null;
        pendingAmountCents = 0;
        pendingPaymentCode = null;
        pendingCloudOrderId = null;
    }

    /** Limpa checkout após sucesso ou erro definitivo no totem. */
    public void onTotemCheckoutFinished() {
        clearBoundCheckout();
        lastApprovedPayment = null;
    }

    public boolean hasApprovedPaymentSnapshot() {
        return lastApprovedPayment != null
            && lastApprovedPayment.paymentId != null
            && !lastApprovedPayment.paymentId.isEmpty();
    }

    /**
     * Estorno automático na Cielo quando o ESP32 não confirma liberação.
     * Bloqueia até o callback order://response ou timeout.
     */
    public boolean requestAutomaticReversal() {
        ApprovedPaymentSnapshot snap = lastApprovedPayment;
        if (snap == null || snap.paymentId.isEmpty()) {
            Log.e(TAG, "Estorno automático: snapshot de pagamento ausente");
            return false;
        }
        if (!isInitialized) {
            Log.e(TAG, "Estorno automático: credenciais Cielo ausentes");
            return false;
        }
        if (pendingReversal != null) {
            Log.w(TAG, "Estorno automático já em andamento");
            return false;
        }

        ReversalWaitState wait = new ReversalWaitState();
        pendingReversal = wait;
        try {
            JSONObject payload = new JSONObject();
            payload.put("id", snap.paymentId);
            payload.put("clientID", clientId);
            payload.put("accessToken", accessToken);
            payload.put("cieloCode", snap.cieloCode.isEmpty() ? snap.authCode : snap.cieloCode);
            payload.put("authCode", snap.authCode);
            payload.put("value", snap.amountCents);

            String base64 = Base64.encodeToString(
                payload.toString().getBytes(StandardCharsets.UTF_8),
                Base64.NO_WRAP
            );
            String checkoutUri = "lio://payment-reversal?request="
                + Uri.encode(base64) + "&urlCallback=order://response";
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(checkoutUri));

            Log.i(TAG, "Iniciando estorno Cielo paymentId=" + snap.paymentId + " value=" + snap.amountCents);
            final CountDownLatch launchLatch = new CountDownLatch(1);
            mainHandler.post(() -> {
                try {
                    context.startActivity(intent);
                } catch (Exception e) {
                    wait.errorMessage = e.getMessage() == null ? "Falha ao abrir estorno Cielo" : e.getMessage();
                    wait.latch.countDown();
                } finally {
                    launchLatch.countDown();
                }
            });
            launchLatch.await(5000L, TimeUnit.MILLISECONDS);

            boolean completed = wait.latch.await(REVERSAL_CALLBACK_TIMEOUT_MS, TimeUnit.MILLISECONDS);
            if (!completed) {
                Log.e(TAG, "Estorno Cielo: timeout aguardando callback");
                return false;
            }
            if (wait.success) {
                Log.i(TAG, "Estorno Cielo confirmado");
                lastApprovedPayment = null;
                return true;
            }
            Log.e(TAG, "Estorno Cielo falhou: " + wait.errorMessage);
            return false;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            Log.e(TAG, "Estorno Cielo interrompido", e);
            return false;
        } catch (Exception e) {
            Log.e(TAG, "Erro ao solicitar estorno Cielo", e);
            return false;
        } finally {
            pendingReversal = null;
        }
    }

    private static void consumeReversalDeepLinkResponse(Uri uri) {
        ReversalWaitState wait = pendingReversal;
        if (wait == null) {
            Log.w(TAG, "Callback de estorno sem espera ativa");
            return;
        }
        try {
            if (uri == null) {
                wait.errorMessage = "Callback de estorno inválido";
                return;
            }
            String responseBase64 = uri.getQueryParameter("response");
            String responseCode = uri.getQueryParameter("responsecode");
            if (responseBase64 == null || responseBase64.isEmpty()) {
                wait.errorMessage = "Estorno sem payload";
                return;
            }
            String decoded = new String(Base64.decode(responseBase64, Base64.DEFAULT), StandardCharsets.UTF_8);
            JSONObject json = new JSONObject(decoded);
            if (json.has("code") && json.has("reason")) {
                wait.errorMessage = json.optString("reason", "Estorno recusado");
                return;
            }
            if ("2".equals(responseCode)) {
                wait.errorMessage = "Estorno cancelado (responsecode=2)";
                return;
            }
            JSONArray payments = json.optJSONArray("payments");
            if (payments != null && payments.length() > 0) {
                JSONObject payment = payments.getJSONObject(payments.length() - 1);
                JSONObject paymentFields = payment.optJSONObject("paymentFields");
                if (paymentFields != null) {
                    String statusCode = paymentFields.optString("statusCode", "");
                    if ("2".equals(statusCode)) {
                        wait.success = true;
                        return;
                    }
                }
            }
            if ("0".equals(responseCode) || responseCode == null || responseCode.isEmpty()) {
                wait.success = true;
                return;
            }
            wait.errorMessage = "Estorno não confirmado (responsecode=" + responseCode + ")";
        } catch (Exception e) {
            wait.errorMessage = e.getMessage() == null ? "Erro ao processar estorno" : e.getMessage();
            Log.e(TAG, "consumeReversalDeepLinkResponse", e);
        } finally {
            wait.latch.countDown();
        }
    }

    private void schedulePostCheckoutCleanup(String reason) {
        CieloOrderJanitor.scheduleCleanupWithRetry(
            clientId, accessToken, merchantCodeForJanitor(),
            CieloOrderJanitor.resolveEnvironment(environment), reason);
    }

    private String merchantCodeForJanitor() {
        return CieloOrderJanitor.resolveMerchantId(merchantCode);
    }

    private void rememberMerchantFromPayment(JSONObject payment) {
        if (payment == null) {
            return;
        }
        String mc = payment.optString("merchantCode", "");
        JSONObject pf = payment.optJSONObject("paymentFields");
        if (mc.isEmpty() && pf != null) {
            mc = pf.optString("merchantCode", "");
            if (mc.isEmpty()) {
                mc = pf.optString("externalCallMerchantCode", "");
            }
        }
        CieloOrderJanitor.learnMerchantId(context, mc);
    }

    /**
     * Fecha o pedido pago exatamente uma vez por checkout, independentemente do caminho
     * (deep link {@code order://response} ou broadcast Cielo). Antes, sucesso via broadcast
     * (comum no PIX) não fechava o pedido, e o checkout seguinte falhava com "pedido anterior
     * aberto" (-4281).
     */
    private synchronized void schedulePaidOrderCleanup(final String cieloOrderId) {
        if (paidOrderCleanupDone) {
            return;
        }
        paidOrderCleanupDone = true;
        new Thread(() -> {
            finalizePaidOrder(cieloOrderId);
            try {
                Thread.sleep(400L);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            CieloLocalOrderPurge.clearStuckLocalOrders(context, 0L);
        }, "cielo-post-success").start();
    }

    private void finalizePaidOrder(String cieloOrderId) {
        lastSuccessfulPaymentAtMs = System.currentTimeMillis();
        String merchant = merchantCodeForJanitor();
        String cieloEnv = CieloOrderJanitor.resolveEnvironment(environment);
        if (cieloOrderId != null && !cieloOrderId.isEmpty()) {
            CieloOrderJanitor.closeOrderById(
                clientId, accessToken, merchant, cieloEnv, cieloOrderId);
        }
        int purged = CieloOrderJanitor.closeOpenOrdersQuick(
            clientId, accessToken, merchant, cieloEnv);
        Log.i(TAG, "Pós-pagamento: " + purged + " pedido(s) encerrado(s)");
        schedulePostCheckoutCleanup("success");
    }

    private String lastFour(String value) {
        if (value == null || value.length() < 4) return "";
        return value.substring(value.length() - 4);
    }
}
