package app.lovable.toplavanderia;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.provider.Settings;
import android.util.Log;

import java.net.HttpURLConnection;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Terminais Cielo com relógio desajustado falham em HTTPS (Supabase) e em pagamentos (-4061 WS).
 */
final class DeviceClockGuard {
    private static final String TAG = "DeviceClockGuard";
    private static final long WARN_SKEW_MS = 60 * 60 * 1000L; // 1 h
    private static final AtomicBoolean warnedThisSession = new AtomicBoolean(false);

    private DeviceClockGuard() {}

    static void checkAsync(Activity activity) {
        if (!CieloSslWorkaround.isCieloTerminal() || activity == null || activity.isFinishing()) {
            return;
        }
        new Thread(() -> {
            long serverMs = fetchHttpDateMs();
            if (serverMs <= 0) {
                return;
            }
            long skewMs = Math.abs(System.currentTimeMillis() - serverMs);
            if (skewMs < WARN_SKEW_MS) {
                return;
            }
            if (!warnedThisSession.compareAndSet(false, true)) {
                return;
            }
            Log.w(TAG, "Relógio do terminal desajustado: skew=" + (skewMs / 1000) + "s");
            activity.runOnUiThread(() -> showClockDialog(activity, skewMs));
        }).start();
    }

    private static long fetchHttpDateMs() {
        HttpURLConnection conn = null;
        try {
            conn = SupabaseConfig.openConnection(SupabaseConfig.SUPABASE_URL + "/rest/v1/");
            conn.setRequestMethod("HEAD");
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.connect();
            String dateHeader = conn.getHeaderField("Date");
            if (dateHeader == null || dateHeader.isEmpty()) {
                return -1;
            }
            SimpleDateFormat fmt = new SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss zzz", Locale.US);
            fmt.setTimeZone(TimeZone.getTimeZone("GMT"));
            Date parsed = fmt.parse(dateHeader);
            return parsed != null ? parsed.getTime() : -1;
        } catch (ParseException e) {
            Log.w(TAG, "Falha ao parsear Date HTTP", e);
            return -1;
        } catch (Exception e) {
            Log.w(TAG, "Falha ao obter Date HTTP", e);
            return -1;
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    private static void showClockDialog(Activity activity, long skewMs) {
        if (activity.isFinishing()) {
            return;
        }
        long hours = skewMs / (60 * 60 * 1000);
        new AlertDialog.Builder(activity)
                .setTitle("Data/hora do terminal incorreta")
                .setMessage(
                        "O relógio desta maquininha está cerca de " + hours + " h desajustado.\n\n"
                                + "Isso impede pagamentos Cielo (erro -4061) e a conexão com o sistema.\n\n"
                                + "Abra Configurações → Data e hora e ative "
                                + "\"Usar data e hora fornecidas pela rede\".")
                .setPositiveButton("Abrir configurações", (d, w) -> {
                    try {
                        activity.startActivity(new Intent(Settings.ACTION_DATE_SETTINGS));
                    } catch (Exception e) {
                        Log.w(TAG, "Não foi possível abrir data/hora", e);
                    }
                })
                .setNegativeButton("Depois", null)
                .setCancelable(true)
                .show();
    }
}
