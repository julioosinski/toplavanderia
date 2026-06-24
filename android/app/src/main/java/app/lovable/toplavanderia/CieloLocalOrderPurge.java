package app.lovable.toplavanderia;

import android.content.Context;
import android.util.Log;

/**
 * Limpa pedidos ENTERED presos no smart-order-service local.
 * Não usar force-stop — no DX8000 isso quebra deviceKey.pem.crt (hasConnectivity=false, -4281).
 */
final class CieloLocalOrderPurge {
    private static final String TAG = "CieloLocalOrderPurge";
    private static final String ORDER_SERVICE = "br.com.cielosmart.orderservice";
    private static long lastPurgeAtMs;

    private CieloLocalOrderPurge() {
    }

    /** Limpa fila local (pedidos ENTERED presos). Cooldown curto entre tentativas no mesmo checkout. */
    static void clearStuckLocalOrders(Context context) {
        clearStuckLocalOrders(context, 8_000L);
    }

    static void clearStuckLocalOrders(Context context, long cooldownMs) {
        long now = System.currentTimeMillis();
        if (now - lastPurgeAtMs < cooldownMs) {
            return;
        }
        lastPurgeAtMs = now;
        Log.w(TAG, "Limpando fila local Cielo (" + ORDER_SERVICE + ")");
        int exit = runShell("pm clear " + ORDER_SERVICE);
        if (exit != 0) {
            exit = runShell("cmd package clear --user 0 " + ORDER_SERVICE);
        }
        try {
            Thread.sleep(exit == 0 ? 2000L : 800L);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        Log.w(TAG, "Limpeza local concluída exit=" + exit
            + (exit != 0 ? " (requer limpeza manual: Config → Apps → Order Service → Limpar dados)" : ""));
    }

    private static int runShell(String command) {
        try {
            Process process = Runtime.getRuntime().exec(new String[] { "sh", "-c", command });
            return process.waitFor();
        } catch (Exception e) {
            Log.w(TAG, "Comando indisponível: " + command, e);
            return -1;
        }
    }
}
