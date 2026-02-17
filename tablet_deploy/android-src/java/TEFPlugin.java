package app.lovable.toplavanderia;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Plugin Capacitor para integração com TEF (Transferência Eletrônica de Fundos)
 * 
 * Suporta múltiplos providers:
 * - Elgin TEF
 * - Gertec TEF
 * - Cielo TEF
 * - Stone TEF
 * - Positivo TEF
 */
@CapacitorPlugin(name = "TEF")
public class TEFPlugin extends Plugin {
    
    private String tefProvider = "elgin";
    private String tefEndpoint = "";
    private String merchantId = "";
    private String terminalId = "";
    private int timeout = 60000; // 60 segundos para TEF
    
    /**
     * Inicializar TEF
     */
    @PluginMethod
    public void initialize(PluginCall call) {
        try {
            if (call.hasOption("provider")) {
                tefProvider = call.getString("provider");
            }
            if (call.hasOption("endpoint")) {
                tefEndpoint = call.getString("endpoint");
            }
            if (call.hasOption("merchantId")) {
                merchantId = call.getString("merchantId");
            }
            if (call.hasOption("terminalId")) {
                terminalId = call.getString("terminalId");
            }
            
            // Validar configurações
            if (tefEndpoint.isEmpty()) {
                throw new Exception("Endpoint TEF não configurado");
            }
            
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "TEF inicializado: " + tefProvider);
            result.put("provider", tefProvider);
            
            call.resolve(result);
            
        } catch (Exception e) {
            JSObject error = new JSObject();
            error.put("success", false);
            error.put("message", "Erro ao inicializar TEF: " + e.getMessage());
            call.reject("Erro ao inicializar TEF", error);
        }
    }
    
    /**
     * Processar pagamento via TEF
     */
    @PluginMethod
    public void processPayment(PluginCall call) {
        try {
            double amount = call.getDouble("amount", 0.0);
            String paymentType = call.getString("paymentType", "credit");
            int installments = call.getInt("installments", 1);
            String orderId = call.getString("orderId", "");
            
            if (amount <= 0) {
                throw new Exception("Valor inválido");
            }
            
            // Construir payload TEF
            JSONObject payload = new JSONObject();
            payload.put("merchantId", merchantId);
            payload.put("terminalId", terminalId);
            payload.put("amount", (int)(amount * 100)); // Centavos
            payload.put("paymentType", paymentType.equals("credit") ? "CREDITO" : "DEBITO");
            payload.put("installments", installments);
            payload.put("orderId", orderId);
            
            String response = makeHttpRequest(tefEndpoint + "/payment", "POST", payload.toString());
            JSONObject json = new JSONObject(response);
            
            JSObject result = new JSObject();
            result.put("success", json.optBoolean("success", false));
            result.put("message", json.optString("message", ""));
            result.put("status", json.optString("status", "error"));
            result.put("authorizationCode", json.optString("authorizationCode", ""));
            result.put("transactionId", json.optString("transactionId", ""));
            result.put("nsu", json.optString("nsu", ""));
            result.put("orderId", orderId);
            result.put("amount", amount);
            result.put("paymentType", paymentType);
            
            call.resolve(result);
            
        } catch (Exception e) {
            JSObject error = new JSObject();
            error.put("success", false);
            error.put("message", "Erro no pagamento TEF: " + e.getMessage());
            error.put("status", "error");
            call.reject("Erro no pagamento TEF", error);
        }
    }
    
    /**
     * Cancelar transação TEF
     */
    @PluginMethod
    public void cancelTransaction(PluginCall call) {
        try {
            String transactionId = call.getString("transactionId", "");
            String nsu = call.getString("nsu", "");
            
            JSONObject payload = new JSONObject();
            payload.put("merchantId", merchantId);
            payload.put("terminalId", terminalId);
            payload.put("transactionId", transactionId);
            payload.put("nsu", nsu);
            
            String response = makeHttpRequest(tefEndpoint + "/cancel", "POST", payload.toString());
            JSONObject json = new JSONObject(response);
            
            JSObject result = new JSObject();
            result.put("success", json.optBoolean("success", false));
            result.put("message", json.optString("message", "Cancelamento processado"));
            
            call.resolve(result);
            
        } catch (Exception e) {
            JSObject error = new JSObject();
            error.put("success", false);
            error.put("message", "Erro ao cancelar TEF: " + e.getMessage());
            call.reject("Erro ao cancelar TEF", error);
        }
    }
    
    /**
     * Verificar status TEF
     */
    @PluginMethod
    public void checkStatus(PluginCall call) {
        try {
            String response = makeHttpRequest(tefEndpoint + "/status", "GET", null);
            JSONObject json = new JSONObject(response);
            
            JSObject result = new JSObject();
            result.put("online", json.optBoolean("online", false));
            result.put("connected", json.optBoolean("connected", false));
            result.put("provider", tefProvider);
            result.put("terminalId", terminalId);
            
            call.resolve(result);
            
        } catch (Exception e) {
            JSObject result = new JSObject();
            result.put("online", false);
            result.put("connected", false);
            result.put("error", e.getMessage());
            call.resolve(result);
        }
    }
    
    /**
     * Testar conexão TEF
     */
    @PluginMethod
    public void testConnection(PluginCall call) {
        try {
            boolean connected = testConnection(tefEndpoint + "/ping");
            
            JSObject result = new JSObject();
            result.put("success", connected);
            result.put("message", connected ? "Conexão TEF OK" : "Falha na conexão TEF");
            
            call.resolve(result);
            
        } catch (Exception e) {
            JSObject error = new JSObject();
            error.put("success", false);
            error.put("message", e.getMessage());
            call.reject("Erro ao testar conexão TEF", error);
        }
    }
    
    // ========== MÉTODOS AUXILIARES ==========
    
    private String makeHttpRequest(String urlString, String method, String payload) throws Exception {
        URL url = new URL(urlString);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        
        try {
            conn.setRequestMethod(method);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("X-Merchant-ID", merchantId);
            conn.setRequestProperty("X-Terminal-ID", terminalId);
            conn.setConnectTimeout(timeout);
            conn.setReadTimeout(timeout);
            
            if (payload != null && method.equals("POST")) {
                conn.setDoOutput(true);
                try (OutputStream os = conn.getOutputStream()) {
                    byte[] input = payload.getBytes("utf-8");
                    os.write(input, 0, input.length);
                }
            }
            
            int responseCode = conn.getResponseCode();
            
            BufferedReader br = new BufferedReader(
                new InputStreamReader(
                    responseCode == 200 ? conn.getInputStream() : conn.getErrorStream(),
                    "utf-8"
                )
            );
            
            StringBuilder response = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) {
                response.append(line.trim());
            }
            
            if (responseCode != 200) {
                throw new Exception("HTTP " + responseCode + ": " + response.toString());
            }
            
            return response.toString();
            
        } finally {
            conn.disconnect();
        }
    }
    
    private boolean testConnection(String urlString) {
        try {
            URL url = new URL(urlString);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            int responseCode = conn.getResponseCode();
            conn.disconnect();
            return responseCode == 200;
        } catch (Exception e) {
            return false;
        }
    }
}
