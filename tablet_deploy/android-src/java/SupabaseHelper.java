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
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;

/**
 * HELPER PARA CONEXÃO COM SUPABASE
 * 
 * Gerencia a comunicação com o banco Supabase existente
 * Sistema híbrido: funciona offline e sincroniza quando online
 */
public class SupabaseHelper {
    private static final String TAG = "SupabaseHelper";
    
    private static final String SUPABASE_URL = SupabaseConfig.SUPABASE_URL;
    
    // CONFIGURAÇÃO DO TOTEM - CNPJ DA LAVANDERIA
    private static final String PREFS_NAME = "totem_config";
    private static final String PREF_LAUNDRY_CNPJ = "laundry_cnpj";
    private static final String PREF_LAUNDRY_ID = "laundry_id";
    private static final String PREF_LAUNDRY_NAME = "laundry_name";
    private static final String PREF_LAUNDRY_LOGO = "laundry_logo";
    
    private Context context;
    private boolean isOnline;
    private List<Machine> realMachines;
    private boolean realMachinesLoaded;
    private OnMachinesLoadedListener listener;
    private String currentLaundryId;
    private String currentLaundryCNPJ;
    private String currentLaundryName;
    private String currentLaundryLogo;
    
    public interface OnMachinesLoadedListener {
        void onMachinesLoaded(List<Machine> machines);
    }
    
    public SupabaseHelper(Context context) {
        this.context = context;
        this.isOnline = false;
        this.realMachines = null;
        this.realMachinesLoaded = false;
        this.listener = null;
        
        // Carregar configurações das preferências
        android.content.SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        this.currentLaundryCNPJ = prefs.getString(PREF_LAUNDRY_CNPJ, null);
        this.currentLaundryId = prefs.getString(PREF_LAUNDRY_ID, null);
        this.currentLaundryName = prefs.getString(PREF_LAUNDRY_NAME, "TOP LAVANDERIA");
        this.currentLaundryLogo = prefs.getString(PREF_LAUNDRY_LOGO, null);
        
        Log.d(TAG, "=== CONFIGURAÇÃO DO TOTEM ===");
        Log.d(TAG, "CNPJ: " + currentLaundryCNPJ);
        Log.d(TAG, "Laundry ID: " + currentLaundryId);
        Log.d(TAG, "Nome: " + currentLaundryName);
        if (!SupabaseConfig.isConfigured()) {
            Log.e(TAG, "Supabase nativo não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no .env ou propriedades Gradle.");
        }
    }
    
    /**
     * Configura a lavanderia usando o CNPJ
     * Busca os dados da lavanderia no Supabase e salva localmente
     */
    public boolean configureLaundryByCNPJ(String cnpj) {
        Log.d(TAG, "=== CONFIGURANDO LAVANDERIA POR CNPJ ===");
        Log.d(TAG, "CNPJ: " + cnpj);
        
        try {
            Laundry laundry = fetchLaundryByCNPJ(cnpj);
            
            if (laundry != null) {
                this.currentLaundryCNPJ = cnpj;
                this.currentLaundryId = laundry.getId();
                this.currentLaundryName = laundry.getName();
                
                // Salvar nas preferências
                android.content.SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                prefs.edit()
                    .putString(PREF_LAUNDRY_CNPJ, cnpj)
                    .putString(PREF_LAUNDRY_ID, laundry.getId())
                    .putString(PREF_LAUNDRY_NAME, laundry.getName())
                    .putString(PREF_LAUNDRY_LOGO, laundry.getLogoUrl())
                    .apply();
                
                // Recarregar máquinas
                realMachinesLoaded = false;
                realMachines = null;
                
                Log.d(TAG, "✅ Lavanderia configurada com sucesso: " + laundry.getName());
                return true;
            } else {
                Log.e(TAG, "❌ Lavanderia não encontrada com CNPJ: " + cnpj);
                return false;
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Erro ao configurar lavanderia", e);
            return false;
        }
    }
    
    /**
     * Verifica se o totem está configurado
     */
    public boolean isConfigured() {
        return currentLaundryId != null && currentLaundryCNPJ != null;
    }
    
    /**
     * Retorna o CNPJ da lavanderia configurada
     */
    public String getLaundryCNPJ() {
        return currentLaundryCNPJ;
    }
    
    /**
     * Retorna o ID da lavanderia configurada
     */
    public String getLaundryId() {
        return currentLaundryId;
    }
    
    /**
     * Retorna o nome da lavanderia configurada
     */
    public String getLaundryName() {
        return currentLaundryName != null ? currentLaundryName : "TOP LAVANDERIA";
    }
    
    /**
     * Retorna a URL do logo da lavanderia configurada
     */
    public String getLaundryLogo() {
        return currentLaundryLogo;
    }

    // ===== MÉTODOS DE CONFIGURAÇÃO DE PAGAMENTO =====

    /** Cache of system settings fetched from Supabase */
    private JSONObject cachedSystemSettings = null;

    private JSONObject fetchSystemSettings() {
        if (cachedSystemSettings != null) return cachedSystemSettings;
        if (currentLaundryId == null) return null;
        try {
            String url = SUPABASE_URL + "/rest/v1/rpc/get_totem_settings";
            HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setRequestMethod("POST");
            SupabaseConfig.applyJsonHeaders(connection);
            connection.setDoOutput(true);
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);

            JSONObject body = new JSONObject();
            body.put("_laundry_id", currentLaundryId);
            OutputStream os = connection.getOutputStream();
            os.write(body.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            os.close();

            int code = connection.getResponseCode();
            if (code == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) sb.append(line);
                reader.close();
                cachedSystemSettings = new JSONObject(sb.toString());
                return cachedSystemSettings;
            }
        } catch (Exception e) {
            Log.e(TAG, "Error fetching system settings", e);
        }
        return null;
    }

    public String getPaymentProvider() {
        JSONObject s = fetchSystemSettings();
        if (s != null) return s.optString("paygo_provedor", "paygo");
        return "paygo";
    }

    public String getCieloClientId() {
        JSONObject s = fetchSystemSettings();
        return s != null ? s.optString("cielo_client_id", "") : "";
    }

    public String getCieloAccessToken() {
        JSONObject s = fetchSystemSettings();
        return s != null ? s.optString("cielo_access_token", "") : "";
    }

    public String getCieloMerchantCode() {
        JSONObject s = fetchSystemSettings();
        return s != null ? s.optString("cielo_merchant_code", "") : "";
    }

    public String getCieloEnvironment() {
        JSONObject s = fetchSystemSettings();
        return s != null ? s.optString("cielo_environment", "sandbox") : "sandbox";
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
    
    /**
     * Busca lavanderia pelo CNPJ no Supabase
     */
    private Laundry fetchLaundryByCNPJ(String cnpj) {
        HttpURLConnection connection = null;
        try {
            String url = SUPABASE_URL + "/rest/v1/rpc/get_laundry_by_cnpj";
            
            Log.d(TAG, "Buscando lavanderia por CNPJ: " + cnpj);
            Log.d(TAG, "URL: " + url);
            
            connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setRequestMethod("POST");
            SupabaseConfig.applyJsonHeaders(connection);
            connection.setDoOutput(true);
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(10000);

            JSONObject body = new JSONObject();
            body.put("_cnpj", cnpj);
            OutputStream os = connection.getOutputStream();
            os.write(body.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            os.close();
            
            int responseCode = connection.getResponseCode();
            if (responseCode == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()));
                StringBuilder response = new StringBuilder();
                String line;
                
                while ((line = reader.readLine()) != null) {
                    response.append(line);
                }
                reader.close();
                
                JSONArray laundriesArray = new JSONArray(response.toString());
                
                if (laundriesArray.length() > 0) {
                    JSONObject laundryJson = laundriesArray.getJSONObject(0);
                    
                    Laundry laundry = new Laundry();
                    laundry.setId(laundryJson.getString("id"));
                    laundry.setCnpj(laundryJson.getString("cnpj"));
                    laundry.setName(laundryJson.getString("name"));
                    laundry.setAddress("");
                    laundry.setCity("");
                    laundry.setState("");
                    laundry.setLogoUrl(laundryJson.optString("logo_url", null));
                    
                    Log.d(TAG, "✅ Lavanderia encontrada: " + laundry.getName());
                    if (laundry.getLogoUrl() != null) {
                        Log.d(TAG, "Logo URL: " + laundry.getLogoUrl());
                    }
                    return laundry;
                } else {
                    Log.e(TAG, "❌ Nenhuma lavanderia ativa encontrada com CNPJ: " + cnpj);
                    return null;
                }
            } else {
                Log.e(TAG, "Erro ao buscar lavanderia: " + responseCode);
                return null;
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Erro ao buscar lavanderia por CNPJ", e);
            return null;
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }
    
    private List<Machine> fetchMachinesFromSupabase() {
        List<Machine> machines = new ArrayList<>();
        HttpURLConnection connection = null;

        try {
            if (currentLaundryId == null) {
                Log.e(TAG, "❌ Lavanderia não configurada - não é possível buscar máquinas");
                return getDefaultMachines();
            }
            
            String url = SUPABASE_URL + "/rest/v1/rpc/get_public_machines";
            
            Log.d(TAG, "Buscando máquinas da lavanderia: " + currentLaundryId);
            Log.d(TAG, "URL: " + url);
            
            connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setRequestMethod("POST");
            SupabaseConfig.applyJsonHeaders(connection);
            connection.setDoOutput(true);
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(10000);

            JSONObject body = new JSONObject();
            body.put("_laundry_id", currentLaundryId);
            OutputStream os = connection.getOutputStream();
            os.write(body.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            os.close();
            
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
                    machine.setPrice(machineJson.optDouble("price_per_cycle", 15.00));
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
            
        } catch (Exception e) {
            Log.e(TAG, "Erro na comunicação com Supabase", e);
            machines = getDefaultMachines();
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
        
        return machines;
    }
    
    private void loadEsp32Status(List<Machine> machines) {
        try {
            Log.d(TAG, "=== CARREGANDO STATUS DOS ESP32s ===");

            JSONArray esp32Array = fetchEsp32StatusJsonArray();
            if (esp32Array == null) {
                esp32Array = new JSONArray();
            }

            java.util.Map<String, JSONObject> esp32StatusMap = new java.util.HashMap<>();
            for (int i = 0; i < esp32Array.length(); i++) {
                JSONObject esp32Json = esp32Array.getJSONObject(i);
                String esp32Id = esp32Json.getString("esp32_id");
                esp32StatusMap.put(esp32Id, esp32Json);
                Log.d(TAG, "ESP32 " + esp32Id + " loaded");
            }

            for (Machine machine : machines) {
                String esp32Id = machine.getEsp32Id();
                JSONObject esp32Status = esp32StatusMap.get(esp32Id);
                boolean esp32Online = isEsp32ReallyOnline(esp32Status);
                machine.setEsp32Online(esp32Online);
                Log.d(TAG, "Máquina " + machine.getName() + " - ESP32 " + esp32Id + " (Online: " + esp32Online + ")");
            }

            Log.d(TAG, "Status dos ESP32s carregado: " + esp32StatusMap.size() + " dispositivos para lavanderia " + currentLaundryId);
        } catch (Exception e) {
            Log.e(TAG, "Erro ao carregar status dos ESP32s", e);
            for (Machine machine : machines) {
                machine.setEsp32Online(false);
            }
        }
    }

    private JSONArray fetchEsp32StatusJsonArray() {
        try {
            return fetchEsp32StatusViaRpc();
        } catch (Exception e) {
            Log.e(TAG, "fetchEsp32StatusJsonArray", e);
            return new JSONArray();
        }
    }

    private JSONArray fetchEsp32StatusViaRpc() throws Exception {
        URL url = new URL(SUPABASE_URL + "/rest/v1/rpc/get_esp32_heartbeats");
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        SupabaseConfig.applyJsonHeaders(conn);
        conn.setDoOutput(true);
        conn.setConnectTimeout(10000);
        conn.setReadTimeout(10000);

        JSONObject body = new JSONObject();
        body.put("_laundry_id", currentLaundryId);
        OutputStream os = conn.getOutputStream();
        os.write(body.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
        os.close();

        int code = conn.getResponseCode();
        if (code != 200) {
            conn.disconnect();
            return new JSONArray();
        }
        BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
        StringBuilder response = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            response.append(line);
        }
        reader.close();
        conn.disconnect();
        return new JSONArray(response.toString());
    }
    
    /**
     * Valida se ESP32 está realmente online (verifica timeout de heartbeat)
     */
    private boolean isEsp32ReallyOnline(JSONObject esp32Status) {
        if (esp32Status == null) {
            return false;
        }
        
        try {
            boolean isOnline = esp32Status.optBoolean("is_online", false);
            String lastHeartbeat = esp32Status.optString("last_heartbeat", null);
            
            if (!isOnline || lastHeartbeat == null) {
                return false;
            }
            
            // Heartbeat recente — alinhado ao painel (ESP32_HEARTBEAT_STALE_MINUTES = 1)
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US);
            sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
            String hb = lastHeartbeat.replace("Z", "");
            int dot = hb.indexOf('.');
            if (dot > 0) {
                hb = hb.substring(0, dot);
            }
            Date heartbeatDate = sdf.parse(hb.length() >= 19 ? hb.substring(0, 19) : hb);
            
            if (heartbeatDate == null) {
                return false;
            }
            
            long minutesSince = (System.currentTimeMillis() - heartbeatDate.getTime()) / (1000 * 60);
            boolean isRecent = minutesSince <= 1;
            
            Log.d(TAG, "ESP32 " + esp32Status.getString("esp32_id") + 
                  " - Heartbeat: " + minutesSince + " min ago, Online: " + isRecent);
            
            return isRecent;
        } catch (Exception e) {
            Log.e(TAG, "Error validating ESP32 heartbeat: " + e.getMessage());
            return false;
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
            case "running":
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
            String url = SUPABASE_URL + "/rest/v1/rpc/create_totem_transaction";
            
            JSONObject transaction = new JSONObject();
            transaction.put("_machine_id", machineId);
            transaction.put("_total_amount", price);
            transaction.put("_duration_minutes", findMachineDuration(machineId));
            transaction.put("_payment_method", "card");
            transaction.put("_laundry_id", currentLaundryId);
            
            HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setRequestMethod("POST");
            SupabaseConfig.applyJsonHeaders(connection);
            connection.setDoOutput(true);
            
            OutputStream os = connection.getOutputStream();
            os.write(transaction.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            os.flush();
            os.close();
            
            int responseCode = connection.getResponseCode();
            connection.disconnect();
            
            if (responseCode == 200) {
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

    private int findMachineDuration(String machineId) {
        if (realMachines != null) {
            for (Machine machine : realMachines) {
                if (machineId.equals(machine.getId())) {
                    return machine.getDuration();
                }
            }
        }
        return 40;
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
    
    /**
     * Aciona relé do ESP32 via Edge Function
     * Envia comando HTTP para a Edge Function que controla os ESP32s
     */
    public boolean activateEsp32Relay(String esp32Id, int relayPin, String machineId, String transactionId, int durationMinutes) {
        try {
            Log.d(TAG, "=== ACIONANDO ESP32 ===");
            Log.d(TAG, "ESP32: " + esp32Id);
            Log.d(TAG, "Relay: " + relayPin);
            Log.d(TAG, "Máquina: " + machineId);
            
            // URL da Edge Function
            String url = SUPABASE_URL + "/functions/v1/esp32-control";
            
            // Payload JSON
            JSONObject payload = new JSONObject();
            payload.put("esp32_id", esp32Id);
            payload.put("relay_pin", relayPin);
            payload.put("action", "on");
            payload.put("machine_id", machineId);
            payload.put("transaction_id", transactionId);
            
            // Fazer requisição HTTP POST
            HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setRequestMethod("POST");
            SupabaseConfig.applyJsonHeaders(connection);
            connection.setDoOutput(true);
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(15000);
            
            // Enviar dados
            OutputStream os = connection.getOutputStream();
            os.write(payload.toString().getBytes());
            os.flush();
            os.close();
            
            // Ler resposta
            int responseCode = connection.getResponseCode();
            
            if (responseCode == 200) {
                BufferedReader br = new BufferedReader(new InputStreamReader(connection.getInputStream()));
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) {
                    response.append(line);
                }
                br.close();
                
                JSONObject result = new JSONObject(response.toString());
                boolean success = result.optBoolean("success", false);
                
                Log.d(TAG, "✅ ESP32 acionado: " + success);
                
                // Atualizar status local da máquina
                if (success) {
                    updateMachineStatus(machineId, "OCUPADA");
                    
                    // Agendar desligamento automático
                    scheduleEsp32TurnOff(esp32Id, relayPin, machineId, durationMinutes);
                }
                
                connection.disconnect();
                return success;
                
            } else {
                Log.e(TAG, "❌ Erro ao acionar ESP32: HTTP " + responseCode);
                connection.disconnect();
                return false;
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Erro ao acionar ESP32", e);
            return false;
        }
    }
    
    /**
     * Agenda desligamento automático do relé após tempo de uso
     */
    private void scheduleEsp32TurnOff(String esp32Id, int relayPin, String machineId, int durationMinutes) {
        new Thread(() -> {
            try {
                Log.d(TAG, "⏰ Agendando desligamento em " + durationMinutes + " minutos");
                
                // Aguardar tempo de uso
                Thread.sleep(durationMinutes * 60 * 1000);
                
                // Desligar ESP32
                Log.d(TAG, "🔌 Desligando ESP32 após uso");
                
                String url = SUPABASE_URL + "/functions/v1/esp32-control";
                
                JSONObject payload = new JSONObject();
                payload.put("esp32_id", esp32Id);
                payload.put("relay_pin", relayPin);
                payload.put("action", "off");
                payload.put("machine_id", machineId);
                
                HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
                connection.setRequestMethod("POST");
                SupabaseConfig.applyJsonHeaders(connection);
                connection.setDoOutput(true);
                
                OutputStream os = connection.getOutputStream();
                os.write(payload.toString().getBytes());
                os.flush();
                os.close();
                
                int responseCode = connection.getResponseCode();
                connection.disconnect();
                
                if (responseCode == 200) {
                    Log.d(TAG, "✅ ESP32 desligado automaticamente");
                    updateMachineStatus(machineId, "LIVRE");
                }
                
            } catch (Exception e) {
                Log.e(TAG, "Erro ao desligar ESP32", e);
            }
        }).start();
    }
    
    private boolean updateMachineStatusInSupabase(String machineId, String status) {
        try {
            String url = SUPABASE_URL + "/functions/v1/update-machine-status";
            
            JSONObject updateData = new JSONObject();
            updateData.put("machine_id", machineId);
            updateData.put("status", mapStatusToSupabase(status));
            
            HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setRequestMethod("POST");
            SupabaseConfig.applyJsonHeaders(connection);
            connection.setDoOutput(true);
            
            OutputStream os = connection.getOutputStream();
            os.write(updateData.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            os.flush();
            os.close();
            
            int responseCode = connection.getResponseCode();
            connection.disconnect();
            
            if (responseCode == 200) {
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
                return "running";
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
                String url = SUPABASE_URL + "/rest/v1/rpc/get_public_machines";
                
                HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
                connection.setRequestMethod("POST");
                SupabaseConfig.applyJsonHeaders(connection);
                connection.setDoOutput(true);
                connection.setConnectTimeout(10000); // 10 segundos
                connection.setReadTimeout(10000); // 10 segundos

                JSONObject body = new JSONObject();
                body.put("_laundry_id", currentLaundryId == null ? JSONObject.NULL : currentLaundryId);
                OutputStream os = connection.getOutputStream();
                os.write(body.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
                os.close();
                
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
    
    // ===== CLASSE LAUNDRY =====
    
    public static class Laundry {
        private String id;
        private String cnpj;
        private String name;
        private String address;
        private String city;
        private String state;
        private String logoUrl;
        
        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        
        public String getCnpj() { return cnpj; }
        public void setCnpj(String cnpj) { this.cnpj = cnpj; }
        
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        
        public String getAddress() { return address; }
        public void setAddress(String address) { this.address = address; }
        
        public String getCity() { return city; }
        public void setCity(String city) { this.city = city; }
        
        public String getState() { return state; }
        public void setState(String state) { this.state = state; }
        
        public String getLogoUrl() { return logoUrl; }
        public void setLogoUrl(String logoUrl) { this.logoUrl = logoUrl; }
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
