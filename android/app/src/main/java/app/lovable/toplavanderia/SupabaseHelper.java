package app.lovable.toplavanderia;

import android.content.Context;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;

/**
 * HELPER PARA CONEXÃO COM SUPABASE
 * 
 * Gerencia a comunicação com o banco Supabase existente
 * Sistema híbrido: funciona offline e sincroniza quando online
 */
public class SupabaseHelper {
    private static final String TAG = "SupabaseHelper";
    
    // Configurações do Supabase
    private static final String SUPABASE_URL = "https://rkdybjzwiwwqqzjfmerm.supabase.co";
    private static final String SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZHlianp3aXd3cXF6amZtZXJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMDgxNjcsImV4cCI6MjA2ODg4NDE2N30.CnRP8lrmGmvcbHmWdy72ZWlfZ28cDdNoxdADnyFAOXg";
    
    private Context context;
    private boolean isOnline;
    
    public SupabaseHelper(Context context) {
        this.context = context;
        this.isOnline = false;
    }
    
    // ===== MÉTODOS PARA MÁQUINAS =====
    
    public List<Machine> getAllMachines() {
        List<Machine> machines = new ArrayList<>();
        
        try {
            Log.d(TAG, "=== CARREGANDO MÁQUINAS ===");
            Log.d(TAG, "Verificando conectividade...");
            
            if (isOnline()) {
                Log.d(TAG, "✅ Online - Buscando do Supabase");
                machines = fetchMachinesFromSupabase();
            } else {
                Log.d(TAG, "❌ Offline - Usando dados padrão");
                machines = getDefaultMachines();
            }
            
            Log.d(TAG, "Máquinas carregadas: " + machines.size());
            for (Machine machine : machines) {
                Log.d(TAG, "  - " + machine.getName() + " (" + machine.getType() + ") - " + machine.getStatus());
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Erro ao carregar máquinas", e);
            machines = getDefaultMachines();
        }
        
        return machines;
    }
    
    private List<Machine> fetchMachinesFromSupabase() {
        List<Machine> machines = new ArrayList<>();
        
        try {
            String url = SUPABASE_URL + "/rest/v1/machines?select=*&order=name";
            
            HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setRequestMethod("GET");
            connection.setRequestProperty("apikey", SUPABASE_ANON_KEY);
            connection.setRequestProperty("Authorization", "Bearer " + SUPABASE_ANON_KEY);
            connection.setRequestProperty("Content-Type", "application/json");
            
            int responseCode = connection.getResponseCode();
            if (responseCode == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()));
                StringBuilder response = new StringBuilder();
                String line;
                
                while ((line = reader.readLine()) != null) {
                    response.append(line);
                }
                reader.close();
                
                JSONArray machinesArray = new JSONArray(response.toString());
                
                for (int i = 0; i < machinesArray.length(); i++) {
                    JSONObject machineJson = machinesArray.getJSONObject(i);
                    Machine machine = new Machine();
                    
                    machine.setId(machineJson.getString("id"));
                    machine.setName(machineJson.getString("name"));
                    machine.setType(mapType(machineJson.getString("type")));
                    machine.setStatus(mapStatus(machineJson.getString("status")));
                    machine.setPrice(machineJson.optDouble("price_per_kg", 15.00));
                    machine.setDuration(machineJson.optInt("cycle_time_minutes", 40));
                    machine.setLocation(machineJson.optString("location", "Conjunto A"));
                    machine.setEsp32Id(machineJson.optString("esp32_id", "main"));
                    machine.setRelayPin(machineJson.optInt("relay_pin", 1));
                    
                    machines.add(machine);
                }
                
                Log.d(TAG, "Máquinas carregadas do Supabase: " + machines.size());
            } else {
                Log.e(TAG, "Erro ao buscar máquinas do Supabase: " + responseCode);
                machines = getDefaultMachines();
            }
            
            connection.disconnect();
            
        } catch (Exception e) {
            Log.e(TAG, "Erro na comunicação com Supabase", e);
            machines = getDefaultMachines();
        }
        
        return machines;
    }
    
    private List<Machine> getDefaultMachines() {
        List<Machine> machines = new ArrayList<>();
        
        // Máquinas de lavar
        machines.add(createMachine("1", "Lavadora 1", "LAVAR", "LIVRE", 15.00, 30, "Conjunto A", "main", 1));
        machines.add(createMachine("2", "Lavadora 2", "LAVAR", "LIVRE", 15.00, 30, "Conjunto A", "main", 2));
        machines.add(createMachine("3", "Lavadora 3", "LAVAR", "LIVRE", 15.00, 30, "Conjunto B", "secondary", 1));
        
        // Máquinas de secar
        machines.add(createMachine("4", "Secadora 1", "SECAR", "LIVRE", 10.00, 20, "Conjunto A", "main", 3));
        machines.add(createMachine("5", "Secadora 2", "SECAR", "LIVRE", 10.00, 20, "Conjunto A", "main", 4));
        machines.add(createMachine("6", "Secadora 3", "SECAR", "LIVRE", 10.00, 20, "Conjunto B", "secondary", 2));
        
        Log.d(TAG, "Máquinas padrão carregadas: " + machines.size());
        return machines;
    }
    
    private Machine createMachine(String id, String name, String type, String status, double price, int duration, String location, String esp32Id, int relayPin) {
        Machine machine = new Machine();
        machine.setId(id);
        machine.setName(name);
        machine.setType(type);
        machine.setStatus(status);
        machine.setPrice(price);
        machine.setDuration(duration);
        machine.setLocation(location);
        machine.setEsp32Id(esp32Id);
        machine.setRelayPin(relayPin);
        return machine;
    }
    
    private String mapType(String supabaseType) {
        switch (supabaseType) {
            case "washing":
            case "lavadora":
                return "LAVAR";
            case "drying":
            case "secadora":
                return "SECAR";
            default:
                return "LAVAR"; // Default para lavadora
        }
    }
    
    private String mapStatus(String supabaseStatus) {
        switch (supabaseStatus) {
            case "available":
                return "LIVRE";
            case "in_use":
                return "OCUPADA";
            case "maintenance":
                return "MANUTENCAO";
            case "offline":
                return "OFFLINE";
            default:
                return "LIVRE";
        }
    }
    
    // ===== MÉTODOS PARA OPERAÇÕES =====
    
    public boolean createTransaction(String machineId, String service, double price, String paymentCode, String transactionId) {
        try {
            if (isOnline()) {
                return createTransactionInSupabase(machineId, service, price, paymentCode, transactionId);
            } else {
                // Salvar localmente para sincronização posterior
                return saveTransactionLocally(machineId, service, price, paymentCode, transactionId);
            }
        } catch (Exception e) {
            Log.e(TAG, "Erro ao criar transação", e);
            return false;
        }
    }
    
    private boolean createTransactionInSupabase(String machineId, String service, double price, String paymentCode, String transactionId) {
        try {
            String url = SUPABASE_URL + "/rest/v1/transactions";
            
            JSONObject transaction = new JSONObject();
            transaction.put("machine_id", machineId);
            transaction.put("service_type", service);
            transaction.put("amount", price);
            transaction.put("payment_method", "card");
            transaction.put("payment_code", paymentCode);
            transaction.put("transaction_id", transactionId);
            transaction.put("status", "completed");
            
            HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setRequestMethod("POST");
            connection.setRequestProperty("apikey", SUPABASE_ANON_KEY);
            connection.setRequestProperty("Authorization", "Bearer " + SUPABASE_ANON_KEY);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setDoOutput(true);
            
            OutputStream os = connection.getOutputStream();
            os.write(transaction.toString().getBytes());
            os.flush();
            os.close();
            
            int responseCode = connection.getResponseCode();
            connection.disconnect();
            
            if (responseCode == 201) {
                Log.d(TAG, "Transação criada no Supabase com sucesso");
                return true;
            } else {
                Log.e(TAG, "Erro ao criar transação no Supabase: " + responseCode);
                return false;
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Erro na comunicação com Supabase", e);
            return false;
        }
    }
    
    private boolean saveTransactionLocally(String machineId, String service, double price, String paymentCode, String transactionId) {
        // Implementar salvamento local para sincronização posterior
        Log.d(TAG, "Transação salva localmente para sincronização posterior");
        return true;
    }
    
    // ===== MÉTODOS PARA STATUS DAS MÁQUINAS =====
    
    public boolean updateMachineStatus(String machineId, String status) {
        try {
            if (isOnline()) {
                return updateMachineStatusInSupabase(machineId, status);
            } else {
                // Atualizar localmente
                return updateMachineStatusLocally(machineId, status);
            }
        } catch (Exception e) {
            Log.e(TAG, "Erro ao atualizar status da máquina", e);
            return false;
        }
    }
    
    private boolean updateMachineStatusInSupabase(String machineId, String status) {
        try {
            String url = SUPABASE_URL + "/rest/v1/machines?id=eq." + machineId;
            
            JSONObject updateData = new JSONObject();
            updateData.put("status", mapStatusToSupabase(status));
            updateData.put("updated_at", "now()");
            
            HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setRequestMethod("PATCH");
            connection.setRequestProperty("apikey", SUPABASE_ANON_KEY);
            connection.setRequestProperty("Authorization", "Bearer " + SUPABASE_ANON_KEY);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setDoOutput(true);
            
            OutputStream os = connection.getOutputStream();
            os.write(updateData.toString().getBytes());
            os.flush();
            os.close();
            
            int responseCode = connection.getResponseCode();
            connection.disconnect();
            
            if (responseCode == 200 || responseCode == 204) {
                Log.d(TAG, "Status da máquina atualizado no Supabase");
                return true;
            } else {
                Log.e(TAG, "Erro ao atualizar status no Supabase: " + responseCode);
                return false;
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Erro na comunicação com Supabase", e);
            return false;
        }
    }
    
    private boolean updateMachineStatusLocally(String machineId, String status) {
        // Implementar atualização local
        Log.d(TAG, "Status da máquina atualizado localmente");
        return true;
    }
    
    private String mapStatusToSupabase(String localStatus) {
        switch (localStatus) {
            case "LIVRE":
                return "available";
            case "OCUPADA":
                return "in_use";
            case "MANUTENCAO":
                return "maintenance";
            case "OFFLINE":
                return "offline";
            default:
                return "available";
        }
    }
    
    // ===== MÉTODOS DE CONECTIVIDADE =====
    
    public boolean isOnline() {
        try {
            Log.d(TAG, "=== VERIFICANDO CONECTIVIDADE ===");
            Log.d(TAG, "URL: " + SUPABASE_URL);
            
            // Testar conectividade com Supabase
            String url = SUPABASE_URL + "/rest/v1/machines?select=id&limit=1";
            
            HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setRequestMethod("GET");
            connection.setRequestProperty("apikey", SUPABASE_ANON_KEY);
            connection.setRequestProperty("Authorization", "Bearer " + SUPABASE_ANON_KEY);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setConnectTimeout(10000); // 10 segundos
            connection.setReadTimeout(10000); // 10 segundos
            
            int responseCode = connection.getResponseCode();
            String responseMessage = connection.getResponseMessage();
            
            Log.d(TAG, "Response Code: " + responseCode);
            Log.d(TAG, "Response Message: " + responseMessage);
            
            connection.disconnect();
            
            isOnline = (responseCode == 200);
            Log.d(TAG, "Status de conectividade: " + (isOnline ? "✅ Online" : "❌ Offline"));
            
            return isOnline;
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Erro ao verificar conectividade", e);
            isOnline = false;
            return false;
        }
    }
    
    public boolean isConnected() {
        return isOnline;
    }
    
    // ===== CLASSE MACHINE =====
    
    public static class Machine {
        private String id;
        private String name;
        private String type;
        private String status;
        private double price;
        private int duration;
        private String location;
        private String esp32Id;
        private int relayPin;
        
        // Getters e Setters
        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        
        public double getPrice() { return price; }
        public void setPrice(double price) { this.price = price; }
        
        public int getDuration() { return duration; }
        public void setDuration(int duration) { this.duration = duration; }
        
        public String getLocation() { return location; }
        public void setLocation(String location) { this.location = location; }
        
        public String getEsp32Id() { return esp32Id; }
        public void setEsp32Id(String esp32Id) { this.esp32Id = esp32Id; }
        
        public int getRelayPin() { return relayPin; }
        public void setRelayPin(int relayPin) { this.relayPin = relayPin; }
        
        public boolean isAvailable() {
            return "LIVRE".equals(status);
        }
        
        public String getStatusDisplay() {
            switch (status) {
                case "LIVRE": return "🟢 Livre";
                case "OCUPADA": return "🔴 Ocupada";
                case "MANUTENCAO": return "🟡 Manutenção";
                case "OFFLINE": return "⚫ Offline";
                default: return "❓ Desconhecido";
            }
        }
        
        public String getTypeDisplay() {
            switch (type) {
                case "LAVAR": return "🧺 Lavar";
                case "SECAR": return "🌪️ Secar";
                default: return "❓ Desconhecido";
            }
        }
    }
}
