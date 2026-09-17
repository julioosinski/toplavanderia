package app.lovable.toplavanderia;

import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * Recoloca o totem em primeiro plano (boot da LIO, launcher Cielo, atualização do APK).
 * Não compete com CATEGORY_HOME — na Cielo isso abre o seletor de launcher.
 */
public final class TotemAutoLaunch {
    private static final String TAG = "TotemAutoLaunch";

    public static final String EXTRA_RESTORE_HOME = "restore_home";
    public static final String EXTRA_LAUNCH_REASON = "launch_reason";

    private TotemAutoLaunch() {
    }

    public static void bringTotemToFront(Context context, String reason) {
        if (context == null) {
            return;
        }
        if (CieloPaymentSessionHelper.isPaymentWindowOpen(context)) {
            Log.i(TAG, "Não reabre totem — pagamento Cielo em andamento (" + reason + ")");
            return;
        }
        try {
            Intent intent = new Intent(context, TotemActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            intent.putExtra(EXTRA_RESTORE_HOME, true);
            intent.putExtra(EXTRA_LAUNCH_REASON, reason == null ? "unknown" : reason);
            context.startActivity(intent);
            Log.i(TAG, "Totem trazido à frente: " + reason);
        } catch (Throwable t) {
            Log.e(TAG, "Falha ao reabrir TotemActivity (" + reason + ")", t);
        }
    }

    public static boolean isCieloIdleHomePackage(String packageName) {
        if (packageName == null || packageName.isEmpty()) {
            return false;
        }
        if (packageName.startsWith("com.android.launcher")
                || packageName.equals("com.android.launcher3")) {
            return true;
        }
        return packageName.equals("br.com.cielosmart.launcher")
            || packageName.equals("br.com.cielosmart.settings")
            || packageName.equals("br.com.cielosmart.calculator")
            || packageName.equals("cielo.netmanager");
    }

    public static boolean isCieloCheckoutPackage(String packageName) {
        if (packageName == null || packageName.isEmpty()) {
            return false;
        }
        String lower = packageName.toLowerCase();
        return lower.contains("payment")
            || lower.contains("orderservice")
            || lower.contains("uriapp")
            || lower.contains("buzios")
            || lower.contains("transactional")
            || lower.contains("order.manager");
    }
}
