package app.lovable.toplavanderia;

import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/**
 * Fecha pedidos ENTERED/PAID abertos no Order Manager da Cielo antes de um novo checkout.
 * Pedidos "presos" no terminal costumam causar erro -4281 (transação já efetuada) sem passar o cartão.
 */
public final class CieloOrderJanitor {
    private static final String TAG = "CieloOrderJanitor";
    private static final int CONNECT_MS = 5000;
    private static final int READ_MS = 8000;

    private CieloOrderJanitor() {
    }

    public static int closeStaleOrders(String clientId, String accessToken, String merchantId, String environment) {
        if (clientId == null || clientId.isEmpty() || accessToken == null || accessToken.isEmpty()) {
            Log.w(TAG, "Sem credenciais para limpar pedidos Cielo");
            return 0;
        }

        String baseUrl = "sandbox".equalsIgnoreCase(environment)
            ? "https://api.cielo.com.br/sandbox-lio/order-management/v1"
            : "https://api.cielo.com.br/order-management/v1";

        int closed = 0;
        try {
            for (String status : new String[] { "ENTERED", "PAID", "RE-ENTERED" }) {
                JSONArray orders = fetchOrders(baseUrl, clientId, accessToken, merchantId, status);
                if (orders == null) {
                    continue;
                }
                for (int i = 0; i < orders.length(); i++) {
                    JSONObject order = orders.optJSONObject(i);
                    if (order == null) {
                        continue;
                    }
                    String orderId = order.optString("id", "");
                    if (orderId.isEmpty()) {
                        continue;
                    }
                    if (closeOrder(baseUrl, clientId, accessToken, merchantId, orderId)) {
                        closed++;
                        Log.i(TAG, "Pedido Cielo fechado: " + orderId + " (status=" + status + ")");
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Falha ao limpar pedidos Cielo (seguindo com pagamento)", e);
        }

        if (closed > 0) {
            Log.i(TAG, "Limpeza Cielo: " + closed + " pedido(s) fechado(s)");
        }
        return closed;
    }

    private static JSONArray fetchOrders(String baseUrl, String clientId, String accessToken,
                                         String merchantId, String status) {
        HttpURLConnection connection = null;
        try {
            String query = "status=" + status + "&page=0&page_size=30";
            URL url = new URL(baseUrl + "/orders/?" + query);
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            applyHeaders(connection, clientId, accessToken, merchantId);
            connection.setConnectTimeout(CONNECT_MS);
            connection.setReadTimeout(READ_MS);

            int code = connection.getResponseCode();
            if (code != 200) {
                Log.w(TAG, "Listagem pedidos Cielo HTTP " + code + " status=" + status);
                return null;
            }

            String body = readStream(connection);
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
            Log.w(TAG, "Erro ao listar pedidos Cielo status=" + status, e);
            return null;
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private static boolean closeOrder(String baseUrl, String clientId, String accessToken,
                                      String merchantId, String orderId) {
        HttpURLConnection connection = null;
        try {
            URL url = new URL(baseUrl + "/orders/" + orderId + "?operation=CLOSE");
            connection = (HttpURLConnection) url.openConnection();
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
            Log.w(TAG, "CLOSE pedido " + orderId + " HTTP " + code);
            return false;
        } catch (Exception e) {
            Log.w(TAG, "Erro ao fechar pedido " + orderId, e);
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
        connection.setRequestProperty("Client-Id", clientId);
        connection.setRequestProperty("Access-Token", accessToken);
        if (merchantId != null && !merchantId.isEmpty() && !CieloLioManager.looksLikeUuidMerchantCode(merchantId)) {
            connection.setRequestProperty("Merchant-Id", merchantId);
        }
    }

    private static String readStream(HttpURLConnection connection) {
        try {
            BufferedReader reader = new BufferedReader(
                new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
            reader.close();
            return sb.toString();
        } catch (Exception e) {
            Log.w(TAG, "Erro ao ler resposta Order Manager", e);
            return null;
        }
    }

    public static boolean is4281Error(String error) {
        if (error == null) {
            return false;
        }
        String lower = error.toLowerCase(Locale.ROOT);
        return lower.contains("4281") || lower.contains("ja efetuada") || lower.contains("já efetuada");
    }
}
