package app.lovable.toplavanderia;

import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Order Manager REST — criar e liberar pedido antes do deep link de pagamento.
 * Fluxo recomendado pela Cielo: DRAFT → PLACE → pagamento → CLOSE.
 */
public final class CieloOrderApi {
    private static final String TAG = "CieloOrderApi";
    private static final int CONNECT_MS = 5000;
    private static final int READ_MS = 8000;

    private CieloOrderApi() {
    }

    public static final class Session {
        public final String orderId;
        public final String reference;

        Session(String orderId, String reference) {
            this.orderId = orderId;
            this.reference = reference;
        }
    }

    /**
     * Fecha pedidos PAID/ENTERED rapidamente e cria um pedido novo na nuvem.
     * @return sessão ou null se a API falhar (pagamento segue só com deep link)
     */
    public static Session prepareCheckout(String clientId, String accessToken, String merchantId,
                                          String environment, String reference, long amountCents,
                                          String paymentCode, String itemName) {
        CieloOrderJanitor.closeOpenOrdersQuick(clientId, accessToken, merchantId, environment);

        String orderId = createDraftOrder(clientId, accessToken, merchantId, environment,
            reference, amountCents, paymentCode, itemName);
        if (orderId == null || orderId.isEmpty()) {
            Log.w(TAG, "Falha ao criar pedido na nuvem — checkout seguirá só via deep link");
            return null;
        }
        if (!updateOrderOperation(clientId, accessToken, merchantId, environment, orderId, "PLACE")) {
            Log.w(TAG, "Falha ao PLACE pedido " + orderId);
            CieloOrderJanitor.closeOrderById(clientId, accessToken, merchantId, environment, orderId);
            return null;
        }
        Log.i(TAG, "Pedido cloud pronto: " + orderId + " ref=" + reference);
        return new Session(orderId, reference);
    }

    public static void finalizeOrder(String clientId, String accessToken, String merchantId,
                                     String environment, String orderId) {
        if (orderId == null || orderId.isEmpty()) {
            return;
        }
        boolean closed = CieloOrderJanitor.closeOrderById(
            clientId, accessToken, merchantId, environment, orderId);
        Log.i(TAG, "CLOSE pedido cloud " + orderId + " ok=" + closed);
    }

    private static String createDraftOrder(String clientId, String accessToken, String merchantId,
                                           String environment, String reference, long amountCents,
                                           String paymentCode, String itemName) {
        try {
            JSONObject order = new JSONObject();
            order.put("number", reference);
            order.put("reference", reference);
            order.put("status", "DRAFT");
            order.put("price", (int) amountCents);

            JSONArray items = new JSONArray();
            JSONObject item = new JSONObject();
            item.put("name", itemName != null && !itemName.isEmpty() ? itemName : "Top Lavanderia");
            item.put("sku", "LAVANDERIA");
            item.put("quantity", 1);
            item.put("unit_price", (int) amountCents);
            item.put("unit_of_measure", "EACH");
            items.put(item);
            order.put("items", items);

            if (paymentCode != null && !paymentCode.isEmpty()) {
                order.put("payment_code", paymentCode);
            }

            String baseUrl = baseUrl(environment);
            HttpURLConnection connection = null;
            try {
                URL url = new URL(baseUrl + "/orders");
                connection = SupabaseConfig.openConnection(url);
                connection.setRequestMethod("POST");
                applyHeaders(connection, clientId, accessToken, merchantId);
                connection.setConnectTimeout(CONNECT_MS);
                connection.setReadTimeout(READ_MS);
                connection.setDoOutput(true);
                byte[] bytes = order.toString().getBytes(StandardCharsets.UTF_8);
                OutputStream os = connection.getOutputStream();
                os.write(bytes);
                os.close();

                int code = connection.getResponseCode();
                String body = readBody(connection, code);
                if (code != 200 && code != 201) {
                    Log.w(TAG, "POST /orders HTTP " + code + " body=" + truncate(body, 220));
                    return null;
                }
                if (body == null || body.isEmpty()) {
                    return null;
                }
                JSONObject resp = new JSONObject(body.trim());
                return resp.optString("id", "");
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Erro ao criar pedido cloud", e);
            return null;
        }
    }

    private static boolean updateOrderOperation(String clientId, String accessToken, String merchantId,
                                                String environment, String orderId, String operation) {
        HttpURLConnection connection = null;
        try {
            String baseUrl = baseUrl(environment);
            URL url = new URL(baseUrl + "/orders/" + orderId + "?operation=" + operation);
            connection = SupabaseConfig.openConnection(url);
            connection.setRequestMethod("PUT");
            applyHeaders(connection, clientId, accessToken, merchantId);
            connection.setConnectTimeout(CONNECT_MS);
            connection.setReadTimeout(READ_MS);
            connection.setDoOutput(true);
            connection.getOutputStream().close();

            int code = connection.getResponseCode();
            if (code == 200 || code == 204) {
                return true;
            }
            String body = readBody(connection, code);
            Log.w(TAG, operation + " " + orderId + " HTTP " + code + " body=" + truncate(body, 180));
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

    private static String baseUrl(String environment) {
        return "sandbox".equalsIgnoreCase(CieloOrderJanitor.resolveEnvironment(environment))
            ? "https://api.cielo.com.br/sandbox-lio/order-management/v1"
            : "https://api.cielo.com.br/order-management/v1";
    }

    private static void applyHeaders(HttpURLConnection connection, String clientId,
                                     String accessToken, String merchantId) {
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("client-id", clientId);
        connection.setRequestProperty("access-token", accessToken);
        String merchant = CieloOrderJanitor.resolveMerchantId(merchantId);
        if (!merchant.isEmpty()) {
            connection.setRequestProperty("merchant-id", merchant);
        }
    }

    private static String readBody(HttpURLConnection connection, int code) {
        try {
            InputStream stream = code >= 400 ? connection.getErrorStream() : connection.getInputStream();
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
            return "";
        }
    }

    private static String truncate(String value, int max) {
        if (value == null || value.length() <= max) {
            return value == null ? "" : value;
        }
        return value.substring(0, max) + "…";
    }
}
