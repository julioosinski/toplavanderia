package app.lovable.toplavanderia;



import android.util.Log;



import org.json.JSONArray;

import org.json.JSONObject;



import java.io.BufferedReader;

import java.io.InputStream;

import java.io.InputStreamReader;

import java.net.HttpURLConnection;

import java.net.URL;

import java.nio.charset.StandardCharsets;

import java.util.HashSet;

import java.util.Locale;

import java.util.Set;



/**

 * Fecha pedidos ENTERED/PAID abertos no Order Manager da Cielo antes de um novo checkout.

 * Pedidos "presos" no terminal costumam causar erro -4281 (transação já efetuada) sem passar o cartão.

 */

public final class CieloOrderJanitor {

    private static final String TAG = "CieloOrderJanitor";

    private static final int CONNECT_MS = 8000;

    private static final int READ_MS = 12000;

    private static final String[] OPEN_STATUSES = { "ENTERED", "PAID", "RE-ENTERED", "DRAFT" };

    private static final String[] CLOSE_OPERATIONS = { "close" };
    private static volatile boolean lastApiAuthFailed;
    /** EC do terminal DX8000 Sinuelo (fallback quando painel não tem merchant_code). */
    private static final String KNOWN_TERMINAL_MERCHANT = "0010000234570003";



    private CieloOrderJanitor() {

    }



    /** EC numérico de 16 dígitos aprendido do último pagamento aprovado no terminal. */

    private static volatile String learnedMerchantId;
    private static final String PREFS = "cielo_order_janitor";
    private static final String KEY_LEARNED_MERCHANT = "learned_merchant_id";

    public static void loadLearnedMerchantId(android.content.Context context) {
        if (context == null) {
            return;
        }
        if (learnedMerchantId != null && !learnedMerchantId.isEmpty()) {
            return;
        }
        try {
            String saved = context.getApplicationContext()
                .getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE)
                .getString(KEY_LEARNED_MERCHANT, "");
            if (saved != null && !saved.isEmpty()) {
                learnedMerchantId = saved;
                Log.i(TAG, "Merchant-Id restaurado: " + maskMerchant(saved));
            }
        } catch (Exception e) {
            Log.w(TAG, "Falha ao restaurar Merchant-Id", e);
        }
    }

    public static void learnMerchantId(android.content.Context context, String merchantId) {
        if (merchantId == null || merchantId.isEmpty()) {
            return;
        }
        String trimmed = merchantId.trim();
        if (trimmed.length() >= 10 && !CieloLioManager.looksLikeUuidMerchantCode(trimmed)) {
            learnedMerchantId = trimmed;
            Log.i(TAG, "Merchant-Id aprendido do pagamento: " + maskMerchant(trimmed));
            if (context != null) {
                try {
                    context.getApplicationContext()
                        .getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE)
                        .edit()
                        .putString(KEY_LEARNED_MERCHANT, trimmed)
                        .apply();
                } catch (Exception e) {
                    Log.w(TAG, "Falha ao salvar Merchant-Id", e);
                }
            }
        }
    }

    public static void learnMerchantId(String merchantId) {
        learnMerchantId(null, merchantId);
    }



    public static boolean hadRecentAuthFailure() {
        return lastApiAuthFailed;
    }

    /** Terminais Cielo físicos sempre usam produção no Order Manager. */
    public static String resolveEnvironment(String configuredEnvironment) {
        if (CieloSslWorkaround.isCieloTerminal()) {
            return "production";
        }
        return configuredEnvironment == null || configuredEnvironment.isEmpty()
            ? "sandbox" : configuredEnvironment;
    }

    /** EC Cielo numérico (16 dígitos, ex.: 0010000234570003). Rejeita CNPJ/EC curto do painel. */
    public static boolean looksLikeCieloEc(String merchantCode) {
        if (merchantCode == null || merchantCode.isEmpty()) {
            return false;
        }
        String m = merchantCode.trim();
        return m.length() >= 14 && m.length() <= 16 && m.matches("\\d+");
    }

    public static String resolveMerchantId(String configuredMerchantId) {
        if (looksLikeCieloEc(configuredMerchantId)) {
            return configuredMerchantId.trim();
        }
        if (looksLikeCieloEc(learnedMerchantId)) {
            return learnedMerchantId;
        }
        return KNOWN_TERMINAL_MERCHANT;
    }



    /** Limpeza rápida (só PAID/ENTERED, 1 tentativa) — antes de novo checkout. */

    public static int closeOpenOrdersQuick(String clientId, String accessToken, String merchantId,

                                           String environment) {

        if (clientId == null || clientId.isEmpty() || accessToken == null || accessToken.isEmpty()) {

            return 0;

        }

        String merchant = resolveMerchantId(merchantId);

        String baseUrl = baseUrl(environment);

        int closed = 0;

        Set<String> seen = new HashSet<>();

        for (String status : new String[] { "PAID", "ENTERED", "RE-ENTERED", "DRAFT" }) {

            JSONArray orders = fetchOrdersQuick(baseUrl, clientId, accessToken, merchant, status);

            closed += closeOrderList(baseUrl, clientId, accessToken, merchant, orders, seen, status);

        }

        if (closed > 0) {

            Log.i(TAG, "Quick janitor: " + closed + " pedido(s) fechado(s)");

        }

        return closed;

    }



    private static JSONArray fetchOrdersQuick(String baseUrl, String clientId, String accessToken,

                                              String merchantId, String status) {

        String query = "status=" + status + "&page=0&page_size=20";

        HttpURLConnection connection = null;

        try {

            URL url = new URL(baseUrl + "/orders/?" + query);

            connection = SupabaseConfig.openConnection(url);

            connection.setRequestMethod("GET");

            applyHeaders(connection, clientId, accessToken, merchantId);

            connection.setConnectTimeout(2500);

            connection.setReadTimeout(3500);

            int code = connection.getResponseCode();

            String body = readBody(connection, code);

            if (code != 200 || body == null || body.isEmpty()) {

                return new JSONArray();

            }

            String trimmed = body.trim();

            if (trimmed.startsWith("[")) {

                return new JSONArray(trimmed);

            }

            if (trimmed.startsWith("{")) {

                JSONObject obj = new JSONObject(trimmed);

                if (obj.has("results")) {

                    return obj.optJSONArray("results");

                }

            }

            return new JSONArray();

        } catch (Exception e) {
            Log.w(TAG, "Quick list falhou status=" + status, e);
            return new JSONArray();

        } finally {

            if (connection != null) {

                connection.disconnect();

            }

        }

    }



    /** Fecha um pedido específico (ex.: id retornado no callback de sucesso). */

    public static boolean closeOrderById(String clientId, String accessToken, String merchantId,

                                         String environment, String orderId) {

        if (orderId == null || orderId.isEmpty()) {

            return false;

        }

        if (clientId == null || clientId.isEmpty() || accessToken == null || accessToken.isEmpty()) {

            return false;

        }

        String baseUrl = baseUrl(environment);

        String merchant = resolveMerchantId(merchantId);

        return closeOrderWithFallback(baseUrl, clientId, accessToken, merchant, orderId);

    }



    /**

     * Limpeza bloqueante com retentativas — usar antes de abrir novo checkout.

     */

    public static int closeStaleOrdersWithRetry(String clientId, String accessToken, String merchantId,

                                                String environment, int maxAttempts) {

        int total = 0;

        int attempts = Math.max(1, maxAttempts);

        for (int i = 0; i < attempts; i++) {

            if (i > 0) {

                try {

                    Thread.sleep(i == 1 ? 600L : 2000L);

                } catch (InterruptedException e) {

                    Thread.currentThread().interrupt();

                    break;

                }

            }

            int closed = closeStaleOrders(clientId, accessToken, merchantId, environment);

            total += closed;

            if (closed > 0) {

                Log.i(TAG, "Janitor tentativa " + (i + 1) + ": " + closed + " pedido(s) fechado(s)");

            }

        }

        return total;

    }



    /**

     * Limpa pedidos abertos após pagamento/cancelamento — evita -4281 no checkout seguinte.

     */

    public static void scheduleCleanupWithRetry(String clientId, String accessToken, String merchantId,

                                                String environment, String reason) {

        new Thread(() -> {

            try {

                Thread.sleep(300L);

                int closed = closeStaleOrdersWithRetry(clientId, accessToken, merchantId, environment, 3);

                Log.i(TAG, "Limpeza pós-checkout (" + reason + "): " + closed + " pedido(s)");

            } catch (InterruptedException e) {

                Thread.currentThread().interrupt();

            } catch (Exception e) {

                Log.w(TAG, "Falha na limpeza pós-checkout (" + reason + ")", e);

            }

        }, "cielo-janitor").start();

    }



    public static int closeStaleOrders(String clientId, String accessToken, String merchantId, String environment) {

        if (clientId == null || clientId.isEmpty() || accessToken == null || accessToken.isEmpty()) {

            Log.w(TAG, "Sem credenciais para limpar pedidos Cielo");

            return 0;

        }



        String merchant = resolveMerchantId(merchantId);

        String baseUrl = baseUrl(environment);

        Log.i(TAG, "Janitor: listando pedidos abertos (merchant=" + maskMerchant(merchant) + ")");



        int closed = 0;

        Set<String> seen = new HashSet<>();

        try {

            for (String status : OPEN_STATUSES) {

                JSONArray orders = fetchOrdersByStatus(baseUrl, clientId, accessToken, merchant, status);

                closed += closeOrderList(baseUrl, clientId, accessToken, merchant, orders, seen, status);

            }



            if (closed == 0) {

                JSONArray all = fetchAllOrders(baseUrl, clientId, accessToken, merchant);

                closed += closeOrderList(baseUrl, clientId, accessToken, merchant, all, seen, "ALL");

            }

        } catch (Exception e) {

            Log.w(TAG, "Falha ao limpar pedidos Cielo (seguindo com pagamento)", e);

        }



        if (closed > 0) {

            Log.i(TAG, "Limpeza Cielo concluída: " + closed + " pedido(s)");

        } else {

            Log.i(TAG, "Limpeza Cielo: nenhum pedido aberto encontrado (ou API sem acesso)");

        }

        return closed;

    }



    private static int closeOrderList(String baseUrl, String clientId, String accessToken, String merchant,

                                      JSONArray orders, Set<String> seen, String label) {

        if (orders == null || orders.length() == 0) {

            return 0;

        }

        int closed = 0;

        for (int i = 0; i < orders.length(); i++) {

            JSONObject order = orders.optJSONObject(i);

            if (order == null) {

                continue;

            }

            String orderId = order.optString("id", "");

            if (orderId.isEmpty() || seen.contains(orderId)) {

                continue;

            }

            String status = order.optString("status", "").toUpperCase(Locale.ROOT);

            if (!status.isEmpty() && !isOpenStatus(status)) {

                continue;

            }

            seen.add(orderId);

            if (closeOrderWithFallback(baseUrl, clientId, accessToken, merchant, orderId)) {

                closed++;

                Log.i(TAG, "Pedido fechado: " + orderId + " (lista=" + label + ", status=" + status + ")");

            }

        }

        return closed;

    }



    private static boolean isOpenStatus(String status) {

        if (status == null || status.isEmpty()) {

            return true;

        }

        String s = status.toUpperCase(Locale.ROOT);

        if ("CLOSED".equals(s) || "CANCELED".equals(s) || "CANCELLED".equals(s)) {

            return false;

        }

        for (String open : OPEN_STATUSES) {

            if (open.equalsIgnoreCase(status)) {

                return true;

            }

        }

        return false;

    }



    private static String baseUrl(String environment) {
        return "sandbox".equalsIgnoreCase(resolveEnvironment(environment))
            ? "https://api.cielo.com.br/sandbox-lio/order-management/v1"
            : "https://api.cielo.com.br/order-management/v1";
    }



    private static JSONArray fetchOrdersByStatus(String baseUrl, String clientId, String accessToken,

                                                 String merchantId, String status) {

        String query = "status=" + status + "&page=0&page_size=50";

        return fetchOrders(baseUrl + "/orders/?" + query, clientId, accessToken, merchantId, status);

    }



    private static JSONArray fetchAllOrders(String baseUrl, String clientId, String accessToken, String merchantId) {

        return fetchOrders(baseUrl + "/orders/?page=0&page_size=50", clientId, accessToken, merchantId, "ALL");

    }



    private static JSONArray fetchOrders(String urlString, String clientId, String accessToken,

                                         String merchantId, String label) {

        HttpURLConnection connection = null;

        try {

            URL url = new URL(urlString);

            connection = SupabaseConfig.openConnection(url);

            connection.setRequestMethod("GET");

            applyHeaders(connection, clientId, accessToken, merchantId);

            connection.setConnectTimeout(CONNECT_MS);

            connection.setReadTimeout(READ_MS);



            int code = connection.getResponseCode();

            String body = readBody(connection, code);

            if (code == 401) {
                lastApiAuthFailed = true;
                Log.e(TAG, "Order Manager Cielo: credenciais inválidas (401 Invalid Client). "
                    + "Atualize Client-Id e Access-Token no portal Cielo Developer (produção).");
            }
            if (code != 200) {
                Log.w(TAG, "Listagem pedidos Cielo HTTP " + code + " label=" + label
                    + " body=" + truncate(body, 200));
                return null;
            }
            lastApiAuthFailed = false;



            if (body == null || body.isEmpty()) {

                return new JSONArray();

            }



            String trimmed = body.trim();

            if (trimmed.startsWith("[")) {

                return new JSONArray(trimmed);

            }

            if (trimmed.startsWith("{")) {

                JSONObject obj = new JSONObject(trimmed);

                if (obj.has("results")) {

                    return obj.optJSONArray("results");

                }

                JSONArray single = new JSONArray();

                single.put(obj);

                return single;

            }

            return new JSONArray();

        } catch (Exception e) {

            Log.w(TAG, "Erro ao listar pedidos Cielo label=" + label, e);

            return null;

        } finally {

            if (connection != null) {

                connection.disconnect();

            }

        }

    }



    private static boolean closeOrderWithFallback(String baseUrl, String clientId, String accessToken,

                                                  String merchantId, String orderId) {

        for (String operation : CLOSE_OPERATIONS) {

            if (updateOrder(baseUrl, clientId, accessToken, merchantId, orderId, operation)) {

                return true;

            }

        }

        return deleteOrder(baseUrl, clientId, accessToken, merchantId, orderId);

    }



    private static boolean deleteOrder(String baseUrl, String clientId, String accessToken,

                                       String merchantId, String orderId) {

        HttpURLConnection connection = null;

        try {

            URL url = new URL(baseUrl + "/orders/" + orderId);

            connection = SupabaseConfig.openConnection(url);

            connection.setRequestMethod("DELETE");

            applyHeaders(connection, clientId, accessToken, merchantId);

            connection.setConnectTimeout(2500);

            connection.setReadTimeout(3500);

            int code = connection.getResponseCode();

            if (code == 200 || code == 204) {

                Log.i(TAG, "DELETE pedido " + orderId + " OK");

                return true;

            }

            Log.w(TAG, "DELETE pedido " + orderId + " HTTP " + code);

            return false;

        } catch (Exception e) {

            Log.w(TAG, "Erro DELETE pedido " + orderId, e);

            return false;

        } finally {

            if (connection != null) {

                connection.disconnect();

            }

        }

    }



    private static boolean updateOrder(String baseUrl, String clientId, String accessToken,

                                       String merchantId, String orderId, String operation) {

        HttpURLConnection connection = null;

        try {

            URL url = new URL(baseUrl + "/orders/" + orderId + "?action=" + operation);

            connection = SupabaseConfig.openConnection(url);

            connection.setRequestMethod("PUT");

            applyHeaders(connection, clientId, accessToken, merchantId);

            connection.setConnectTimeout(CONNECT_MS);

            connection.setReadTimeout(READ_MS);

            connection.setDoOutput(true);

            connection.getOutputStream().close();



            int code = connection.getResponseCode();

            if (code == 200 || code == 204) {

                Log.d(TAG, operation + " pedido " + orderId + " OK");

                return true;

            }

            String body = readBody(connection, code);

            Log.w(TAG, operation + " pedido " + orderId + " HTTP " + code + " body=" + truncate(body, 180));

            return false;

        } catch (Exception e) {

            Log.w(TAG, "Erro " + operation + " pedido " + orderId, e);

            return false;

        } finally {

            if (connection != null) {

                connection.disconnect();

            }

        }

    }



    private static void applyHeaders(HttpURLConnection connection, String clientId,

                                     String accessToken, String merchantId) {

        connection.setRequestProperty("Content-Type", "application/json");

        connection.setRequestProperty("Accept", "application/json");

        connection.setRequestProperty("client-id", clientId);
        connection.setRequestProperty("access-token", accessToken);
        String merchant = resolveMerchantId(merchantId);
        if (!merchant.isEmpty()) {
            connection.setRequestProperty("merchant-id", merchant);
        }

    }



    private static String readBody(HttpURLConnection connection, int code) {

        InputStream stream = null;

        try {

            stream = code >= 400 ? connection.getErrorStream() : connection.getInputStream();

            if (stream == null) {

                return "";

            }

            BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8));

            StringBuilder sb = new StringBuilder();

            String line;

            while ((line = reader.readLine()) != null) {

                sb.append(line);

            }

            reader.close();

            return sb.toString();

        } catch (Exception e) {

            Log.w(TAG, "Erro ao ler resposta Order Manager HTTP " + code, e);

            return "";

        }

    }



    private static String truncate(String value, int max) {

        if (value == null) {

            return "";

        }

        if (value.length() <= max) {

            return value;

        }

        return value.substring(0, max) + "…";

    }



    private static String maskMerchant(String merchant) {

        if (merchant == null || merchant.length() < 6) {

            return merchant == null ? "" : merchant;

        }

        return "…" + merchant.substring(merchant.length() - 6);

    }



    public static boolean is4281Error(String error) {

        if (error == null) {

            return false;

        }

        String lower = error.toLowerCase(Locale.ROOT);

        return lower.contains("4281") || lower.contains("ja efetuada") || lower.contains("já efetuada");

    }

}


