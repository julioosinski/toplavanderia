package app.lovable.toplavanderia;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;

/**
 * MONITOR DE STATUS DAS MÁQUINAS EM TEMPO REAL
 * 
 * Faz polling constante do status das máquinas e ESP32s
 * para manter a interface atualizada em tempo real
 */
public class MachineStatusMonitor {
    private static final String TAG = "MachineStatusMonitor";
    private static final int POLL_INTERVAL_MS = 5000; // 5 segundos
    
    // Configurações do Supabase
    private static final String SUPABASE_URL = "https://rkdybjzwiwwqqzjfmerm.supabase.co";
    private static final String SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZHlianp3aXd3cXF6amZtZXJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMDgxNjcsImV4cCI6MjA2ODg4NDE2N30.CnRP8lrmGmvcbHmWdy72ZWlfZ28cDdNoxdADnyFAOXg";
    
    private Handler handler;
    private Runnable pollRunnable;
    private SupabaseHelper supabaseHelper;
    private StatusUpdateListener listener;
    private boolean isRunning = false;
    
    public interface StatusUpdateListener {
        void onStatusUpdate(List<MachineStatus> statuses);
    }
    
    public MachineStatusMonitor(SupabaseHelper helper) {
        this.supabaseHelper = helper;
        this.handler = new Handler(Looper.getMainLooper());
    }
    
    public void setListener(StatusUpdateListener listener) {
        this.listener = listener;
    }
    
    public void startMonitoring() {
        if (isRunning) return;
        
        isRunning = true;
        Log.d(TAG, "🔄 Iniciando monitoramento de status");
        
        pollRunnable = new Runnable() {
            @Override
            public void run() {
                if (!isRunning) return;
                
                // Buscar status atualizado em background
                fetchMachineStatuses();
                
                // Reagendar próxima busca
                handler.postDelayed(this, POLL_INTERVAL_MS);
            }
        };
        
        // Iniciar primeira busca imediatamente
        handler.post(pollRunnable);
    }
    
    public void stopMonitoring() {
        isRunning = false;
        if (pollRunnable != null) {
            handler.removeCallbacks(pollRunnable);
        }
        Log.d(TAG, "⏹️ Monitoramento de status parado");
    }
    
    private void fetchMachineStatuses() {
        new Thread(() -> {
            try {
                String laundryId = supabaseHelper.getLaundryId();
                if (laundryId == null) {
                    Log.w(TAG, "Lavanderia não configurada - pulando monitoramento");
                    return;
                }
                
                // Buscar máquinas e status dos ESP32s
                String machinesUrl = SUPABASE_URL + "/rest/v1/machines?select=*&laundry_id=eq." + laundryId + "&order=name.asc";
                String esp32Url = SUPABASE_URL + "/rest/v1/esp32_status?select=*&laundry_id=eq." + laundryId;
                
                // Buscar máquinas
                JSONArray machinesArray = fetchFromUrl(machinesUrl);
                JSONArray esp32Array = fetchFromUrl(esp32Url);
                
                if (machinesArray == null) {
                    Log.w(TAG, "Erro ao buscar máquinas");
                    return;
                }
                
                // Criar mapa de status dos ESP32s
                java.util.Map<String, JSONObject> esp32Map = new java.util.HashMap<>();
                if (esp32Array != null) {
                    for (int i = 0; i < esp32Array.length(); i++) {
                        JSONObject esp32 = esp32Array.getJSONObject(i);
                        esp32Map.put(esp32.getString("esp32_id"), esp32);
                    }
                }
                
                // Processar status das máquinas
                List<MachineStatus> statuses = new ArrayList<>();
                for (int i = 0; i < machinesArray.length(); i++) {
                    JSONObject machine = machinesArray.getJSONObject(i);
                    
                    MachineStatus status = new MachineStatus();
                    status.machineId = machine.getString("id");
                    status.machineName = machine.getString("name");
                    status.machineType = machine.getString("type");
                    status.machineStatus = machine.getString("status");
                    status.esp32Id = machine.optString("esp32_id", "");
                    status.relayPin = machine.optInt("relay_pin", 1);
                    
                    // Verificar status do ESP32
                    JSONObject esp32Status = esp32Map.get(status.esp32Id);
                    if (esp32Status != null) {
                        status.esp32Online = isEsp32ReallyOnline(esp32Status);
                        status.relayStatus = esp32Status.optJSONObject("relay_status");
                    } else {
                        status.esp32Online = false;
                        status.relayStatus = null;
                    }
                    
                    // Calcular status computado (igual ao web)
                    status.computedStatus = computeStatus(status);
                    
                    statuses.add(status);
                }
                
                // Notificar listener na UI thread
                if (listener != null) {
                    handler.post(() -> listener.onStatusUpdate(statuses));
                }
                
            } catch (Exception e) {
                Log.e(TAG, "Erro ao buscar status", e);
            }
        }).start();
    }
    
    private JSONArray fetchFromUrl(String urlString) {
        try {
            HttpURLConnection connection = (HttpURLConnection) new URL(urlString).openConnection();
            connection.setRequestMethod("GET");
            connection.setRequestProperty("apikey", SUPABASE_ANON_KEY);
            connection.setRequestProperty("Authorization", "Bearer " + SUPABASE_ANON_KEY);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            
            int responseCode = connection.getResponseCode();
            
            if (responseCode == 200) {
                BufferedReader br = new BufferedReader(new InputStreamReader(connection.getInputStream()));
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) {
                    response.append(line);
                }
                br.close();
                connection.disconnect();
                
                return new JSONArray(response.toString());
            }
            
            connection.disconnect();
            return null;
            
        } catch (Exception e) {
            Log.e(TAG, "Erro ao buscar URL: " + urlString, e);
            return null;
        }
    }
    
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
            
            // Verificar se heartbeat não está muito antigo (máximo 2 minutos)
            long heartbeatTime = parseISODate(lastHeartbeat);
            long currentTime = System.currentTimeMillis();
            long diffMinutes = (currentTime - heartbeatTime) / (1000 * 60);
            
            return diffMinutes <= 2; // Timeout de 2 minutos
            
        } catch (Exception e) {
            Log.e(TAG, "Erro ao verificar status do ESP32", e);
            return false;
        }
    }
    
    private long parseISODate(String isoDate) {
        try {
            java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss");
            sdf.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
            return sdf.parse(isoDate.substring(0, 19)).getTime();
        } catch (Exception e) {
            return 0;
        }
    }
    
    private String computeStatus(MachineStatus status) {
        // Se ESP32 está offline, máquina está indisponível
        if (!status.esp32Online) {
            return "offline";
        }
        
        // Se ESP32 está online, verificar status da máquina
        if ("running".equals(status.machineStatus)) {
            return "running";
        } else if ("maintenance".equals(status.machineStatus)) {
            return "maintenance";
        } else if ("available".equals(status.machineStatus)) {
            // Verificar se o relé está ligado (indicando uso real)
            if (status.relayStatus != null) {
                String relayKey = "relay_" + status.relayPin;
                String relayState = status.relayStatus.optString(relayKey, "off");
                if ("on".equals(relayState)) {
                    return "running"; // Relé ligado = máquina em uso
                }
            }
            return "available";
        }
        
        return "offline";
    }
    
    public static class MachineStatus {
        public String machineId;
        public String machineName;
        public String machineType;
        public String machineStatus;
        public String esp32Id;
        public int relayPin;
        public boolean esp32Online;
        public String computedStatus;
        public JSONObject relayStatus;
        
        public boolean isAvailable() {
            return "available".equals(computedStatus);
        }
        
        public boolean isRunning() {
            return "running".equals(computedStatus);
        }
        
        public boolean isOffline() {
            return "offline".equals(computedStatus);
        }
        
        public boolean isMaintenance() {
            return "maintenance".equals(computedStatus);
        }
    }
}
