package app.lovable.toplavanderia;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

/**
 * Toques em "Não imprimir" somente após confirmação explícita de tela aprovada
 * (broadcast Cielo com payload, deep link de sucesso ou detecção a11y).
 */
public final class CieloPrintDismissScheduler {
    private static final String TAG = "CieloPrintDismiss";
    private static final long[] BURST_DELAYS_MS = {0L, 700L, 1500L, 2800L, 4500L};

    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static int tapGeneration = 0;
    private static volatile boolean dismissSucceeded = false;

    private CieloPrintDismissScheduler() {
    }

    public static void onApprovedDetected(Context context, String source) {
        if (context == null || dismissSucceeded) {
            return;
        }
        Context app = context.getApplicationContext();
        if (!CieloPaymentSessionHelper.hasActiveSession(app)) {
            Log.d(TAG, "Aprovação ignorada (sem sessão): " + source);
            return;
        }
        CieloPaymentSessionHelper.markApprovedScreenConfirmed(app);
        Log.i(TAG, "Tela aprovada (" + source + ")");
        beginNoPrintTapBurst(app);
    }

    public static void beginNoPrintTapBurst(Context context) {
        if (context == null || dismissSucceeded) {
            return;
        }
        Context app = context.getApplicationContext();
        if (!CieloPaymentSessionHelper.isApprovedScreenConfirmed(app)) {
            Log.w(TAG, "Burst ignorado — tela aprovada não confirmada");
            return;
        }
        synchronized (CieloPrintDismissScheduler.class) {
            tapGeneration++;
            final int runId = tapGeneration;
            Log.i(TAG, "Burst Não imprimir (run=" + runId + ")");
            for (long delay : BURST_DELAYS_MS) {
                MAIN.postDelayed(() -> fireTap(runId, app), delay);
            }
        }
    }

    public static void markDismissSucceeded() {
        dismissSucceeded = true;
        cancel();
        Log.i(TAG, "Não imprimir OK");
    }

    public static void reset() {
        dismissSucceeded = false;
        cancel();
    }

    public static void cancel() {
        synchronized (CieloPrintDismissScheduler.class) {
            tapGeneration++;
        }
    }

    private static void fireTap(int runId, Context app) {
        if (dismissSucceeded) {
            return;
        }
        synchronized (CieloPrintDismissScheduler.class) {
            if (runId != tapGeneration) {
                return;
            }
        }
        if (!CieloPaymentSessionHelper.hasActiveSession(app)
                || !CieloPaymentSessionHelper.isApprovedScreenConfirmed(app)) {
            return;
        }
        fireTapOnce(app);
    }

    private static void fireTapOnce(Context app) {
        CieloPaymentOverlayService.hideForTap(app);
        boolean treeClicked = CieloReceiptAccessibilityService.tryDismissPrintViaTreeSync();
        if (treeClicked) {
            markDismissSucceeded();
            return;
        }
        boolean sent = CieloReceiptAccessibilityService.tapNoPrintButtonBurst();
        Log.i(TAG, "Toque coordenado: " + (sent ? "enviado" : "off"));
    }
}
