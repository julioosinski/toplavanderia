package app.lovable.toplavanderia;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Política de detecção de ESP32 no totem — manter alinhado a
 * {@code src/lib/machineEsp32Sync.ts} ({@code ESP32_TOTEM_HEARTBEAT_STALE_MS}).
 * Firmware envia heartbeat ~30s; ~42s ≈ um ciclo perdido + margem (totem / maquininha).
 */
public final class Esp32TotemPolicy {
    public static final long HEARTBEAT_STALE_MS = 42_000L;
    /** Intervalo entre polls (Cielo: rede + dois RPCs — manter moderado). */
    public static final int STATUS_POLL_INTERVAL_MS = 2_500;

    /**
     * Se o relógio da maquininha está atrasado, o heartbeat (UTC) parece “no futuro” (ageMs negativo).
     * Skew até este valor tratamos como relógio local errado e consideramos o heartbeat fresco.
     * Acima disso é provável dado inválido / bug (evita “sempre online” de timestamps absurdos).
     */
    private static final long MAX_PLAUSIBLE_CLOCK_SKEW_MS = 900_000L; // 15 min

    private Esp32TotemPolicy() {}

    /**
     * Converte {@code last_heartbeat} do Supabase (timestamptz ISO) para epoch UTC ms.
     * Usa os primeiros 19 caracteres {@code yyyy-MM-dd'T'HH:mm:ss} como instante UTC
     * (alinhado ao que o PostgREST costuma enviar com Z ou +00:00).
     */
    public static long parseHeartbeatToUtcMillis(String raw) {
        if (raw == null) {
            return 0;
        }
        String s = raw.trim();
        if (s.isEmpty() || "null".equalsIgnoreCase(s)) {
            return 0;
        }
        s = s.replace("Z", "");
        int dot = s.indexOf('.');
        if (dot > 0) {
            s = s.substring(0, dot);
        }
        if (s.length() >= 19) {
            s = s.substring(0, 19);
        } else {
            return 0;
        }
        try {
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US);
            sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
            return sdf.parse(s).getTime();
        } catch (Exception e) {
            return 0;
        }
    }

    /**
     * {@code is_online == false} explícito no JSON → offline. Campo ausente → não bloquear (alguns
     * caminhos REST só mandam heartbeat); decisão pelo tempo do heartbeat.
     */
    public static boolean isEsp32Reachable(JSONObject esp32Status) {
        if (esp32Status == null) {
            return false;
        }
        if (esp32Status.has("is_online") && !esp32Status.isNull("is_online")) {
            if (!readBooleanLoose(esp32Status, "is_online")) {
                return false;
            }
        }
        String hb = esp32Status.optString("last_heartbeat", "");
        if (hb.isEmpty() || "null".equalsIgnoreCase(hb.trim())) {
            return false;
        }
        long t = parseHeartbeatToUtcMillis(hb);
        if (t <= 0) {
            return false;
        }
        long now = System.currentTimeMillis();
        long ageMs = now - t;
        if (ageMs < 0) {
            long futureByLocalClock = -ageMs;
            if (futureByLocalClock > MAX_PLAUSIBLE_CLOCK_SKEW_MS) {
                return false;
            }
            ageMs = 0;
        }
        if (t > now + MAX_PLAUSIBLE_CLOCK_SKEW_MS) {
            return false;
        }
        return ageMs <= HEARTBEAT_STALE_MS;
    }

    private static boolean readBooleanLoose(JSONObject o, String key) {
        try {
            return o.getBoolean(key);
        } catch (Exception e) {
            String s = o.optString(key, "");
            return "true".equalsIgnoreCase(s) || "1".equals(s);
        }
    }
}
