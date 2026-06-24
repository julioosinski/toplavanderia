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
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * MONITOR DE STATUS DAS MÁQUINAS EM TEMPO REAL
 *
 * Polling alinhado ao web (machineEsp32Sync.computeMachineStatus): relé no ESP32 é a autoridade.
 * Usa RPCs publicas controladas para respeitar RLS no modo totem anonimo.
 */
public class MachineStatusMonitor {
    private static final String TAG = "MachineStatusMonitor";

    private static final int DEFAULT_RELAY_LOGICAL_PIN = 1;
    private static final int DEFAULT_CYCLE_MINUTES = 40;

    private static final String SUPABASE_URL = SupabaseConfig.SUPABASE_URL;

    private Handler handler;
    private Runnable pollRunnable;
    private SupabaseHelper supabaseHelper;
    private StatusUpdateListener listener;
    private boolean isRunning = false;
    private final AtomicBoolean fetchInFlight = new AtomicBoolean(false);

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
                fetchMachineStatuses();
                handler.postDelayed(this, Esp32TotemPolicy.STATUS_POLL_INTERVAL_MS);
            }
        };

        handler.post(pollRunnable);
    }

    /**
     * Força uma leitura imediata (ex.: ao voltar do app Cielo). Ignora se já houver fetch em andamento.
     */
    public void requestImmediatePoll() {
        fetchMachineStatuses();
    }

    public void stopMonitoring() {
        isRunning = false;
        if (pollRunnable != null) {
            handler.removeCallbacks(pollRunnable);
        }
        Log.d(TAG, "⏹️ Monitoramento de status parado");
    }

    private void fetchMachineStatuses() {
        if (!fetchInFlight.compareAndSet(false, true)) {
            return;
        }
        new Thread(() -> {
            try {
                String laundryId = supabaseHelper.getLaundryId();
                if (laundryId == null) {
                    Log.w(TAG, "Lavanderia não configurada - pulando monitoramento");
                    return;
                }

                // Paralelizar RPCs — na maquininha Cielo a rede costuma ser lenta; sequencial dobrou o tempo.
                final JSONArray[] machinesBox = new JSONArray[1];
                final JSONArray[] esp32Box = new JSONArray[1];
                Thread tMachines = new Thread(() -> machinesBox[0] = fetchPublicMachines(laundryId), "totem-machines-rpc");
                Thread tEsp32 = new Thread(() -> esp32Box[0] = fetchEsp32StatusesForLaundry(laundryId), "totem-esp32-rpc");
                tMachines.start();
                tEsp32.start();
                tMachines.join(12_000);
                tEsp32.join(12_000);

                JSONArray machinesArray = machinesBox[0];
                JSONArray esp32Array = esp32Box[0];

                if (machinesArray == null) {
                    Log.w(TAG, "Erro ao buscar máquinas");
                    return;
                }

                java.util.Map<String, JSONObject> esp32Map = new java.util.HashMap<>();
                if (esp32Array != null) {
                    for (int i = 0; i < esp32Array.length(); i++) {
                        JSONObject esp32 = esp32Array.getJSONObject(i);
                        esp32Map.put(esp32.getString("esp32_id"), esp32);
                    }
                }
                Esp32TotemPolicy.retainHeartbeatAnchors(esp32Map.keySet());

                List<MachineStatus> statuses = new ArrayList<>();
                for (int i = 0; i < machinesArray.length(); i++) {
                    JSONObject machine = machinesArray.getJSONObject(i);

                    MachineStatus status = new MachineStatus();
                    status.machineId = machine.getString("id");
                    status.machineName = machine.getString("name");
                    status.machineType = machine.getString("type");
                    status.machineStatus = machine.optString("status", "available");
                    status.machineUpdatedAt = machine.optString("updated_at", null);
                    status.cycleTimeMinutes = machine.optInt("cycle_time_minutes", DEFAULT_CYCLE_MINUTES);
                    if (status.cycleTimeMinutes <= 0) {
                        status.cycleTimeMinutes = DEFAULT_CYCLE_MINUTES;
                    }
                    status.pricePerCycle = machine.optDouble("price_per_cycle", 0);
                    status.capacityKg = machine.optDouble("capacity_kg", 0);
                    status.esp32Id = machine.optString("esp32_id", "");
                    status.relayPin = resolvedRelayPin(machine.optInt("relay_pin", 0));

                    JSONObject esp32Status = esp32Map.get(status.esp32Id);
                    if (esp32Status != null) {
                        status.esp32Online = isEsp32Reachable(esp32Status);
                        Object rs = esp32Status.opt("relay_status");
                        status.relayStatus = rs instanceof JSONObject ? (JSONObject) rs : null;
                        status.relayStatusRaw = rs instanceof String ? (String) rs : null;
                    } else {
                        status.esp32Online = false;
                        status.relayStatus = null;
                        status.relayStatusRaw = null;
                    }

                    status.computedStatus = computeMachineStatus(status);
                    statuses.add(status);
                }

                if (listener != null) {
                    handler.post(() -> listener.onStatusUpdate(statuses));
                }

            } catch (Exception e) {
                Log.e(TAG, "Erro ao buscar status", e);
            } finally {
                fetchInFlight.set(false);
            }
        }).start();
    }

    private JSONArray fetchEsp32StatusesForLaundry(String laundryId) {
        try {
            return fetchEsp32ViaRpc(laundryId);
        } catch (Exception e) {
            Log.e(TAG, "fetchEsp32StatusesForLaundry", e);
            return fetchEsp32ViaRpc(laundryId);
        }
    }

    private JSONArray fetchEsp32ViaRpc(String laundryId) {
        HttpURLConnection connection = null;
        try {
            URL url = new URL(SUPABASE_URL + "/rest/v1/rpc/get_esp32_heartbeats");
            connection = SupabaseConfig.openConnection(url);
            connection.setRequestMethod("POST");
            SupabaseConfig.applyJsonHeaders(connection);
            connection.setDoOutput(true);
            connection.setConnectTimeout(6000);
            connection.setReadTimeout(6000);

            JSONObject body = new JSONObject();
            body.put("_laundry_id", laundryId);

            OutputStream os = connection.getOutputStream();
            os.write(body.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            os.close();

            int code = connection.getResponseCode();
            if (code != 200) {
                Log.w(TAG, "RPC get_esp32_heartbeats HTTP " + code);
                return new JSONArray();
            }

            BufferedReader br = new BufferedReader(new InputStreamReader(connection.getInputStream()));
            StringBuilder response = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) {
                response.append(line);
            }
            br.close();
            return new JSONArray(response.toString());
        } catch (Exception e) {
            Log.e(TAG, "fetchEsp32ViaRpc", e);
            return new JSONArray();
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private JSONArray fetchPublicMachines(String laundryId) {
        try {
            HttpURLConnection connection = SupabaseConfig.openConnection(SUPABASE_URL + "/rest/v1/rpc/get_public_machines");
            connection.setRequestMethod("POST");
            SupabaseConfig.applyJsonHeaders(connection);
            connection.setDoOutput(true);
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);

            JSONObject body = new JSONObject();
            body.put("_laundry_id", laundryId);
            OutputStream os = connection.getOutputStream();
            os.write(body.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            os.close();

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
            Log.e(TAG, "Erro ao buscar maquinas publicas", e);
            return null;
        }
    }

    private static int resolvedRelayPin(int fromDb) {
        return fromDb > 0 ? fromDb : DEFAULT_RELAY_LOGICAL_PIN;
    }

    private boolean isEsp32Reachable(JSONObject esp32Status) {
        try {
            return Esp32TotemPolicy.isEsp32Reachable(esp32Status);
        } catch (Exception e) {
            Log.e(TAG, "Erro ao verificar reachability ESP32", e);
            return false;
        }
    }

    private boolean isRelayOn(JSONObject relayJson, String relayRaw, int pin) {
        if (relayRaw != null && !relayRaw.isEmpty()) {
            return "on".equalsIgnoreCase(relayRaw.trim());
        }
        if (relayJson == null) {
            return false;
        }
        String key = "relay_" + pin;
        if (relayJson.has(key)) {
            Object v = relayJson.opt(key);
            if (v instanceof Boolean) {
                return Boolean.TRUE.equals(v);
            }
            if (v instanceof Number) {
                return ((Number) v).intValue() == 1;
            }
            String s = String.valueOf(v);
            return "on".equalsIgnoreCase(s) || "true".equalsIgnoreCase(s);
        }
        JSONObject nested = relayJson.optJSONObject("status");
        if (nested != null && nested.has(key)) {
            return "on".equalsIgnoreCase(nested.optString(key, ""));
        }
        return false;
    }

    /** Mesma prioridade que computeMachineStatus no frontend (relé + manutenção + ciclo). */
    private static boolean dbSaysRunning(String s) {
        return "running".equals(s) || "in_use".equals(s);
    }

    private String computeMachineStatus(MachineStatus st) {
        if ("maintenance".equals(st.machineStatus)) {
            return "maintenance";
        }

        if (st.esp32Id == null || st.esp32Id.isEmpty()) {
            if (dbSaysRunning(st.machineStatus)) {
                return "running";
            }
            if ("offline".equals(st.machineStatus)) {
                return "offline";
            }
            return "available";
        }

        boolean reachable = st.esp32Online;
        boolean relayOn = isRelayOn(st.relayStatus, st.relayStatusRaw, st.relayPin);

        if (!reachable) {
            if (dbSaysRunning(st.machineStatus) && st.machineUpdatedAt != null && !st.machineUpdatedAt.isEmpty()) {
                long elapsedMin = elapsedMinutesSince(st.machineUpdatedAt);
                int cycle = st.cycleTimeMinutes > 0 ? st.cycleTimeMinutes : DEFAULT_CYCLE_MINUTES;
                if (elapsedMin >= 0 && elapsedMin < cycle) {
                    return "running";
                }
            }
            return "offline";
        }

        if (relayOn) {
            return "running";
        }

        if (dbSaysRunning(st.machineStatus) && st.machineUpdatedAt != null && !st.machineUpdatedAt.isEmpty()) {
            long elapsedMin = elapsedMinutesSince(st.machineUpdatedAt);
            int cycle = st.cycleTimeMinutes > 0 ? st.cycleTimeMinutes : DEFAULT_CYCLE_MINUTES;
            if (elapsedMin >= 0 && elapsedMin < cycle) {
                return "running";
            }
        }

        return "available";
    }

    private long elapsedMinutesSince(String isoUpdatedAt) {
        try {
            long t = Esp32TotemPolicy.parseHeartbeatToUtcMillis(isoUpdatedAt);
            if (t <= 0) {
                return -1;
            }
            return (System.currentTimeMillis() - t) / 60000;
        } catch (Exception e) {
            return -1;
        }
    }

    public static class MachineStatus {
        public String machineId;
        public String machineName;
        public String machineType;
        public String machineStatus;
        public String machineUpdatedAt;
        public int cycleTimeMinutes;
        public double pricePerCycle;
        public double capacityKg;
        public String esp32Id;
        public int relayPin;
        public boolean esp32Online;
        public String computedStatus;
        public JSONObject relayStatus;
        public String relayStatusRaw;

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
