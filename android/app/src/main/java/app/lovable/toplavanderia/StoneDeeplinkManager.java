package app.lovable.toplavanderia;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Integração Stone POS via Deeplink (modelo recomendado pela Stone).
 * Pagamento: payment-app://pay — Cancelamento: cancel-app://cancel
 *
 * O SDK nativo completo (Provider) exige token PackageCloud privado;
 * Deeplink não precisa de StoneStart.init e usa o app Stone do terminal.
 */
public class StoneDeeplinkManager implements PaymentManager {
    private static final String TAG = "StoneDeeplink";
    public static final String RETURN_SCHEME = "toplavanderia-stone";
    private static final long PAYMENT_TIMEOUT_MS = 180_000L;
    private static final long CANCEL_TIMEOUT_MS = 60_000L;

    private static volatile StoneDeeplinkManager instance;

    private final Activity activity;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private PaymentCallback callback;
    private final AtomicBoolean processing = new AtomicBoolean(false);
    private final AtomicBoolean cancelInFlight = new AtomicBoolean(false);
    private boolean configured;
    private String stoneCode = "";
    private String appKey = "";
    private String environment = "sandbox";
    private String deviceSerial = "";

    private String pendingOrderId = "";
    private long pendingAmountCents;
    private String lastAuthCode = "";
    private String lastAtk = "";
    private String lastItk = "";
    private long lastAmountCents;
    private String lastDetectedMethod = "credit";
    private String boundPendingTxId = "";
    private String boundMachineId = "";
    private long boundOperationId = -1L;

    private final ConcurrentHashMap<String, ApprovedPaymentSnapshot> refundByTotemTx = new ConcurrentHashMap<>();
    private Runnable timeoutRunnable;

    public static final class ApprovedPaymentSnapshot {
        public final String atk;
        public final String itk;
        public final String authCode;
        public final long amountCents;
        public final String orderId;

        public ApprovedPaymentSnapshot(String atk, String itk, String authCode, long amountCents, String orderId) {
            this.atk = atk == null ? "" : atk;
            this.itk = itk == null ? "" : itk;
            this.authCode = authCode == null ? "" : authCode;
            this.amountCents = amountCents;
            this.orderId = orderId == null ? "" : orderId;
        }
    }

    public StoneDeeplinkManager(Activity activity) {
        this.activity = activity;
        instance = this;
    }

    public static StoneDeeplinkManager getInstance() {
        return instance;
    }

    public void configure(String stoneCode, String appKey, String environment, String deviceSerial) {
        this.stoneCode = stoneCode == null ? "" : stoneCode.trim();
        this.appKey = appKey == null ? "" : appKey.trim();
        this.environment = environment == null || environment.isEmpty() ? "sandbox" : environment.trim();
        this.deviceSerial = deviceSerial == null ? "" : deviceSerial.trim();
        this.configured = !this.stoneCode.isEmpty() && !this.appKey.isEmpty();
        Log.i(TAG, "Configure stoneCode=" + (this.stoneCode.isEmpty() ? "vazio" : "ok")
            + " env=" + this.environment + " configured=" + configured);
    }

    public String getConfigurationError() {
        if (stoneCode.isEmpty()) {
            return "Stone Code não configurado no painel admin.";
        }
        if (appKey.isEmpty()) {
            return "AppKey Stone não configurada no painel admin.";
        }
        return null;
    }

    @Override
    public void setCallback(PaymentCallback callback) {
        this.callback = callback;
    }

    @Override
    public boolean isInitialized() {
        return configured;
    }

    @Override
    public boolean isProcessing() {
        return processing.get() || cancelInFlight.get();
    }

    public void bindTotemCheckout(long operationId, String machineId, String pendingTxId) {
        this.boundOperationId = operationId;
        this.boundMachineId = machineId == null ? "" : machineId;
        this.boundPendingTxId = pendingTxId == null ? "" : pendingTxId;
    }

    public String getBoundPendingTxId() {
        return boundPendingTxId;
    }

    public String getBoundMachineId() {
        return boundMachineId;
    }

    public boolean matchesBoundOperation(long operationId) {
        return boundOperationId > 0 && boundOperationId == operationId;
    }

    public String takeLastDetectedSupabasePaymentMethod() {
        String m = lastDetectedMethod;
        lastDetectedMethod = "credit";
        return m;
    }

    public ApprovedPaymentSnapshot peekApprovedPaymentSnapshot() {
        if (lastAtk.isEmpty() && lastAuthCode.isEmpty()) {
            return null;
        }
        return new ApprovedPaymentSnapshot(lastAtk, lastItk, lastAuthCode, lastAmountCents, pendingOrderId);
    }

    public void rememberRefundSnapshotForTx(String totemTxId, ApprovedPaymentSnapshot snap) {
        if (totemTxId == null || totemTxId.isEmpty() || snap == null) {
            return;
        }
        refundByTotemTx.put(totemTxId.trim(), snap);
    }

    public ApprovedPaymentSnapshot peekRefundSnapshotForTx(String totemTxId) {
        if (totemTxId == null || totemTxId.isEmpty()) {
            return null;
        }
        return refundByTotemTx.get(totemTxId.trim());
    }

    public void clearRefundSnapshotForTx(String totemTxId) {
        if (totemTxId != null && !totemTxId.isEmpty()) {
            refundByTotemTx.remove(totemTxId.trim());
        }
    }

    public boolean hasApprovedPaymentSnapshot() {
        return peekApprovedPaymentSnapshot() != null;
    }

    @Override
    public void processPayment(double amount, String paymentType, String description, String orderId) {
        if (!configured) {
            notifyError(getConfigurationError());
            return;
        }
        if (!processing.compareAndSet(false, true)) {
            notifyError("Pagamento Stone já em andamento.");
            return;
        }
        pendingAmountCents = Math.max(1L, Math.round(amount * 100.0));
        pendingOrderId = orderId == null || orderId.isEmpty()
            ? String.valueOf(System.currentTimeMillis())
            : orderId;
        String type = mapTransactionType(paymentType);
        lastDetectedMethod = toSupabaseMethod(paymentType);

        try {
            Uri.Builder builder = new Uri.Builder()
                .scheme("payment-app")
                .authority("pay")
                .appendQueryParameter("return_scheme", RETURN_SCHEME)
                .appendQueryParameter("amount", String.valueOf(pendingAmountCents))
                .appendQueryParameter("editable_amount", "0")
                .appendQueryParameter("transaction_type", type)
                .appendQueryParameter("installment_type", "NONE")
                .appendQueryParameter("order_id", sanitizeOrderId(pendingOrderId));

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.setData(builder.build());
            activity.startActivity(intent);
            notifyProcessing("Abrindo pagamento Stone…");
            schedulePaymentTimeout();
            Log.i(TAG, "Deeplink pagamento enviado amount=" + pendingAmountCents + " type=" + type);
        } catch (Exception e) {
            processing.set(false);
            Log.e(TAG, "Falha ao abrir deeplink Stone", e);
            notifyError("Não foi possível abrir o app Stone. Verifique se o POS tem o app de pagamento instalado.");
        }
    }

    @Override
    public void cancelPayment() {
        processing.set(false);
        clearPaymentTimeout();
    }

    /**
     * Estorno via cancel-app://cancel usando ATK da autorização.
     * Bloqueia até timeout ou callback (chamado de thread de background).
     */
    public boolean requestAutomaticReversal(ApprovedPaymentSnapshot snap) {
        ApprovedPaymentSnapshot use = snap != null ? snap : peekApprovedPaymentSnapshot();
        if (use == null || use.atk.isEmpty()) {
            Log.e(TAG, "Estorno Stone indisponível: sem ATK");
            return false;
        }
        if (!cancelInFlight.compareAndSet(false, true)) {
            Log.w(TAG, "Cancelamento Stone já em andamento");
            return false;
        }
        final AtomicBoolean success = new AtomicBoolean(false);
        final Object lock = new Object();
        cancelResultHolder = new CancelResultHolder(success, lock);

        try {
            Uri.Builder builder = new Uri.Builder()
                .scheme("cancel-app")
                .authority("cancel")
                .appendQueryParameter("return_scheme", RETURN_SCHEME)
                .appendQueryParameter("returnscheme", RETURN_SCHEME)
                .appendQueryParameter("atk", use.atk)
                .appendQueryParameter("amount", String.valueOf(Math.max(1L, use.amountCents)))
                .appendQueryParameter("editable_amount", "false");

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.setData(builder.build());
            activity.startActivity(intent);
            Log.i(TAG, "Deeplink cancelamento Stone enviado atk=" + use.atk);

            synchronized (lock) {
                lock.wait(CANCEL_TIMEOUT_MS);
            }
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            Log.e(TAG, "Falha ao abrir cancelamento Stone", e);
        } finally {
            cancelInFlight.set(false);
            cancelResultHolder = null;
        }
        return success.get();
    }

    private static final class CancelResultHolder {
        final AtomicBoolean success;
        final Object lock;

        CancelResultHolder(AtomicBoolean success, Object lock) {
            this.success = success;
            this.lock = lock;
        }
    }

    private static volatile CancelResultHolder cancelResultHolder;

    public static void handleDeepLinkResponse(Uri uri) {
        StoneDeeplinkManager mgr = instance;
        if (mgr == null) {
            Log.w(TAG, "Callback Stone sem manager ativo");
            return;
        }
        mgr.onDeepLinkResponse(uri);
    }

    private void onDeepLinkResponse(Uri uri) {
        if (uri == null) {
            finishWithError("Retorno Stone vazio");
            return;
        }
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.US);
        String path = uri.getPath() == null ? "" : uri.getPath().toLowerCase(Locale.US);
        boolean isCancel = host.contains("cancel") || path.contains("cancel")
            || "true".equalsIgnoreCase(uri.getQueryParameter("success"))
                && uri.getQueryParameter("canceledamount") != null;

        if (cancelInFlight.get() || isCancelReturn(uri)) {
            handleCancelReturn(uri);
            return;
        }
        handlePayReturn(uri);
    }

    private boolean isCancelReturn(Uri uri) {
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.US);
        return host.contains("cancel")
            || uri.getQueryParameter("canceledamount") != null
            || uri.getQueryParameter("canceledAmount") != null;
    }

    private void handlePayReturn(Uri uri) {
        clearPaymentTimeout();
        String code = firstNonEmpty(uri.getQueryParameter("code"), uri.getQueryParameter("responsecode"));
        String message = firstNonEmpty(uri.getQueryParameter("message"), uri.getQueryParameter("reason"));
        boolean successFlag = "true".equalsIgnoreCase(uri.getQueryParameter("success"));
        boolean ok = "0".equals(code) || successFlag;

        if (!ok) {
            processing.set(false);
            notifyError(message == null || message.isEmpty()
                ? ("Pagamento Stone recusado (código " + code + ")")
                : message);
            return;
        }

        lastAtk = firstNonEmpty(uri.getQueryParameter("atk"), "");
        lastItk = firstNonEmpty(uri.getQueryParameter("itk"), "");
        lastAuthCode = firstNonEmpty(
            uri.getQueryParameter("authorization_code"),
            uri.getQueryParameter("authorizationcode"),
            lastAtk
        );
        String amountStr = uri.getQueryParameter("amount");
        if (amountStr != null && !amountStr.isEmpty()) {
            try {
                lastAmountCents = Long.parseLong(amountStr);
            } catch (NumberFormatException ignored) {
                lastAmountCents = pendingAmountCents;
            }
        } else {
            lastAmountCents = pendingAmountCents;
        }
        String type = firstNonEmpty(uri.getQueryParameter("type"), "");
        if (!type.isEmpty()) {
            lastDetectedMethod = toSupabaseMethod(type);
        }

        if (!boundPendingTxId.isEmpty()) {
            rememberRefundSnapshotForTx(boundPendingTxId, peekApprovedPaymentSnapshot());
        }

        processing.set(false);
        String txId = !lastAtk.isEmpty() ? lastAtk : pendingOrderId;
        notifySuccess(lastAuthCode.isEmpty() ? txId : lastAuthCode, txId);
        Log.i(TAG, "Pagamento Stone aprovado atk=" + lastAtk + " auth=" + lastAuthCode);
    }

    private void handleCancelReturn(Uri uri) {
        boolean ok = "true".equalsIgnoreCase(uri.getQueryParameter("success"))
            || "0".equals(uri.getQueryParameter("code"))
            || "0000".equals(uri.getQueryParameter("responsecode"))
            || "APPROVED".equalsIgnoreCase(uri.getQueryParameter("reason"));
        CancelResultHolder holder = cancelResultHolder;
        if (holder != null) {
            holder.success.set(ok);
            synchronized (holder.lock) {
                holder.lock.notifyAll();
            }
        }
        cancelInFlight.set(false);
        Log.i(TAG, "Cancelamento Stone retorno ok=" + ok + " uri=" + uri);
    }

    private void schedulePaymentTimeout() {
        clearPaymentTimeout();
        timeoutRunnable = () -> {
            if (processing.compareAndSet(true, false)) {
                notifyError("Tempo esgotado aguardando retorno do app Stone.");
            }
        };
        mainHandler.postDelayed(timeoutRunnable, PAYMENT_TIMEOUT_MS);
    }

    private void clearPaymentTimeout() {
        if (timeoutRunnable != null) {
            mainHandler.removeCallbacks(timeoutRunnable);
            timeoutRunnable = null;
        }
    }

    private void finishWithError(String msg) {
        processing.set(false);
        clearPaymentTimeout();
        notifyError(msg);
    }

    private void notifySuccess(String auth, String txId) {
        if (callback != null) {
            mainHandler.post(() -> callback.onPaymentSuccess(auth, txId));
        }
    }

    private void notifyError(String error) {
        if (callback != null) {
            mainHandler.post(() -> callback.onPaymentError(error == null ? "Erro Stone" : error));
        }
    }

    private void notifyProcessing(String message) {
        if (callback != null) {
            mainHandler.post(() -> callback.onPaymentProcessing(message));
        }
    }

    private static String mapTransactionType(String paymentType) {
        if (paymentType == null) {
            return "CREDIT";
        }
        String p = paymentType.trim().toLowerCase(Locale.US);
        if (p.contains("pix") || p.contains("instant")) {
            return "PIX";
        }
        if (p.contains("debit") || p.contains("débito") || p.contains("debito")) {
            return "DEBIT";
        }
        if (p.contains("voucher")) {
            return "VOUCHER";
        }
        return "CREDIT";
    }

    private static String toSupabaseMethod(String paymentType) {
        if (paymentType == null) {
            return "credit";
        }
        String p = paymentType.trim().toLowerCase(Locale.US);
        if (p.contains("pix") || p.contains("instant")) {
            return "pix";
        }
        if (p.contains("debit") || p.contains("débito") || p.contains("debito")) {
            return "debit";
        }
        return "credit";
    }

    /** order_id Stone aceita número longo; se for UUID, usa hash positivo. */
    private static String sanitizeOrderId(String orderId) {
        if (orderId == null || orderId.isEmpty()) {
            return String.valueOf(System.currentTimeMillis());
        }
        try {
            return String.valueOf(Long.parseLong(orderId.replaceAll("[^0-9]", "")));
        } catch (Exception ignored) {
            return String.valueOf(Math.abs(orderId.hashCode()) & 0x7fffffffL);
        }
    }

    private static String firstNonEmpty(String... values) {
        if (values == null) {
            return "";
        }
        for (String v : values) {
            if (v != null && !v.trim().isEmpty()) {
                return v.trim();
            }
        }
        return "";
    }

    public void onTotemCheckoutFinished() {
        boundPendingTxId = "";
        boundMachineId = "";
        boundOperationId = -1L;
    }

    public void releaseCheckoutForNextPayment() {
        processing.set(false);
        clearPaymentTimeout();
    }
}
