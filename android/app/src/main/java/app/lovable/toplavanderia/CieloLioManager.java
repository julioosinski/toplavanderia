package app.lovable.toplavanderia;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.UUID;

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

    private final Context context;
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
    /** credit | pix | card — inferido do retorno Cielo para alinhar Supabase/recibo. */
    private volatile String lastDetectedSupabasePaymentMethod;

    public CieloLioManager(Context context) {
        this.context = context;
        this.isProcessing = false;
        this.isInitialized = false;
    }

    public void configure(String clientId, String accessToken, String merchantCode, String environment) {
        this.clientId = safe(clientId);
        this.accessToken = safe(accessToken);
        this.merchantCode = safe(merchantCode);
        this.environment = (environment != null && !environment.isEmpty()) ? environment : "sandbox";

        // Deep link only requires credentials locally to build request.
        this.isInitialized = !this.clientId.isEmpty() && !this.accessToken.isEmpty();

        Log.d(TAG, "Configured Deep Link Cielo: merchant=" + this.merchantCode + " env=" + this.environment);
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
            if (callback != null) callback.onPaymentError("Ja ha uma transacao em processamento");
            return;
        }

        if (!isInitialized) {
            String msg = "Credenciais Cielo nao configuradas (Client ID e Access Token).";
            Log.w(TAG, msg);
            if (callback != null) callback.onPaymentError(msg);
            return;
        }

        try {
            long amountCents = Math.round(amount * 100.0d);
            String reference = (orderId != null && !orderId.isEmpty()) ? orderId : UUID.randomUUID().toString();
            String paymentCode = resolvePaymentCode(paymentType);
            Log.d(TAG, "Cielo checkout: jsType=" + paymentType + " -> paymentCode=" + paymentCode + " cents=" + amountCents);

            JSONObject payload = buildPaymentPayload(amountCents, paymentCode, description, reference);
            String base64 = Base64.encodeToString(payload.toString().getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP);
            String checkoutUri = "lio://payment?request=" + Uri.encode(base64) + "&urlCallback=order://response";

            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(checkoutUri));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

            activeInstance = this;
            isProcessing = true;
            pendingReference = reference;
            pendingAmountCents = amountCents;
            pendingPaymentCode = paymentCode;
            if (callback != null) callback.onPaymentProcessing("Abrindo pagamento na Cielo...");

            context.startActivity(intent);
            Log.d(TAG, "Deep link Cielo enviado (ref=" + reference + ", paymentCode=" + paymentCode + ")");
        } catch (Exception e) {
            isProcessing = false;
            clearPendingTransaction();
            Log.e(TAG, "Erro ao iniciar pagamento Cielo via deep link", e);
            if (callback != null) callback.onPaymentError("Erro ao iniciar pagamento Cielo: " + e.getMessage());
        }
    }

    @Override
    public void cancelPayment() {
        if (isProcessing) {
            isProcessing = false;
            clearPendingTransaction();
            activeInstance = null;
            if (callback != null) callback.onPaymentError("Transacao Cielo cancelada pelo usuario");
        }
    }

    /**
     * Called by CieloResponseActivity when callback order://response arrives.
     */
    public static void handleDeepLinkResponse(Uri uri) {
        if (activeInstance == null) {
            Log.w(TAG, "Resposta Cielo recebida sem instancia ativa");
            return;
        }
        activeInstance.consumeDeepLinkResponse(uri);
    }

    private void consumeDeepLinkResponse(Uri uri) {
        isProcessing = false;

        if (uri == null) {
            if (callback != null) callback.onPaymentError("Resposta Cielo invalida");
            return;
        }

        try {
            String responseBase64 = uri.getQueryParameter("response");
            String responseCode = uri.getQueryParameter("responsecode");

            if (responseBase64 == null || responseBase64.isEmpty()) {
                if (callback != null) callback.onPaymentError("Resposta Cielo sem payload");
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
                if (callback != null) callback.onPaymentError(formatCieloErrorMessage(code, reason));
                return;
            }

            // Doc Cielo: responsecode=0 sucesso; =2 típico de cancelamento/erro na URI (além do JSON de erro acima).
            if ("2".equals(responseCode)) {
                if (callback != null) {
                    callback.onPaymentError("Pagamento cancelado ou recusado (responsecode=2)");
                }
                return;
            }

            String authCode = "";
            String cieloCode = "";
            String brand = "";
            String mask = "";
            String txnId = json.optString("id", String.valueOf(System.currentTimeMillis()));
            String responseReference = json.optString("reference", "");

            if (!isExpectedReference(responseReference)) {
                rejectSuspiciousCallback("Referencia Cielo divergente");
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

            // Verify statusCode from paymentFields (1=Authorized, 2=Cancelled)
            JSONObject paymentFields = payment.optJSONObject("paymentFields");
            if (paymentFields != null) {
                String statusCode = paymentFields.optString("statusCode", "");
                if ("2".equals(statusCode)) {
                    if (callback != null) callback.onPaymentError("Transacao cancelada pela Cielo (statusCode=2)");
                    activeInstance = null;
                    return;
                }
            }

            if (authCode.isEmpty()) {
                authCode = cieloCode.isEmpty() ? txnId : cieloCode;
            }

            lastDetectedSupabasePaymentMethod = resolveSupabaseMethodFromCieloPayment(payment);
            Log.d(TAG, "Cielo APPROVED: ref=" + pendingReference + " solicitado=" + pendingPaymentCode
                + " detectadoSupabase=" + lastDetectedSupabasePaymentMethod + " brand=" + brand + " maskSuffix=" + lastFour(mask));
            if (callback != null) callback.onPaymentSuccess(authCode, txnId);
        } catch (Exception e) {
            Log.e(TAG, "Erro ao processar callback Cielo", e);
            if (callback != null) callback.onPaymentError("Erro ao processar retorno Cielo: " + e.getMessage());
        } finally {
            clearPendingTransaction();
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

    private JSONObject buildPaymentPayload(long amountCents, String paymentCode, String description, String reference) throws Exception {
        JSONObject payload = new JSONObject();
        payload.put("accessToken", accessToken);
        payload.put("clientID", clientId);
        payload.put("reference", reference);
        payload.put("value", String.valueOf(amountCents));
        payload.put("paymentCode", paymentCode);
        // PIX: omitir installments e receiptPrintPermission — firmware Cielo Smart rejeita "Json inválido" com esses campos.
        if (!"PIX".equalsIgnoreCase(paymentCode)) {
            payload.put("installments", "0");
        }
        payload.put("email", "cliente@toplavanderia.local");

        if (merchantCode != null && !merchantCode.isEmpty()) {
            payload.put("merchantCode", merchantCode);
        }

        JSONArray items = new JSONArray();
        JSONObject item = new JSONObject();
        item.put("name", description != null && !description.isEmpty() ? description : "Top Lavanderia");
        item.put("quantity", 1);
        item.put("sku", "LAVANDERIA");
        item.put("unitOfMeasure", "unidade");
        item.put("unitPrice", (int) amountCents);
        items.put(item);
        payload.put("items", items);

        if (!"PIX".equalsIgnoreCase(paymentCode)) {
            payload.put("receiptPrintPermission", "0");
        }

        return payload;
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

    private boolean isExpectedReference(String responseReference) {
        return pendingReference != null
                && !pendingReference.isEmpty()
                && pendingReference.equals(responseReference);
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
        return "Erro Cielo (" + code + "): " + r;
    }

    private void rejectSuspiciousCallback(String message) {
        Log.w(TAG, message + " (ref=" + pendingReference + ", cents=" + pendingAmountCents + ")");
        if (callback != null) callback.onPaymentError(message);
    }

    private void clearPendingTransaction() {
        pendingReference = null;
        pendingAmountCents = 0;
        pendingPaymentCode = null;
    }

    private String lastFour(String value) {
        if (value == null || value.length() < 4) return "";
        return value.substring(value.length() - 4);
    }
}
