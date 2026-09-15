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
    /** Intervalo curto entre deep links para permitir pagamentos seguidos. */
    private static final long MIN_MS_BETWEEN_DEEP_LINKS = 1500L;
    private static final long MIN_MS_BETWEEN_SUCCESSIVE_PAYMENTS = 1200L;
    private static final long COOLDOWN_AFTER_4281_MS = 8000L;
    /** Sem callback Cielo — cartão; libera o totem sem espera longa. */
    private static final long PROCESSING_WATCHDOG_MS = 90_000L;
    /**
     * PIX: após este tempo a UI volta à grade e outras máquinas podem pagar.
     * O checkout (binding/reference) permanece para o callback tardio.
     */
    private static final long PROCESSING_WATCHDOG_PIX_SOFT_MS = 90_000L;
    /**
     * PIX: após este tempo abandona o QR não pago (janitor só ENTERED/DRAFT).
     * Pedidos PAID nunca são fechados aqui.
     */
    private static final long PROCESSING_WATCHDOG_PIX_HARD_MS = 8 * 60_000L;
    /** Encerra sessão Cielo rápido para não segurar o próximo pagamento. */
    private static final long END_SESSION_DELAY_MS = 2500L;
    private static final long REVERSAL_CALLBACK_TIMEOUT_MS = 45_000L;
    private static long lastSuccessfulPaymentAtMs;
    private static Runnable pendingEndSessionRunnable;
    private static int pendingEndSessionId;
    private static final Handler END_SESSION_HANDLER = new Handler(Looper.getMainLooper());
    private static final String PREFS_CHECKOUT = "cielo_checkout_binding";
    private static final String KEY_BOUND_OPERATION = "operation_id";
    private static final String KEY_BOUND_MACHINE = "machine_id";
    private static final String KEY_BOUND_TX = "pending_tx_id";
    private static final String KEY_BOUND_STARTED = "started_at";
    private static final String KEY_BOUND_AMOUNT = "amount_cents";
    private static final String KEY_BOUND_PAY_CODE = "payment_code";
    private static final String KEY_BOUND_REFERENCE = "reference";
    private static final String KEY_BOUND_SESSION = "session_id";
    private static final String PREFS_DORMANT_PIX = "cielo_dormant_pix";
    private static final String KEY_DORMANT_OPERATION = "operation_id";
    private static final String KEY_DORMANT_MACHINE = "machine_id";
    private static final String KEY_DORMANT_TX = "pending_tx_id";
    private static final String KEY_DORMANT_SESSION = "session_id";
    private static final String KEY_DORMANT_STARTED = "started_at";
    private static final String KEY_DORMANT_AMOUNT = "amount_cents";
    private static final String KEY_DORMANT_PAY_CODE = "payment_code";
    private static final String KEY_DORMANT_REFERENCE = "reference";
    /** Mensagens internas para o TotemActivity não tratar PIX como erro vermelho. */
    public static final String PIX_SOFT_TIMEOUT_SIGNAL = "CIELO_PIX_SOFT_TIMEOUT";
    public static final String PIX_HARD_TIMEOUT_SIGNAL = "CIELO_PIX_HARD_TIMEOUT";
    /** Instância do totem — sobrevive a dropActiveInstance para callback PIX tardio. */
    private static CieloLioManager registeredAppManager;

    /** Contexto do último sucesso entregue (PIX tardio / binding). */
    public static final class SuccessDelivery {
        public final long operationId;
        public final String machineId;
        public final String pendingTxId;
        public final String sessionId;

        SuccessDelivery(long operationId, String machineId, String pendingTxId, String sessionId) {
            this.operationId = operationId;
            this.machineId = machineId == null ? "" : machineId;
            this.pendingTxId = pendingTxId == null ? "" : pendingTxId;
            this.sessionId = sessionId == null ? "" : sessionId;
        }
    }

    public static void cancelScheduledEndSession() {
        if (pendingEndSessionRunnable != null) {
            END_SESSION_HANDLER.removeCallbacks(pendingEndSessionRunnable);
            pendingEndSessionRunnable = null;
        }
    }

    private final Context context;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private Runnable processingWatchdogRunnable;
    private Runnable pixHardWatchdogRunnable;
    private Runnable dormantPixHardWatchdogRunnable;
    private boolean pixWatchdogSoftExpired;
    private volatile SuccessDelivery lastSuccessDelivery;
    private String boundSessionId;
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
    /** Binding recém-criado pelo Totem para o checkout que ainda será lançado. */
    private volatile boolean checkoutPreparedForLaunch;
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

    private static final String PREFS_REFUND = "cielo_refund_snapshot";
    private static final String PREFS_REFUND_BY_TX = "cielo_refund_by_tx";
    private static final String KEY_REFUND_PAYMENT_ID = "payment_id";
    private static final String KEY_REFUND_AUTH = "auth_code";
    private static final String KEY_REFUND_CIELO = "cielo_code";
    private static final String KEY_REFUND_AMOUNT = "amount_cents";
    private static final String KEY_REFUND_SAVED_AT = "saved_at";
    private static final String KEY_REFUND_REFERENCE = "reference";
    /** Snapshot de estorno válido por 15 min após o pagamento. */
    private static final long REFUND_SNAPSHOT_TTL_MS = 15 * 60_000L;
    /** Snapshots por TX totem — próximo pagamento NÃO sobrescreve estorno do anterior. */
    private final java.util.concurrent.ConcurrentHashMap<String, ApprovedPaymentSnapshot> refundByTotemTx =
        new java.util.concurrent.ConcurrentHashMap<>();

    private static final class ReversalWaitState {
        final CountDownLatch latch = new CountDownLatch(1);
        volatile boolean success;
        volatile String errorMessage = "";
    }

    public CieloLioManager(Context context) {
        this.context = context;
        this.isProcessing = false;
        this.isInitialized = false;
        registeredAppManager = this;
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
                int n = CieloOrderJanitor.closeUnpaidOpenOrdersQuick(
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

    /** Pagamento aberto na Cielo há tempo demais sem callback. PIX: janela SOFT (UI). */
    public boolean isProcessingStale() {
        if (!isProcessing || lastDeepLinkLaunchAtMs <= 0L) {
            return false;
        }
        long limitMs = "PIX".equalsIgnoreCase(pendingPaymentCode)
            ? PROCESSING_WATCHDOG_PIX_SOFT_MS
            : PROCESSING_WATCHDOG_MS;
        return System.currentTimeMillis() - lastDeepLinkLaunchAtMs >= limitMs;
    }

    /**
     * Libera flag isProcessing se o checkout travou.
     * PIX soft: NÃO aborta — outras máquinas podem pagar; a mesma fica bloqueada no backend.
     * @return true se o fluxo atual foi abortado (erro notificado — não iniciar novo pagamento)
     */
    public boolean releaseStaleProcessingIfNeeded() {
        expireDormantPixIfHard();
        if (isProcessingStale()) {
            boolean isPix = "PIX".equalsIgnoreCase(pendingPaymentCode);
            if (isPix) {
                Log.w(TAG, "Watchdog PIX soft: UI livre após " + PROCESSING_WATCHDOG_PIX_SOFT_MS + "ms");
                applyPixSoftTimeout("release-stale", false);
                return false;
            }
            Log.w(TAG, "Watchdog: pagamento sem callback há " + PROCESSING_WATCHDOG_MS + "ms");
            abandonExpiredBoundCheckout("watchdog-cartao");
            notifyPaymentError("Tempo esgotado aguardando resposta da Cielo. Tente novamente.");
            return true;
        }
        // Binding órfão (isProcessing já false) — PIX só após HARD 8 min.
        if (hasExpiredBoundCheckout()) {
            abandonExpiredBoundCheckout("binding-expirado");
        }
        return false;
    }

    /** True se ainda há checkout Cielo vinculado e dentro da janela de espera da UI. */
    public boolean hasFreshBoundCheckout() {
        if (!hasAnyBoundCheckout()) {
            return false;
        }
        // Sucesso já entregue ao totem: não bloqueia o próximo pagamento.
        if (successDelivered) {
            return false;
        }
        long ageMs = boundCheckoutAgeMs();
        if (ageMs < 0L) {
            return true;
        }
        return ageMs < boundCheckoutUiLimitMs();
    }

    /** Binding existe mas já passou do tempo HARD — deve ser liberado. */
    public boolean hasExpiredBoundCheckout() {
        if (!hasAnyBoundCheckout()) {
            return false;
        }
        if (successDelivered) {
            return false;
        }
        long ageMs = boundCheckoutAgeMs();
        return ageMs >= boundCheckoutHardLimitMs();
    }

    /** Limite para bloquear um segundo checkout na UI (PIX = 90s). */
    private long boundCheckoutUiLimitMs() {
        return isBoundCheckoutPix() ? PROCESSING_WATCHDOG_PIX_SOFT_MS : PROCESSING_WATCHDOG_MS;
    }

    /** Limite para abandonar o checkout (PIX = 8 min). */
    private long boundCheckoutHardLimitMs() {
        return isBoundCheckoutPix() ? PROCESSING_WATCHDOG_PIX_HARD_MS : PROCESSING_WATCHDOG_MS;
    }

    private boolean isBoundCheckoutPix() {
        String code = pendingPaymentCode;
        if (code == null || code.isEmpty()) {
            code = context.getApplicationContext()
                .getSharedPreferences(PREFS_CHECKOUT, Context.MODE_PRIVATE)
                .getString(KEY_BOUND_PAY_CODE, "");
        }
        return "PIX".equalsIgnoreCase(code);
    }

    private boolean hasAnyBoundCheckout() {
        if (getBoundTotemOperationId() > 0) {
            return true;
        }
        String tx = getBoundPendingTxId();
        return tx != null && !tx.isEmpty();
    }

    private long boundCheckoutAgeMs() {
        long started = context.getApplicationContext()
            .getSharedPreferences(PREFS_CHECKOUT, Context.MODE_PRIVATE)
            .getLong(KEY_BOUND_STARTED, 0L);
        if (started <= 0L && lastDeepLinkLaunchAtMs > 0L) {
            started = lastDeepLinkLaunchAtMs;
        }
        if (started <= 0L) {
            return -1L;
        }
        return System.currentTimeMillis() - started;
    }

    private volatile String lastAbandonedTxId = "";

    /** Consome o ID da TX abandonada no último abandonExpiredBoundCheckout (para cancelar no Supabase). */
    public String takeLastAbandonedTxId() {
        String id = lastAbandonedTxId;
        lastAbandonedTxId = "";
        return id == null ? "" : id;
    }

    /**
     * Libera checkout PIX/cartão abandonado: limpa binding, encerra sessão e fecha
     * pedidos abertos na Cielo para o próximo pagamento não falhar.
     * @return pending_tx_id abandonado (pode ser vazio)
     */
    public String abandonExpiredBoundCheckout(String reason) {
        String abandonedTx = getBoundPendingTxId();
        Log.w(TAG, "Abandonando checkout Cielo (" + reason + ") tx=" + abandonedTx);
        if (abandonedTx != null && !abandonedTx.isEmpty()) {
            lastAbandonedTxId = abandonedTx;
        }
        DormantPix dormant = loadDormantPix();
        if (dormant != null && abandonedTx != null && abandonedTx.equals(dormant.txId)) {
            clearDormantPix();
        }
        pixWatchdogSoftExpired = false;
        finishProcessingAfterCallback();
        clearBoundCheckout();
        dropActiveInstance();
        clearPendingTransaction();
        CieloPaymentSessionHelper.endSession(context);
        CieloPaymentForegroundService.stop(context);
        // Fecha só pedidos NÃO pagos. Fechar PAID destrói PIX já cobrado sem callback.
        new Thread(() -> {
            try {
                String merchant = merchantCodeForJanitor();
                String cieloEnv = CieloOrderJanitor.resolveEnvironment(environment);
                int purged = CieloOrderJanitor.closeUnpaidOpenOrdersQuick(
                    clientId, accessToken, merchant, cieloEnv);
                Log.i(TAG, "Pós-abandono: cloud purge unpaid=" + purged);
            } catch (Exception e) {
                Log.w(TAG, "Falha ao limpar pedidos após abandono", e);
            }
        }, "cielo-abandon-purge").start();
        return abandonedTx == null ? "" : abandonedTx;
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
        if (releaseStaleProcessingIfNeeded()) {
            return;
        }
        // Binding órfão expirado: libera e segue (não bloqueia o cliente).
        if (hasExpiredBoundCheckout()) {
            abandonExpiredBoundCheckout("pre-checkout");
        }
        long now = System.currentTimeMillis();
        if (now < cieloCooldownUntilMs) {
            notifyPaymentError("Aguarde alguns segundos: terminal Cielo finalizando pedido anterior.");
            return;
        }
        if (isProcessing) {
            notifyPaymentError("Ja ha uma transacao em processamento");
            return;
        }
        // bindTotemCheckout é chamado antes de processPayment para persistir a correlação.
        // Esse binding pertence ao checkout atual e não pode ser confundido com um anterior.
        boolean isPreparedCurrentCheckout = checkoutPreparedForLaunch;
        checkoutPreparedForLaunch = false;
        // Ainda dentro da janela — evita segundo checkout enquanto o anterior pode concluir.
        if (!isPreparedCurrentCheckout && hasFreshBoundCheckout() && !successDelivered) {
            long age = Math.max(0L, boundCheckoutAgeMs());
            long remainSec = Math.max(1L, (boundCheckoutUiLimitMs() - age + 999L) / 1000L);
            boolean isPixOpen = "PIX".equalsIgnoreCase(pendingPaymentCode)
                || "PIX".equalsIgnoreCase(
                    context.getApplicationContext()
                        .getSharedPreferences(PREFS_CHECKOUT, Context.MODE_PRIVATE)
                        .getString(KEY_BOUND_PAY_CODE, ""));
            String msg = isPixOpen
                ? "Ha um pagamento PIX em aberto. Aguarde " + remainSec
                    + "s para liberar automaticamente, ou conclua/cancele no terminal."
                : "Ha um pagamento em andamento na Cielo. Aguarde " + remainSec
                    + "s para liberar automaticamente.";
            notifyPaymentError(msg);
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
            int purged = CieloOrderJanitor.closeUnpaidOpenOrdersQuick(
                clientId, accessToken, merchant, cieloEnv);
            Log.i(TAG, "Pré-checkout: cloud unpaid=" + purged + " pedido(s) merchant=" + merchant);

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
            pendingReference = reference;
            pendingAmountCents = amountCents;
            pendingPaymentCode = paymentCode;
            persistCheckoutChallenge();
            scheduleProcessingWatchdog();
            CieloPaymentSessionHelper.beginSession(context, paymentCode);
            final boolean scheduleTarja = !"PIX".equalsIgnoreCase(paymentCode);

            mainHandler.post(() -> {
                if (callback != null) {
                    callback.onPaymentProcessing("Abrindo pagamento na Cielo...");
                }
                CieloPaymentForegroundService.start(context);
                lastDeepLinkLaunchAtMs = System.currentTimeMillis();
                try {
                    context.startActivity(intent);
                    Log.d(TAG, "Deep link Cielo enviado (ref=" + reference + ")");
                    if (scheduleTarja) {
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
     * Durante estorno, NÃO engole callback de um pagamento novo (máquinas em sequência).
     */
    public static void handleDeepLinkResponse(Uri uri) {
        if (pendingReversal != null) {
            new Thread(() -> {
                CieloLioManager mgr = activeInstance != null ? activeInstance : tryRehydrateActiveInstance();
                boolean looksReversal = uriLooksLikeReversalCallback(uri);
                boolean checkoutAlive = mgr != null
                    && (mgr.isProcessing || mgr.hasFreshBoundCheckout() || mgr.hasRedeemablePixCheckout())
                    && !mgr.successDelivered;
                if (checkoutAlive && !looksReversal) {
                    Log.w(TAG, "Callback durante estorno roteado ao pagamento em curso");
                    mgr.consumeDeepLinkResponse(uri);
                    return;
                }
                consumeReversalDeepLinkResponse(uri);
            }, "cielo-callback-route").start();
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

    /** Heurística: estorno Cielo costuma trazer statusCode=2 no paymentFields. */
    private static boolean uriLooksLikeReversalCallback(Uri uri) {
        if (uri == null) {
            return false;
        }
        try {
            String responseBase64 = uri.getQueryParameter("response");
            if (responseBase64 == null || responseBase64.isEmpty()) {
                return false;
            }
            String decoded = new String(Base64.decode(responseBase64, Base64.DEFAULT), StandardCharsets.UTF_8);
            String lower = decoded.toLowerCase(Locale.ROOT);
            if (lower.contains("\"statuscode\":\"2\"") || lower.contains("\"statuscode\":2")) {
                return true;
            }
            if (lower.contains("revers") || lower.contains("cancelament") || lower.contains("estorno")) {
                return true;
            }
            if (lower.contains("\"authcode\"") || lower.contains("\"cielocode\"")) {
                return false;
            }
        } catch (Exception ignored) {
            // noop
        }
        return false;
    }

    /** Vincula operação do totem — sobrevive ao timeout de inatividade durante PIX na Cielo. */
    public void bindTotemCheckout(long operationId, String machineId, String pendingTxId) {
        bindTotemCheckout(operationId, machineId, pendingTxId, null);
    }

    public void bindTotemCheckout(long operationId, String machineId, String pendingTxId, String sessionId) {
        // PIX ainda resgatável: guarda para callback tardio antes de sobrescrever o binding.
        if (hasRedeemablePixCheckout() && !isProcessing) {
            persistDormantPixFromCurrentBinding();
            Log.i(TAG, "Novo checkout — PIX anterior preservado como dormente (tx="
                + getBoundPendingTxId() + ")");
            clearBoundCheckout();
        } else if (hasAnyBoundCheckout() && !isProcessing) {
            Log.i(TAG, "Novo checkout — liberando binding anterior para pagamento seguido");
            clearBoundCheckout();
        }
        boundTotemOperationId = operationId;
        boundMachineId = machineId == null ? "" : machineId.trim();
        boundPendingTxId = pendingTxId == null ? "" : pendingTxId.trim();
        boundSessionId = sessionId == null ? "" : sessionId.trim();
        checkoutPreparedForLaunch = true;
        successDelivered = false;
        persistBoundCheckout();
        scheduleDormantPixHardWatchdog();
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

    public boolean acceptsDeliveredOperation(long operationId) {
        if (operationId <= 0) {
            return false;
        }
        if (matchesBoundOperation(operationId)) {
            return true;
        }
        DormantPix dormant = loadDormantPix();
        if (dormant != null && dormant.operationId == operationId) {
            return true;
        }
        SuccessDelivery delivered = lastSuccessDelivery;
        return delivered != null && delivered.operationId == operationId;
    }

    public SuccessDelivery takeLastSuccessDelivery() {
        SuccessDelivery d = lastSuccessDelivery;
        lastSuccessDelivery = null;
        return d;
    }

    public SuccessDelivery peekLastSuccessDelivery() {
        return lastSuccessDelivery;
    }

    public String getBoundSessionId() {
        if (boundSessionId != null && !boundSessionId.isEmpty()) {
            return boundSessionId;
        }
        return context.getApplicationContext()
            .getSharedPreferences(PREFS_CHECKOUT, Context.MODE_PRIVATE)
            .getString(KEY_BOUND_SESSION, "");
    }

    public void clearBoundCheckout() {
        boundTotemOperationId = 0L;
        boundMachineId = "";
        boundPendingTxId = "";
        boundSessionId = "";
        checkoutPreparedForLaunch = false;
        successDelivered = false;
        context.getApplicationContext()
            .getSharedPreferences(PREFS_CHECKOUT, Context.MODE_PRIVATE)
            .edit()
            .clear()
            .apply();
    }

    /** Broadcast Buzios quando deep link atrasa (comum no PIX). */
    public static void tryCompleteFromBroadcast(Context context, String source, String payload) {
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
        mgr.restoreCheckoutChallengeFromPrefs();
        String currentReference = mgr.pendingReference == null ? "" : mgr.pendingReference;
        String rawPayload = payload == null ? "" : payload;
        if (!currentReference.isEmpty()
                && rawPayload.toLowerCase(java.util.Locale.ROOT).contains("reference")
                && !rawPayload.contains(currentReference)) {
            DormantPix dormant = mgr.loadDormantPix();
            if (dormant != null && dormant.reference != null && !dormant.reference.isEmpty()
                    && rawPayload.contains(dormant.reference)) {
                Log.i(TAG, "Broadcast aprovado do PIX dormente — entregando à máquina original");
                mgr.deliverDormantPixSuccess("CIELO_BROADCAST", "broadcast-" + System.currentTimeMillis(),
                    "broadcast:" + source);
                return;
            }
            Log.w(TAG, "Broadcast aprovado de outro checkout ignorado (ref atual="
                + currentReference + ")");
            return;
        }
        Log.i(TAG, "Aprovação via broadcast — completando checkout (" + source + ")");
        // Preferir id real do Order Manager; broadcast-* não permite estorno Cielo.
        if (mgr.lastApprovedPayment == null && mgr.pendingAmountCents > 0) {
            String paymentId = extractPaymentIdFromBroadcastPayload(rawPayload);
            if (paymentId.isEmpty()) {
                paymentId = "broadcast-" + System.currentTimeMillis();
            }
            mgr.setApprovedPaymentSnapshot(new ApprovedPaymentSnapshot(
                paymentId,
                "CIELO_BROADCAST",
                "",
                mgr.pendingAmountCents
            ));
        }
        if (mgr.lastDetectedSupabasePaymentMethod == null
                && "PIX".equalsIgnoreCase(mgr.pendingPaymentCode)) {
            mgr.lastDetectedSupabasePaymentMethod = "pix";
        }
        mgr.deliverPaymentSuccess("CIELO_BROADCAST", "broadcast-" + System.currentTimeMillis(), "broadcast:" + source);
        // NÃO fecha o pedido aqui: o CLOSE precoce impede estorno se o ESP falhar.
        // onTotemCheckoutFinished() agenda o janitor após confirmação ESP ou estorno.
    }

    /** Extrai payment.id do payload Buzios quando disponível. */
    private static String extractPaymentIdFromBroadcastPayload(String payload) {
        if (payload == null || payload.isEmpty()) {
            return "";
        }
        try {
            String trimmed = payload.trim();
            if (trimmed.startsWith("{")) {
                JSONObject json = new JSONObject(trimmed);
                String id = json.optString("id", "");
                if (id.isEmpty() && json.has("payments")) {
                    JSONArray payments = json.optJSONArray("payments");
                    if (payments != null && payments.length() > 0) {
                        id = payments.getJSONObject(payments.length() - 1).optString("id", "");
                    }
                }
                if (id.isEmpty()) {
                    id = json.optString("paymentId", json.optString("payment_id", ""));
                }
                if (!id.isEmpty() && !id.startsWith("broadcast-")) {
                    return id;
                }
            }
            // Heurística: "id":"uuid-or-cielo-id"
            java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("\"(?:id|paymentId|payment_id)\"\\s*:\\s*\"([^\"]+)\"",
                    java.util.regex.Pattern.CASE_INSENSITIVE)
                .matcher(payload);
            if (m.find()) {
                String id = m.group(1);
                if (id != null && !id.isEmpty() && !id.startsWith("broadcast-")) {
                    return id;
                }
            }
        } catch (Exception ignored) {
            // noop
        }
        return "";
    }

    private static CieloLioManager tryRehydrateActiveInstance() {
        if (activeInstance != null) {
            return activeInstance;
        }
        if (registeredAppManager == null) {
            return null;
        }
        if (!registeredAppManager.hasFreshBoundCheckout()
                && !registeredAppManager.hasRedeemablePixCheckout()
                && !registeredAppManager.hasDormantPix()) {
            Log.w(TAG, "Reidratar checkout: binding ausente ou expirado");
            return null;
        }
        registeredAppManager.restoreCheckoutChallengeFromPrefs();
        Log.i(TAG, "Checkout Cielo reidratado (op="
            + registeredAppManager.boundTotemOperationId
            + ", tx=" + registeredAppManager.boundPendingTxId + ")");
        activeInstance = registeredAppManager;
        return activeInstance;
    }

    private void persistBoundCheckout() {
        context.getApplicationContext()
            .getSharedPreferences(PREFS_CHECKOUT, Context.MODE_PRIVATE)
            .edit()
            .putLong(KEY_BOUND_OPERATION, boundTotemOperationId)
            .putString(KEY_BOUND_MACHINE, boundMachineId)
            .putString(KEY_BOUND_TX, boundPendingTxId)
            .putString(KEY_BOUND_SESSION, boundSessionId == null ? "" : boundSessionId)
            .putLong(KEY_BOUND_STARTED, System.currentTimeMillis())
            .apply();
        persistCheckoutChallenge();
    }

    private void persistCheckoutChallenge() {
        context.getApplicationContext()
            .getSharedPreferences(PREFS_CHECKOUT, Context.MODE_PRIVATE)
            .edit()
            .putLong(KEY_BOUND_AMOUNT, pendingAmountCents)
            .putString(KEY_BOUND_PAY_CODE, pendingPaymentCode == null ? "" : pendingPaymentCode)
            .putString(KEY_BOUND_REFERENCE, pendingReference == null ? "" : pendingReference)
            .apply();
    }

    private void restoreCheckoutChallengeFromPrefs() {
        android.content.SharedPreferences prefs = context.getApplicationContext()
            .getSharedPreferences(PREFS_CHECKOUT, Context.MODE_PRIVATE);
        if (pendingAmountCents <= 0) {
            pendingAmountCents = prefs.getLong(KEY_BOUND_AMOUNT, 0L);
        }
        if (pendingPaymentCode == null || pendingPaymentCode.isEmpty()) {
            pendingPaymentCode = prefs.getString(KEY_BOUND_PAY_CODE, null);
        }
        if (pendingReference == null || pendingReference.isEmpty()) {
            pendingReference = prefs.getString(KEY_BOUND_REFERENCE, null);
        }
        if (boundTotemOperationId <= 0) {
            boundTotemOperationId = prefs.getLong(KEY_BOUND_OPERATION, 0L);
        }
        if (boundMachineId == null || boundMachineId.isEmpty()) {
            boundMachineId = prefs.getString(KEY_BOUND_MACHINE, "");
        }
        if (boundPendingTxId == null || boundPendingTxId.isEmpty()) {
            boundPendingTxId = prefs.getString(KEY_BOUND_TX, "");
        }
        if (boundSessionId == null || boundSessionId.isEmpty()) {
            boundSessionId = prefs.getString(KEY_BOUND_SESSION, "");
        }
    }

    private long loadBoundOperationIdFromPrefs() {
        return context.getApplicationContext()
            .getSharedPreferences(PREFS_CHECKOUT, Context.MODE_PRIVATE)
            .getLong(KEY_BOUND_OPERATION, 0L);
    }

    private void consumeDeepLinkResponse(Uri uri) {
        if (isDuplicateCallback(uri)) {
            if (successDelivered) {
                // Deep link tardio após broadcast PIX: atualiza paymentId real para estorno.
                tryUpgradeApprovedPaymentSnapshotFromUri(uri);
                Log.w(TAG, "Callback Cielo duplicado ignorado (sucesso já entregue; snapshot atualizado se possível)");
                finishProcessingAfterCallback();
                return;
            }
            Log.w(TAG, "Callback Cielo duplicado — reprocessando (sucesso ainda não entregue)");
        }

        String peekedReference = peekCallbackReference(uri);
        if (peekedReference != null && !peekedReference.isEmpty()
                && isDormantReference(peekedReference)
                && !isExpectedReference(peekedReference)) {
            Log.i(TAG, "Callback do PIX dormente — entregando à máquina original (ref="
                + peekedReference + ")");
            consumeDormantPixCallback(uri);
            return;
        }

        finishProcessingAfterCallback();
        CieloPaymentForegroundService.stop(context);

        if (uri == null) {
            CieloPaymentSessionHelper.endSession(context);
            notifyPaymentError("Resposta Cielo invalida");
            return;
        }

        boolean finalizeCheckout = true;
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
                if (isDormantReference(responseReference)) {
                    Log.i(TAG, "Callback roteado ao PIX dormente (ref=" + responseReference + ")");
                    consumeDormantPixCallback(uri);
                    finalizeCheckout = false;
                    isProcessing = true;
                    scheduleProcessingWatchdog();
                    CieloPaymentForegroundService.start(context);
                    return;
                }
                // Pode ser retorno tardio de um PIX anterior. Não derruba o checkout atual.
                Log.w(TAG, "Callback de outro checkout ignorado (recebida=" + responseReference
                    + ", atual=" + pendingReference + ")");
                finalizeCheckout = false;
                isProcessing = true;
                scheduleProcessingWatchdog();
                CieloPaymentForegroundService.start(context);
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
            setApprovedPaymentSnapshot(new ApprovedPaymentSnapshot(
                paymentId,
                authCode,
                cieloCode,
                snapshotAmount
            ));

            lastDetectedSupabasePaymentMethod = resolveSupabaseMethodFromCieloPayment(payment);
            rememberMerchantFromPayment(payment);

            CieloPrintDismissScheduler.onApprovedDetected(context, "deeplink-success");
            deliverPaymentSuccess(authCode, txnId, "deeplink-success");

            // CLOSE do pedido fica para onTotemCheckoutFinished (após ESP ou estorno).
            Log.d(TAG, "Cielo APPROVED: ref=" + pendingReference + " solicitado=" + pendingPaymentCode
                + " detectadoSupabase=" + lastDetectedSupabasePaymentMethod + " brand=" + brand + " maskSuffix=" + lastFour(mask)
                + " paymentId=" + paymentId);
        } catch (Exception e) {
            Log.e(TAG, "Erro ao processar callback Cielo", e);
            notifyPaymentError("Erro ao processar retorno Cielo: " + e.getMessage());
        } finally {
            if (finalizeCheckout) {
                scheduleEndPaymentSession();
                clearPendingTransaction();
                dropActiveInstance();
            }
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
        END_SESSION_HANDLER.postDelayed(pendingEndSessionRunnable, END_SESSION_DELAY_MS);
    }

    private void scheduleProcessingWatchdog() {
        cancelProcessingWatchdog();
        pixWatchdogSoftExpired = false;
        final boolean isPix = "PIX".equalsIgnoreCase(pendingPaymentCode);
        if (isPix) {
            processingWatchdogRunnable = () -> applyPixSoftTimeout("watchdog-soft", true);
            mainHandler.postDelayed(processingWatchdogRunnable, PROCESSING_WATCHDOG_PIX_SOFT_MS);
            cancelPixHardWatchdog();
            pixHardWatchdogRunnable = this::applyPixHardTimeout;
            mainHandler.postDelayed(pixHardWatchdogRunnable, PROCESSING_WATCHDOG_PIX_HARD_MS);
            scheduleDormantPixHardWatchdog();
            return;
        }
        processingWatchdogRunnable = () -> {
            if (successDelivered) {
                return;
            }
            if (!isProcessing) {
                return;
            }
            Log.w(TAG, "Watchdog: sem callback Cielo em " + PROCESSING_WATCHDOG_MS + "ms");
            abandonExpiredBoundCheckout("watchdog-cartao-timer");
            notifyPaymentError("Tempo esgotado aguardando resposta da Cielo. Tente novamente.");
        };
        mainHandler.postDelayed(processingWatchdogRunnable, PROCESSING_WATCHDOG_MS);
        scheduleDormantPixHardWatchdog();
    }

    private void applyPixSoftTimeout(String reason, boolean notifyUi) {
        if (successDelivered) {
            return;
        }
        if (!isBoundCheckoutPix() && !hasDormantPix()) {
            return;
        }
        boolean alreadySoft = pixWatchdogSoftExpired && !isProcessing;
        pixWatchdogSoftExpired = true;
        isProcessing = false;
        persistDormantPixFromCurrentBinding();
        CieloPaymentForegroundService.stop(context);
        CieloPaymentSessionHelper.endSession(context);
        Log.w(TAG, "PIX soft timeout (" + reason + ") — grade livre; checkout preservado para callback tardio");
        if (notifyUi && !alreadySoft) {
            notifyPaymentError(PIX_SOFT_TIMEOUT_SIGNAL);
        }
        scheduleDormantPixHardWatchdog();
    }

    private void applyPixHardTimeout() {
        if (successDelivered && !hasDormantPix()) {
            return;
        }
        if (isBoundCheckoutPix() && !successDelivered && boundCheckoutAgeMs() >= PROCESSING_WATCHDOG_PIX_HARD_MS) {
            Log.w(TAG, "PIX hard timeout — abandonando checkout não confirmado após 8 min");
            abandonExpiredBoundCheckout("watchdog-pix-hard");
            notifyPaymentError(PIX_HARD_TIMEOUT_SIGNAL);
            return;
        }
        expireDormantPixIfHard();
    }

    private void cancelProcessingWatchdog() {
        if (processingWatchdogRunnable != null) {
            mainHandler.removeCallbacks(processingWatchdogRunnable);
            processingWatchdogRunnable = null;
        }
        cancelPixHardWatchdog();
    }

    private void cancelPixHardWatchdog() {
        if (pixHardWatchdogRunnable != null) {
            mainHandler.removeCallbacks(pixHardWatchdogRunnable);
            pixHardWatchdogRunnable = null;
        }
    }

    private static final class DormantPix {
        long operationId;
        String machineId;
        String txId;
        String sessionId;
        String reference;
        String payCode;
        long amountCents;
        long startedAtMs;
    }

    public boolean hasRedeemablePixCheckout() {
        return isBoundCheckoutPix()
            && hasAnyBoundCheckout()
            && !successDelivered
            && boundCheckoutAgeMs() < PROCESSING_WATCHDOG_PIX_HARD_MS;
    }

    public boolean hasDormantPix() {
        DormantPix d = loadDormantPix();
        return d != null && d.txId != null && !d.txId.isEmpty();
    }

    private boolean isDormantReference(String reference) {
        if (reference == null || reference.isEmpty()) {
            return false;
        }
        DormantPix d = loadDormantPix();
        return d != null && reference.equals(d.reference);
    }

    private void persistDormantPixFromCurrentBinding() {
        if (!isBoundCheckoutPix() || !hasAnyBoundCheckout()) {
            return;
        }
        android.content.SharedPreferences checkout = context.getApplicationContext()
            .getSharedPreferences(PREFS_CHECKOUT, Context.MODE_PRIVATE);
        long started = checkout.getLong(KEY_BOUND_STARTED, 0L);
        if (started <= 0L && lastDeepLinkLaunchAtMs > 0L) {
            started = lastDeepLinkLaunchAtMs;
        }
        if (started <= 0L) {
            started = System.currentTimeMillis();
        }
        String reference = pendingReference;
        if (reference == null || reference.isEmpty()) {
            reference = checkout.getString(KEY_BOUND_REFERENCE, "");
        }
        long amount = pendingAmountCents > 0 ? pendingAmountCents : checkout.getLong(KEY_BOUND_AMOUNT, 0L);
        String payCode = pendingPaymentCode;
        if (payCode == null || payCode.isEmpty()) {
            payCode = checkout.getString(KEY_BOUND_PAY_CODE, "PIX");
        }
        context.getApplicationContext()
            .getSharedPreferences(PREFS_DORMANT_PIX, Context.MODE_PRIVATE)
            .edit()
            .putLong(KEY_DORMANT_OPERATION, getBoundTotemOperationId())
            .putString(KEY_DORMANT_MACHINE, getBoundMachineId())
            .putString(KEY_DORMANT_TX, getBoundPendingTxId())
            .putString(KEY_DORMANT_SESSION, getBoundSessionId())
            .putLong(KEY_DORMANT_STARTED, started)
            .putLong(KEY_DORMANT_AMOUNT, amount)
            .putString(KEY_DORMANT_PAY_CODE, payCode == null ? "PIX" : payCode)
            .putString(KEY_DORMANT_REFERENCE, reference == null ? "" : reference)
            .apply();
        Log.i(TAG, "PIX dormente persistido tx=" + getBoundPendingTxId()
            + " ref=" + reference + " started=" + started);
        scheduleDormantPixHardWatchdog();
    }

    private DormantPix loadDormantPix() {
        android.content.SharedPreferences prefs = context.getApplicationContext()
            .getSharedPreferences(PREFS_DORMANT_PIX, Context.MODE_PRIVATE);
        String tx = prefs.getString(KEY_DORMANT_TX, "");
        if (tx == null || tx.isEmpty()) {
            return null;
        }
        DormantPix d = new DormantPix();
        d.operationId = prefs.getLong(KEY_DORMANT_OPERATION, 0L);
        d.machineId = prefs.getString(KEY_DORMANT_MACHINE, "");
        d.txId = tx;
        d.sessionId = prefs.getString(KEY_DORMANT_SESSION, "");
        d.reference = prefs.getString(KEY_DORMANT_REFERENCE, "");
        d.payCode = prefs.getString(KEY_DORMANT_PAY_CODE, "PIX");
        d.amountCents = prefs.getLong(KEY_DORMANT_AMOUNT, 0L);
        d.startedAtMs = prefs.getLong(KEY_DORMANT_STARTED, 0L);
        return d;
    }

    private void clearDormantPix() {
        if (dormantPixHardWatchdogRunnable != null) {
            mainHandler.removeCallbacks(dormantPixHardWatchdogRunnable);
            dormantPixHardWatchdogRunnable = null;
        }
        context.getApplicationContext()
            .getSharedPreferences(PREFS_DORMANT_PIX, Context.MODE_PRIVATE)
            .edit()
            .clear()
            .apply();
    }

    private void scheduleDormantPixHardWatchdog() {
        if (dormantPixHardWatchdogRunnable != null) {
            mainHandler.removeCallbacks(dormantPixHardWatchdogRunnable);
            dormantPixHardWatchdogRunnable = null;
        }
        DormantPix d = loadDormantPix();
        if (d == null) {
            return;
        }
        long dueAt = d.startedAtMs + PROCESSING_WATCHDOG_PIX_HARD_MS;
        long delay = dueAt - System.currentTimeMillis();
        if (delay <= 0L) {
            expireDormantPixIfHard();
            return;
        }
        dormantPixHardWatchdogRunnable = this::expireDormantPixIfHard;
        mainHandler.postDelayed(dormantPixHardWatchdogRunnable, delay);
    }

    private void expireDormantPixIfHard() {
        DormantPix d = loadDormantPix();
        if (d == null) {
            return;
        }
        long age = d.startedAtMs <= 0L ? Long.MAX_VALUE : System.currentTimeMillis() - d.startedAtMs;
        if (age < PROCESSING_WATCHDOG_PIX_HARD_MS) {
            return;
        }
        Log.w(TAG, "PIX dormente expirado após 8 min tx=" + d.txId);
        if (d.txId != null && !d.txId.isEmpty()) {
            lastAbandonedTxId = d.txId;
        }
        clearDormantPix();
        new Thread(() -> {
            try {
                String merchant = merchantCodeForJanitor();
                String cieloEnv = CieloOrderJanitor.resolveEnvironment(environment);
                int purged = CieloOrderJanitor.closeUnpaidOpenOrdersQuick(
                    clientId, accessToken, merchant, cieloEnv);
                Log.i(TAG, "PIX dormente hard expire: unpaid purge=" + purged);
            } catch (Exception e) {
                Log.w(TAG, "Falha ao limpar pedidos do PIX dormente", e);
            }
        }, "cielo-dormant-purge").start();
    }

    private String peekCallbackReference(Uri uri) {
        if (uri == null) {
            return null;
        }
        try {
            String responseBase64 = uri.getQueryParameter("response");
            if (responseBase64 == null || responseBase64.isEmpty()) {
                return null;
            }
            String decoded = new String(Base64.decode(responseBase64, Base64.DEFAULT), StandardCharsets.UTF_8);
            JSONObject json = new JSONObject(decoded);
            return json.optString("reference", "");
        } catch (Exception ignored) {
            return null;
        }
    }

    private void consumeDormantPixCallback(Uri uri) {
        DormantPix dormant = loadDormantPix();
        if (dormant == null || uri == null) {
            return;
        }
        try {
            String responseBase64 = uri.getQueryParameter("response");
            String responseCode = uri.getQueryParameter("responsecode");
            if (responseBase64 == null || responseBase64.isEmpty()) {
                return;
            }
            if ("2".equals(responseCode)) {
                Log.w(TAG, "PIX dormente cancelado no terminal (responsecode=2)");
                if (dormant.txId != null && !dormant.txId.isEmpty()) {
                    lastAbandonedTxId = dormant.txId;
                }
                clearDormantPix();
                return;
            }
            String decoded = new String(Base64.decode(responseBase64, Base64.DEFAULT), StandardCharsets.UTF_8);
            JSONObject json = new JSONObject(decoded);
            if (json.has("code") && json.has("reason")) {
                Log.w(TAG, "PIX dormente: erro Cielo ignorado no checkout atual: "
                    + json.optString("reason", ""));
                return;
            }
            JSONArray payments = json.optJSONArray("payments");
            if (payments == null || payments.length() == 0) {
                Log.w(TAG, "PIX dormente: callback sem pagamento confirmado");
                return;
            }
            JSONObject payment = payments.getJSONObject(payments.length() - 1);
            long paidAmount = payment.optLong("amount", json.optLong("paidAmount", -1));
            if (dormant.amountCents > 0 && paidAmount > 0 && paidAmount != dormant.amountCents) {
                Log.w(TAG, "PIX dormente: valor divergente esperado=" + dormant.amountCents
                    + " recebido=" + paidAmount);
                return;
            }
            String authCode = payment.optString("authCode", "");
            String cieloCode = payment.optString("cieloCode", "");
            String txnId = payment.optString("externalId", json.optString("id",
                String.valueOf(System.currentTimeMillis())));
            if (authCode.isEmpty()) {
                authCode = cieloCode.isEmpty() ? txnId : cieloCode;
            }
            String paymentId = payment.optString("id", json.optString("id", txnId));
            String savedTx = boundPendingTxId;
            boundPendingTxId = dormant.txId;
            setApprovedPaymentSnapshot(new ApprovedPaymentSnapshot(
                paymentId,
                authCode,
                cieloCode,
                paidAmount > 0 ? paidAmount : dormant.amountCents
            ));
            boundPendingTxId = savedTx;
            lastDetectedSupabasePaymentMethod = "pix";
            rememberMerchantFromPayment(payment);
            CieloPrintDismissScheduler.onApprovedDetected(context, "dormant-pix");
            deliverDormantPixSuccess(authCode, txnId, "dormant-deeplink");
        } catch (Exception e) {
            Log.w(TAG, "Falha ao processar callback PIX dormente", e);
        }
    }

    private void deliverDormantPixSuccess(String authCode, String txnId, String source) {
        DormantPix d = loadDormantPix();
        if (d == null) {
            return;
        }
        lastSuccessDelivery = new SuccessDelivery(d.operationId, d.machineId, d.txId, d.sessionId);
        Log.i(TAG, "PIX dormente aprovado (" + source + ") tx=" + d.txId + " machine=" + d.machineId);
        clearDormantPix();
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

    /**
     * Após PIX via broadcast, o deep link tardio traz o payment.id real.
     * Atualiza o snapshot para permitir estorno automático se o ESP falhar.
     */
    private void tryUpgradeApprovedPaymentSnapshotFromUri(Uri uri) {
        if (uri == null) {
            return;
        }
        try {
            String responseBase64 = uri.getQueryParameter("response");
            if (responseBase64 == null || responseBase64.isEmpty()) {
                return;
            }
            String decoded = new String(Base64.decode(responseBase64, Base64.DEFAULT), StandardCharsets.UTF_8);
            JSONObject json = new JSONObject(decoded);
            if (json.has("code") && json.has("reason")) {
                return;
            }
            JSONArray payments = json.optJSONArray("payments");
            if (payments == null || payments.length() == 0) {
                return;
            }
            JSONObject payment = payments.getJSONObject(payments.length() - 1);
            String paymentId = payment.optString("id", "");
            if (paymentId.isEmpty()) {
                paymentId = json.optString("id", "");
            }
            if (paymentId.isEmpty() || paymentId.startsWith("broadcast-")) {
                return;
            }
            String authCode = payment.optString("authCode", payment.optString("cieloCode", ""));
            String cieloCode = payment.optString("cieloCode", "");
            long amount = payment.optLong("amount", pendingAmountCents);
            boolean needsUpgrade = lastApprovedPayment == null
                || lastApprovedPayment.paymentId == null
                || lastApprovedPayment.paymentId.isEmpty()
                || lastApprovedPayment.paymentId.startsWith("broadcast-");
            if (!needsUpgrade) {
                return;
            }
            lastApprovedPayment = new ApprovedPaymentSnapshot(paymentId, authCode, cieloCode, amount);
            persistRefundSnapshot(lastApprovedPayment);
            String txId = boundPendingTxId;
            if (txId == null || txId.isEmpty()) {
                txId = getBoundPendingTxId();
            }
            if (txId != null && !txId.isEmpty()) {
                rememberRefundSnapshotForTx(txId, lastApprovedPayment);
            }
            rememberMerchantFromPayment(payment);
            Log.i(TAG, "Snapshot de estorno atualizado com paymentId real=" + paymentId);
        } catch (Exception e) {
            Log.w(TAG, "Falha ao atualizar snapshot de estorno do deep link tardio", e);
        }
    }

    private synchronized void deliverPaymentSuccess(String authCode, String txnId, String source) {
        if (successDelivered) {
            Log.d(TAG, "Sucesso já entregue — ignorando " + source);
            return;
        }
        successDelivered = true;
        lastSuccessDelivery = new SuccessDelivery(
            getBoundTotemOperationId(),
            getBoundMachineId(),
            getBoundPendingTxId(),
            getBoundSessionId()
        );
        DormantPix dormant = loadDormantPix();
        if (dormant != null && dormant.txId != null && dormant.txId.equals(getBoundPendingTxId())) {
            clearDormantPix();
        }
        Log.i(TAG, "Pagamento aprovado (" + source + ") auth=" + authCode + " txn=" + txnId
            + " tx=" + getBoundPendingTxId());
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
            cieloCooldownUntilMs = System.currentTimeMillis() + COOLDOWN_AFTER_4281_MS;
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

    /**
     * Libera o binding para o próximo pagamento sem descartar o snapshot
     * necessário ao estorno se o ESP32 não confirmar.
     */
    public void releaseCheckoutForNextPayment() {
        clearBoundCheckout();
        Log.d(TAG, "Checkout liberado para próximo pagamento (snapshot estorno preservado="
            + hasApprovedPaymentSnapshot() + ")");
    }

    /** Snapshot atual (ou persistido) para estorno — não consome. */
    public ApprovedPaymentSnapshot peekApprovedPaymentSnapshot() {
        if (isReversibleSnapshot(lastApprovedPayment)) {
            return lastApprovedPayment;
        }
        ApprovedPaymentSnapshot fromPrefs = loadRefundSnapshot();
        if (isReversibleSnapshot(fromPrefs)) {
            lastApprovedPayment = fromPrefs;
            return fromPrefs;
        }
        if (lastApprovedPayment != null) {
            return lastApprovedPayment;
        }
        return fromPrefs;
    }

    public static boolean isReversibleSnapshot(ApprovedPaymentSnapshot snap) {
        if (snap == null) {
            return false;
        }
        String id = snap.paymentId;
        return id != null && !id.isEmpty() && !id.startsWith("broadcast-");
    }

    private void setApprovedPaymentSnapshot(ApprovedPaymentSnapshot snap) {
        lastApprovedPayment = snap;
        // Persiste também ids sintéticos — a reference permite resolver o paymentId real depois.
        persistRefundSnapshot(snap);
        String txId = boundPendingTxId;
        if (txId == null || txId.isEmpty()) {
            txId = getBoundPendingTxId();
        }
        if (txId != null && !txId.isEmpty()) {
            rememberRefundSnapshotForTx(txId, snap);
        }
        String ref = loadRefundReference();
        if (ref != null && !ref.isEmpty()) {
            CieloOrderJanitor.setProtectedRefundReference(ref);
        }
    }

    /** Guarda snapshot de estorno ligado à TX totem (sobrevive ao próximo checkout). */
    public void rememberRefundSnapshotForTx(String totemTxId, ApprovedPaymentSnapshot snap) {
        if (totemTxId == null || totemTxId.trim().isEmpty() || snap == null) {
            return;
        }
        String key = totemTxId.trim();
        refundByTotemTx.put(key, snap);
        persistTxRefundSnapshot(key, snap);
        Log.d(TAG, "Snapshot estorno ligado à TX totem=" + key
            + " paymentId=" + snap.paymentId + " reversible=" + isReversibleSnapshot(snap));
    }

    /** Prefere snapshot da TX; senão cai no snapshot global. */
    public ApprovedPaymentSnapshot peekRefundSnapshotForTx(String totemTxId) {
        if (totemTxId != null && !totemTxId.trim().isEmpty()) {
            String key = totemTxId.trim();
            ApprovedPaymentSnapshot mem = refundByTotemTx.get(key);
            if (isReversibleSnapshot(mem)) {
                return mem;
            }
            ApprovedPaymentSnapshot disk = loadTxRefundSnapshot(key);
            if (isReversibleSnapshot(disk)) {
                refundByTotemTx.put(key, disk);
                return disk;
            }
            if (mem != null) {
                return resolveReversibleSnapshot(mem);
            }
            if (disk != null) {
                return resolveReversibleSnapshot(disk);
            }
        }
        return peekApprovedPaymentSnapshot();
    }

    public void clearRefundSnapshotForTx(String totemTxId) {
        if (totemTxId == null || totemTxId.trim().isEmpty()) {
            return;
        }
        String key = totemTxId.trim();
        refundByTotemTx.remove(key);
        if (context != null) {
            context.getApplicationContext()
                .getSharedPreferences(PREFS_REFUND_BY_TX, Context.MODE_PRIVATE)
                .edit()
                .remove(key)
                .apply();
        }
    }

    private void persistTxRefundSnapshot(String totemTxId, ApprovedPaymentSnapshot snap) {
        if (context == null || totemTxId == null || snap == null) {
            return;
        }
        try {
            JSONObject json = new JSONObject();
            json.put("payment_id", snap.paymentId);
            json.put("auth_code", snap.authCode);
            json.put("cielo_code", snap.cieloCode);
            json.put("amount_cents", snap.amountCents);
            json.put("reference", loadRefundReference());
            json.put("saved_at", System.currentTimeMillis());
            context.getApplicationContext()
                .getSharedPreferences(PREFS_REFUND_BY_TX, Context.MODE_PRIVATE)
                .edit()
                .putString(totemTxId, json.toString())
                .apply();
        } catch (Exception e) {
            Log.w(TAG, "persistTxRefundSnapshot falhou", e);
        }
    }

    private ApprovedPaymentSnapshot loadTxRefundSnapshot(String totemTxId) {
        if (context == null || totemTxId == null) {
            return null;
        }
        try {
            String raw = context.getApplicationContext()
                .getSharedPreferences(PREFS_REFUND_BY_TX, Context.MODE_PRIVATE)
                .getString(totemTxId, null);
            if (raw == null || raw.isEmpty()) {
                return null;
            }
            JSONObject json = new JSONObject(raw);
            long savedAt = json.optLong("saved_at", 0L);
            if (savedAt <= 0L || System.currentTimeMillis() - savedAt > REFUND_SNAPSHOT_TTL_MS) {
                return null;
            }
            String id = json.optString("payment_id", "");
            if (id.isEmpty()) {
                return null;
            }
            return new ApprovedPaymentSnapshot(
                id,
                json.optString("auth_code", ""),
                json.optString("cielo_code", ""),
                json.optLong("amount_cents", 0L)
            );
        } catch (Exception e) {
            Log.w(TAG, "loadTxRefundSnapshot falhou", e);
            return null;
        }
    }

    private void persistRefundSnapshot(ApprovedPaymentSnapshot snap) {
        if (snap == null || context == null) {
            return;
        }
        String reference = pendingReference;
        if (reference == null || reference.isEmpty()) {
            reference = context.getApplicationContext()
                .getSharedPreferences(PREFS_CHECKOUT, Context.MODE_PRIVATE)
                .getString(KEY_BOUND_REFERENCE, "");
        }
        if (reference == null || reference.isEmpty()) {
            reference = context.getApplicationContext()
                .getSharedPreferences(PREFS_REFUND, Context.MODE_PRIVATE)
                .getString(KEY_REFUND_REFERENCE, "");
        }
        context.getApplicationContext()
            .getSharedPreferences(PREFS_REFUND, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_REFUND_PAYMENT_ID, snap.paymentId)
            .putString(KEY_REFUND_AUTH, snap.authCode)
            .putString(KEY_REFUND_CIELO, snap.cieloCode)
            .putLong(KEY_REFUND_AMOUNT, snap.amountCents)
            .putString(KEY_REFUND_REFERENCE, reference == null ? "" : reference)
            .putLong(KEY_REFUND_SAVED_AT, System.currentTimeMillis())
            .apply();
    }

    private ApprovedPaymentSnapshot loadRefundSnapshot() {
        if (context == null) {
            return null;
        }
        android.content.SharedPreferences prefs = context.getApplicationContext()
            .getSharedPreferences(PREFS_REFUND, Context.MODE_PRIVATE);
        long savedAt = prefs.getLong(KEY_REFUND_SAVED_AT, 0L);
        if (savedAt <= 0L || System.currentTimeMillis() - savedAt > REFUND_SNAPSHOT_TTL_MS) {
            return null;
        }
        String id = prefs.getString(KEY_REFUND_PAYMENT_ID, "");
        if (id == null || id.isEmpty()) {
            return null;
        }
        return new ApprovedPaymentSnapshot(
            id,
            prefs.getString(KEY_REFUND_AUTH, ""),
            prefs.getString(KEY_REFUND_CIELO, ""),
            prefs.getLong(KEY_REFUND_AMOUNT, 0L)
        );
    }

    private String loadRefundReference() {
        if (context == null) {
            return "";
        }
        if (pendingReference != null && !pendingReference.isEmpty()) {
            return pendingReference;
        }
        android.content.SharedPreferences refundPrefs = context.getApplicationContext()
            .getSharedPreferences(PREFS_REFUND, Context.MODE_PRIVATE);
        String fromRefund = refundPrefs.getString(KEY_REFUND_REFERENCE, "");
        if (fromRefund != null && !fromRefund.isEmpty()) {
            return fromRefund;
        }
        return context.getApplicationContext()
            .getSharedPreferences(PREFS_CHECKOUT, Context.MODE_PRIVATE)
            .getString(KEY_BOUND_REFERENCE, "");
    }

    /**
     * Tenta obter payment.id real no Order Manager o quanto antes
     * (antes do próximo checkout fechar pedidos PAID).
     */
    public void ensureReversiblePaymentSnapshot() {
        try {
            resolveReversibleSnapshot(peekApprovedPaymentSnapshot());
        } catch (Exception e) {
            Log.w(TAG, "ensureReversiblePaymentSnapshot falhou", e);
        }
    }

    /**
     * Quando o sucesso veio só por broadcast, busca payment.id real no Order Manager.
     */
    private ApprovedPaymentSnapshot resolveReversibleSnapshot(ApprovedPaymentSnapshot snap) {
        if (isReversibleSnapshot(snap)) {
            return snap;
        }
        String reference = loadRefundReference();
        if (reference == null || reference.isEmpty()) {
            Log.e(TAG, "Estorno: sem reference para resolver paymentId no Order Manager");
            return snap;
        }
        CieloOrderJanitor.PaymentRef found = CieloOrderJanitor.findPaymentByReference(
            clientId,
            accessToken,
            merchantCodeForJanitor(),
            environment,
            reference
        );
        if (found == null) {
            Log.e(TAG, "Estorno: Order Manager não retornou payment para ref=" + reference);
            return snap;
        }
        long amount = found.amountCents > 0
            ? found.amountCents
            : (snap != null ? snap.amountCents : pendingAmountCents);
        ApprovedPaymentSnapshot resolved = new ApprovedPaymentSnapshot(
            found.paymentId,
            found.authCode.isEmpty() && snap != null ? snap.authCode : found.authCode,
            found.cieloCode.isEmpty() && snap != null ? snap.cieloCode : found.cieloCode,
            amount
        );
        setApprovedPaymentSnapshot(resolved);
        Log.i(TAG, "Snapshot de estorno resolvido via Order Manager paymentId=" + found.paymentId);
        return resolved;
    }

    private void clearRefundSnapshotPrefs() {
        if (context == null) {
            return;
        }
        context.getApplicationContext()
            .getSharedPreferences(PREFS_REFUND, Context.MODE_PRIVATE)
            .edit()
            .clear()
            .apply();
        CieloOrderJanitor.clearProtectedRefundReference();
    }

    /** Descarta o snapshot de estorno após liberação ESP confirmada. */
    public void consumeApprovedPaymentSnapshot() {
        lastApprovedPayment = null;
        clearRefundSnapshotPrefs();
    }

    /** Limpa checkout após sucesso confirmado, estorno ou erro definitivo no totem. */
    public void onTotemCheckoutFinished() {
        clearBoundCheckout();
        lastApprovedPayment = null;
        clearRefundSnapshotPrefs();
        // Fecha pedidos cloud só depois de confirmar ESP ou tentar estorno —
        // fechar antes impede o payment-reversal da Cielo.
        schedulePaidOrderCleanup(null);
    }

    public boolean hasApprovedPaymentSnapshot() {
        ApprovedPaymentSnapshot snap = peekApprovedPaymentSnapshot();
        if (isReversibleSnapshot(snap)) {
            return true;
        }
        // Ainda pode estornar após resolver no Order Manager pela reference.
        String ref = loadRefundReference();
        return ref != null && !ref.isEmpty() && snap != null && snap.amountCents > 0;
    }

    /**
     * Estorno automático na Cielo quando o ESP32 não confirma liberação.
     * Bloqueia até o callback order://response ou timeout.
     */
    public boolean requestAutomaticReversal() {
        return requestAutomaticReversal(peekApprovedPaymentSnapshot());
    }

    public boolean requestAutomaticReversal(ApprovedPaymentSnapshot snap) {
        if (snap == null) {
            snap = peekApprovedPaymentSnapshot();
        }
        snap = resolveReversibleSnapshot(snap);
        if (!isReversibleSnapshot(snap)) {
            Log.e(TAG, "Estorno automático: snapshot de pagamento ausente ou inválido");
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
                Log.i(TAG, "Estorno Cielo confirmado paymentId=" + snap.paymentId);
                if (lastApprovedPayment != null
                        && snap.paymentId.equals(lastApprovedPayment.paymentId)) {
                    lastApprovedPayment = null;
                    clearRefundSnapshotPrefs();
                }
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
