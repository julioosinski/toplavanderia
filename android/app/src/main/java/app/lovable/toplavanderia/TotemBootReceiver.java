package app.lovable.toplavanderia;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

/**
 * Após reboot da LIO o sistema sobe o launcher Cielo, não o totem.
 * Espera a Cielo estabilizar e reabre a grade inicial.
 */
public class TotemBootReceiver extends BroadcastReceiver {
    private static final String TAG = "TotemBootReceiver";
    private static final long DELAY_AFTER_BOOT_MS = 12_000L;
    private static final long DELAY_AFTER_UPDATE_MS = 3_000L;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) {
            return;
        }
        String action = intent.getAction();
        if (action == null) {
            return;
        }
        Log.i(TAG, "Recebido " + action);
        long delay = DELAY_AFTER_BOOT_MS;
        if (Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
                || "android.intent.action.PACKAGE_REPLACED".equals(action)) {
            delay = DELAY_AFTER_UPDATE_MS;
        }
        final Context app = context.getApplicationContext();
        final String reason = action;
        new Handler(Looper.getMainLooper()).postDelayed(
            () -> TotemAutoLaunch.bringTotemToFront(app, reason),
            delay
        );
    }
}
