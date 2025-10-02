package app.lovable.toplavanderia;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Plugin Capacitor para integração com PayGO Web SDK
 * 
 * Este plugin faz a ponte entre o app React/TypeScript e o PayGO Web SDK
 * instalado no tablet Android via HTTP.
 * 
 * IMPORTANTE: Este plugin requer que o PayGO Web SDK esteja rodando localmente
 * no tablet (geralmente em http://localhost:8080)
 */
@CapacitorPlugin(name = "PayGO")
public class PayGOPlugin extends Plugin {
    
    private String paygoHost = "localhost";
    private int paygoPort = 8080;
    private String automationKey = "";
    private int timeout = 30000; // 30 segundos
    
    /**
     * Inicializar PayGO com configurações
     */
    @PluginMethod
    public void initialize(PluginCall call) {
        try {
            // Receber configurações do JS
            if (call.hasOption("host")) {
                paygoHost = call.getString("host");
            }
            if (call.hasOption("port")) {
                paygoPort = call.getInt("port");
            }
            if (call.hasOption("automationKey")) {
                automationKey = call.getString("automationKey");
            }
            if (call.hasOption("timeout")) {
                timeout = call.getInt("timeout");
            }
            
            // Testar conexão com PayGO
            String testUrl = "http://" + paygoHost + ":" + paygoPort + "/api/status";
            boolean connected = testConnection(testUrl);
            
            JSObject result = new JSObject();
            result.put("success", connected);
            result.put("message", connected ? "PayGO inicializado com sucesso" : "Falha ao conectar com PayGO");
            
            call.resolve(result);
            
        } catch (Exception e) {
            JSObject error = new JSObject();
            error.put("success", false);
            error.put("message", "Erro ao inicializar: " + e.getMessage());
            error.put("error", e.toString());
            call.reject("Erro ao inicializar PayGO", error);
        }
    }
    
    /**
     * Verificar status do PayGO
     */
    @PluginMethod
    public void checkStatus(PluginCall call) {
        try {
            String url = "http://" + paygoHost + ":" + paygoPort + "/api/status";
            String response = makeHttpRequest(url, "GET", null);
            
            JSONObject json = new JSONObject(response);
            
            JSObject result = new JSObject();
            result.put("initialized", json.optBoolean("initialized", false));
            result.put("processing", json.optBoolean("processing", false));
            result.put("connected", true);
            result.put("online", true);
            result.put("status", json.optString("status", "ready"));
            
            call.resolve(result);
            
        } catch (Exception e) {
            JSObject result = new JSObject();
            result.put("initialized", false);
            result.put("processing", false);
            result.put("connected", false);
            result.put("online", false);
            result.put("status", "error");
            call.resolve(result);
        }
    }
    
    /**
     * Processar pagamento
     */
    @PluginMethod
    public void processPayment(PluginCall call) {
        try {
            double amount = call.getDouble("amount", 0.0);
            String paymentType = call.getString("paymentType", "credit");
            String orderId = call.getString("orderId", "");
            
            if (amount <= 0) {
                throw new Exception("Valor inválido");
            }
            
            // Construir payload para PayGO
            JSONObject payload = new JSONObject();
            payload.put("amount", amount);
            payload.put("paymentType", paymentType);
            payload.put("orderId", orderId);
            payload.put("automationKey", automationKey);
            
            String url = "http://" + paygoHost + ":" + paygoPort + "/api/payment";
            String response = makeHttpRequest(url, "POST", payload.toString());
            
            JSONObject json = new JSONObject(response);
            
            JSObject result = new JSObject();
            result.put("success", json.optBoolean("success", false));
            result.put("message", json.optString("message", ""));
            result.put("status", json.optString("status", "error"));
            result.put("authorizationCode", json.optString("authorizationCode", ""));
            result.put("transactionId", json.optString("transactionId", ""));
            result.put("orderId", orderId);
            result.put("amount", amount);
            result.put("paymentType", paymentType);
            
            call.resolve(result);
            
        } catch (Exception e) {
            JSObject error = new JSObject();
            error.put("success", false);
            error.put("message", "Erro no pagamento: " + e.getMessage());
            error.put("error", e.toString());
            error.put("status", "error");
            call.reject("Erro no pagamento", error);
        }
    }
    
    /**
     * Cancelar transação
     */
    @PluginMethod
    public void cancelTransaction(PluginCall call) {
        try {
            String transactionId = call.getString("transactionId", "");
            
            JSONObject payload = new JSONObject();
            payload.put("transactionId", transactionId);
            
            String url = "http://" + paygoHost + ":" + paygoPort + "/api/cancel";
            String response = makeHttpRequest(url, "POST", payload.toString());
            
            JSONObject json = new JSONObject(response);
            
            JSObject result = new JSObject();
            result.put("success", json.optBoolean("success", false));
            result.put("message", json.optString("message", "Transação cancelada"));
            
            call.resolve(result);
            
        } catch (Exception e) {
            JSObject error = new JSObject();
            error.put("success", false);
            error.put("message", "Erro ao cancelar: " + e.getMessage());
            call.reject("Erro ao cancelar", error);
        }
    }
    
    /**
     * Obter status do sistema
     */
    @PluginMethod
    public void getSystemStatus(PluginCall call) {
        try {
            String url = "http://" + paygoHost + ":" + paygoPort + "/api/system";
            String response = makeHttpRequest(url, "GET", null);
            
            JSONObject json = new JSONObject(response);
            
            JSObject result = new JSObject();
            result.put("initialized", json.optBoolean("initialized", false));
            result.put("online", json.optBoolean("online", false));
            result.put("clientConnected", json.optBoolean("clientConnected", false));
            result.put("usbDeviceDetected", json.optBoolean("usbDeviceDetected", false));
            result.put("libraryVersion", json.optString("libraryVersion", ""));
            result.put("timestamp", System.currentTimeMillis());
            
            call.resolve(result);
            
        } catch (Exception e) {
            JSObject error = new JSObject();
            error.put("error", e.getMessage());
            call.reject("Erro ao obter status", error);
        }
    }
    
    /**
     * Testar conexão
     */
    @PluginMethod
    public void testConnection(PluginCall call) {
        try {
            String url = "http://" + paygoHost + ":" + paygoPort + "/api/ping";
            boolean connected = testConnection(url);
            
            JSObject result = new JSObject();
            result.put("success", connected);
            result.put("message", connected ? "Conexão OK" : "Falha na conexão");
            
            call.resolve(result);
            
        } catch (Exception e) {
            JSObject error = new JSObject();
            error.put("success", false);
            error.put("message", e.getMessage());
            call.reject("Erro ao testar conexão", error);
        }
    }
    
    // ========== MÉTODOS AUXILIARES ==========
    
    private String makeHttpRequest(String urlString, String method, String payload) throws Exception {
        URL url = new URL(urlString);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        
        try {
            conn.setRequestMethod(method);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("X-Automation-Key", automationKey);
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
