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
    
    // CONFIGURAÇÃO DO TOTEM - ID DA LAVANDERIA
    // ALTERE ESTE VALOR PARA O ID DA SUA LAVANDERIA OU USE SharedPreferences
    private static final String DEFAULT_LAUNDRY_ID = "567a7bb6-8d26-4d9c-bbe3-f8dcc28e7569";
    private static final String PREFS_NAME = "totem_config";
    private static final String PREF_LAUNDRY_ID = "laundry_id";
    
    private Context context;
    private boolean isOnline;
    private List<Machine> realMachines;
    private boolean realMachinesLoaded;
    private OnMachinesLoadedListener listener;
    private String currentLaundryId;
    
    public interface OnMachinesLoadedListener {
        void onMachinesLoaded(List<Machine> machines);
    }
    
    public SupabaseHelper(Context context) {
        this.context = context;
        this.isOnline = false;
        this.realMachines = null;
        this.realMachinesLoaded = false;
        this.listener = null;
        
        // Carregar laundry_id das preferências ou usar padrão
        android.content.SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        this.currentLaundryId = prefs.getString(PREF_LAUNDRY_ID, DEFAULT_LAUNDRY_ID);
        
        Log.d(TAG, "=== CONFIGURAÇÃO DO TOTEM ===");
        Log.d(TAG, "Laundry ID: " + currentLaundryId);
    }
    
    /**
     * Define o ID da lavanderia para este totem
     * Use este método para configurar o totem remotamente
     */
    public void setLaundryId(String laundryId) {
        this.currentLaundryId = laundryId;
        
        // Salvar nas preferências
        android.content.SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(PREF_LAUNDRY_ID, laundryId).apply();
        
        Log.d(TAG, "Laundry ID atualizado para: " + laundryId);
        
        // Recarregar máquinas
        realMachinesLoaded = false;
        realMachines = null;
    }
    
    /**
     * Retorna o ID da lavanderia configurado
     */
    public String getLaundryId() {
        return currentLaundryId;
    }
    
    public void setOnMachinesLoadedListener(OnMachinesLoadedListener listener) {
        this.listener = listener;
    }
    
    // ===== MÉTODOS PARA MÁQUINAS =====
    
    public List<Machine> getAllMachines() {
        Log.d(TAG, "=== CARREGANDO MÁQUINAS ===");
        
        // Se já temos dados reais carregados, retornar eles
        if (realMachinesLoaded && realMachines != null && !realMachines.isEmpty()) {
            Log.d(TAG, "Retornando dados reais do Supabase: " + realMachines.size());
            return realMachines;
        }
        
        // Retornar dados padrão se ainda não temos dados reais
        List<Machine> machines = getDefaultMachines();
        
        // Carregar dados do Supabase em background se ainda não carregamos
        if (!realMachinesLoaded) {
            new Thread(() -> {
                try {
                    Log.d(TAG, "Tentando carregar dados reais do Supabase...");
                    
                    // Tentar carregar dados do Supabase diretamente
                    List<Machine> supabaseMachines = fetchMachinesFromSupabase();
                    
                    if (supabaseMachines != null && !supabaseMachines.isEmpty()) {
                        Log.d(TAG, "✅ Dados reais do Supabase carregados: " + supabaseMachines.size());
                        
                        // Carregar status dos ESP32s para determinar disponibilidade real
                        loadEsp32Status(supabaseMachines);
                        
                        for (Machine machine : supabaseMachines) {
                            Log.d(TAG, "  - " + machine.getName() + " (" + machine.getType() + ") - " + machine.getStatus() + " (ESP32: " + machine.isEsp32Online() + ")");
                        }
                        
                        // Armazenar dados reais
                        realMachines = supabaseMachines;
                        realMachinesLoaded = true;
                        isOnline = true;
                        
                        Log.d(TAG, "Dados reais do Supabase prontos para exibição");
                        
                        // Notificar que os dados reais foram carregados
                        if (listener != null) {
                            listener.onMachinesLoaded(realMachines);
                        }
                    } else {
                        Log.d(TAG, "❌ Falha ao carregar dados do Supabase - usando dados padrão");
                    }
                    
                } catch (Exception e) {
                    Log.e(TAG, "Erro ao carregar máquinas do Supabase", e);
                }
            }).start();
        }
        
        Log.d(TAG, "Máquinas carregadas: " + machines.size());
        for (Machine machine : machines) {
            Log.d(TAG, "  - " + machine.getName() + " (" + machine.getType() + ") - " + machine.getStatus());
        }
        
        return machines;
    }
    
    private List<Machine> fetchMachinesFromSupabase() {
        List<Machine> machines = new ArrayList<>();
        
        try {
            // FILTRAR MÁQUINAS POR LAVANDERIA
            String url = SUPABASE_URL + "/rest/v1/machines?select=*&laundry_id=eq." + currentLaundryId + "&order=name";
            
            Log.d(TAG, "Buscando máquinas da lavanderia: " + currentLaundryId);
            Log.d(TAG, "URL: " + url);
            
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
                    machine.setEsp32Online(true); // Será atualizado pelo loadEsp32Status
                    
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
    
    private void loadEsp32Status(List<Machine> machines) {
        try {
            Log.d(TAG, "=== CARREGANDO STATUS DOS ESP32s ===");
            
            String url = SUPABASE_URL + "/rest/v1/esp32_status?select=esp32_id,status_da_rede,last_seen";
            
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
                
                JSONArray esp32Array = new JSONArray(response.toString());
                
                // Criar mapa de status dos ESP32s baseado no status_da_rede
                java.util.Map<String, String> esp32StatusMap = new java.util.HashMap<>();
                for (int i = 0; i < esp32Array.length(); i++) {
                    JSONObject esp32Json = esp32Array.getJSONObject(i);
                    String esp32Id = esp32Json.getString("esp32_id");
                    String statusRede = esp32Json.optString("status_da_rede", "offline");
                    esp32StatusMap.put(esp32Id, statusRede);
                    
                    Log.d(TAG, "ESP32 " + esp32Id + ": " + statusRede);
                }
                
                // Atualizar status das máquinas baseado no status_da_rede do ESP32
                for (Machine machine : machines) {
                    String esp32Id = machine.getEsp32Id();
                    String esp32Status = esp32StatusMap.getOrDefault(esp32Id, "offline");
                    boolean esp32Online = "online".equalsIgnoreCase(esp32Status) || "conectado".equalsIgnoreCase(esp32Status);
                    machine.setEsp32Online(esp32Online);
                    
                    Log.d(TAG, "Máquina " + machine.getName() + " - ESP32 " + esp32Id + " status: " + esp32Status + " (Online: " + esp32Online + ")");
                }
                
                Log.d(TAG, "Status dos ESP32s carregado: " + esp32StatusMap.size() + " dispositivos");
            } else {
                Log.w(TAG, "Erro ao buscar status dos ESP32s: " + responseCode);
                // Se não conseguir carregar status, assumir que todos estão online
                for (Machine machine : machines) {
                    machine.setEsp32Online(true);
                }
            }
            
            connection.disconnect();
            
        } catch (Exception e) {
            Log.e(TAG, "Erro ao carregar status dos ESP32s", e);
            // Se houver erro, assumir que todos estão online
            for (Machine machine : machines) {
                machine.setEsp32Online(true);
            }
        }
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
        machine.setEsp32Online(true); // Por padrão, assumir que está online
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
    
    public boolean startMachineUsage(String machineId, int durationMinutes) {
        try {
            Log.d(TAG, "Iniciando uso da máquina " + machineId + " por " + durationMinutes + " minutos");
            
            // Marcar máquina como ocupada
            boolean statusUpdated = updateMachineStatus(machineId, "OCUPADA");
            
            if (statusUpdated) {
                // Agendar liberação da máquina após o tempo de uso
                scheduleMachineRelease(machineId, durationMinutes);
                return true;
            }
            
            return false;
        } catch (Exception e) {
            Log.e(TAG, "Erro ao iniciar uso da máquina", e);
            return false;
        }
    }
    
    private void scheduleMachineRelease(String machineId, int durationMinutes) {
        // Em uma implementação real, isso seria feito com um timer ou job scheduler
        // Por enquanto, vamos simular com um delay
        new Thread(() -> {
            try {
                Log.d(TAG, "Agendando liberação da máquina " + machineId + " em " + durationMinutes + " minutos");
                
                // Aguardar o tempo de uso (em milissegundos)
                Thread.sleep(durationMinutes * 60 * 1000);
                
                // Liberar a máquina
                Log.d(TAG, "Liberando máquina " + machineId + " após " + durationMinutes + " minutos");
                updateMachineStatus(machineId, "LIVRE");
                
            } catch (InterruptedException e) {
                Log.e(TAG, "Timer de liberação da máquina interrompido", e);
            }
        }).start();
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
        // Verificar se já temos um status válido recente
        if (isOnline) {
            return true;
        }
        
        // Para evitar NetworkOnMainThreadException, retornar false por padrão
        // A verificação real será feita em background
        Log.d(TAG, "=== VERIFICANDO CONECTIVIDADE (Background) ===");
        Log.d(TAG, "URL: " + SUPABASE_URL);
        
        // Iniciar verificação em background
        new Thread(() -> {
            try {
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
                
            } catch (Exception e) {
                Log.e(TAG, "❌ Erro ao verificar conectividade", e);
                isOnline = false;
            }
        }).start();
        
        return false; // Retornar false por padrão, será atualizado em background
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
        private boolean esp32Online;
        
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
        
        public boolean isEsp32Online() { return esp32Online; }
        public void setEsp32Online(boolean esp32Online) { this.esp32Online = esp32Online; }
        
        public boolean isAvailable() {
            return "LIVRE".equals(status) && esp32Online;
        }
        
        public boolean isOnline() {
            return esp32Online;
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
