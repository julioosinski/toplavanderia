package app.lovable.toplavanderia;

import android.annotation.SuppressLint;
import android.content.Context;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Envia o sinal de vida do totem ao Supabase a cada minuto, inclusive com o app Cielo em
 * primeiro plano. O painel alerta quando o sinal some (ver TOTEM_HEARTBEAT_STALE_MS no web).
 */
final class TotemHeartbeat {
    private static final String TAG = "TotemHeartbeat";
    private static final long INTERVAL_SECONDS = 60L;

    interface StateProvider {
        String currentScreen();
        boolean paymentInProgress();
    }

    private final SupabaseHelper supabaseHelper;
    private final StateProvider stateProvider;
    private final String deviceId;
    private final String deviceModel;
    private ScheduledExecutorService executor;

    TotemHeartbeat(Context context, SupabaseHelper supabaseHelper, StateProvider stateProvider) {
        this.supabaseHelper = supabaseHelper;
        this.stateProvider = stateProvider;
        this.deviceId = resolveDeviceId(context);
        this.deviceModel = (Build.MANUFACTURER + " " + Build.MODEL).trim();
    }

    synchronized void start() {
        if (executor != null) {
            return;
        }
        executor = Executors.newSingleThreadScheduledExecutor();
        executor.scheduleWithFixedDelay(this::beat, 0L, INTERVAL_SECONDS, TimeUnit.SECONDS);
    }

    synchronized void stop() {
        if (executor != null) {
            executor.shutdownNow();
            executor = null;
        }
    }

    private void beat() {
        try {
            supabaseHelper.sendTotemHeartbeat(
                deviceId,
                BuildConfig.VERSION_NAME,
                deviceModel,
                stateProvider.currentScreen(),
                stateProvider.paymentInProgress()
            );
        } catch (Throwable t) {
            // Uma exceção não tratada cancelaria o agendamento do executor.
            Log.w(TAG, "Falha ao enviar heartbeat", t);
        }
    }

    @SuppressLint("HardwareIds")
    private static String resolveDeviceId(Context context) {
        String androidId = null;
        try {
            androidId = Settings.Secure.getString(context.getContentResolver(), Settings.Secure.ANDROID_ID);
        } catch (Throwable ignored) {
        }
        String sanitized = androidId == null ? "" : androidId.replaceAll("[^A-Za-z0-9._:-]", "");
        return sanitized.isEmpty() ? "totem-unknown" : sanitized;
    }
}
