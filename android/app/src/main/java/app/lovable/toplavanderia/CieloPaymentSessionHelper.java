package app.lovable.toplavanderia;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;

/** Estado da sessão de pagamento Cielo (tarja 10s + toque Não imprimir). */
public final class CieloPaymentSessionHelper {
    private static final String PREFS = "cielo_pay_session";
    private static final String KEY_SESSION_ID = "session_id";
    private static final String KEY_PAYMENT_CODE = "payment_code";
    private static final String KEY_SHIELD_ENABLED = "shield_enabled";
    private static final String KEY_SESSION_STARTED_AT = "session_started_at";
    private static final String KEY_OVERLAY_SHOWN_AT = "overlay_shown_at";
    private static final String KEY_APPROVED_SCREEN_CONFIRMED = "approved_screen_confirmed";

    private static int nextSessionId = 0;

    private CieloPaymentSessionHelper() {
    }

    public static int beginSession(Context context, String paymentCode) {
        if (context == null) {
            return 0;
        }
        int sessionId = ++nextSessionId;
        String code = paymentCode == null ? "" : paymentCode.trim();
        // Tarja/escudo para cartão (crédito + débito). PIX usa fluxo de "Não imprimir".
        boolean shieldEnabled = !"PIX".equalsIgnoreCase(code);
        prefs(context).edit()
            .putInt(KEY_SESSION_ID, sessionId)
            .putString(KEY_PAYMENT_CODE, code)
            .putBoolean(KEY_SHIELD_ENABLED, shieldEnabled)
            .putLong(KEY_SESSION_STARTED_AT, System.currentTimeMillis())
            .putLong(KEY_OVERLAY_SHOWN_AT, 0L)
            .putBoolean(KEY_APPROVED_SCREEN_CONFIRMED, false)
            .commit();
        CieloLioManager.cancelScheduledEndSession();
        CieloPrintDismissScheduler.cancel();
        CieloReceiptAccessibilityService.resetApprovedHandling();
        CieloReceiptAccessibilityService.onPaymentSessionStarted();
        return sessionId;
    }

    public static int getSessionId(Context context) {
        if (context == null) {
            return 0;
        }
        return prefs(context).getInt(KEY_SESSION_ID, 0);
    }

    public static boolean isSessionActive(Context context, int sessionId) {
        return sessionId > 0
            && hasActiveSession(context)
            && getSessionId(context) == sessionId;
    }

    /** Tarja ou pagamento recente — para broadcast Cielo. */
    public static boolean isPaymentWindowOpen(Context context) {
        if (context == null) {
            return false;
        }
        if (hasActiveSession(context)) {
            return true;
        }
        // Janela residual curta após fim de sessão (callbacks tardios).
        long started = prefs(context).getLong(KEY_SESSION_STARTED_AT, 0L);
        return started > 0L && System.currentTimeMillis() - started < 15_000L;
    }

    public static void dismissCardShield(Context context) {
        CieloPaymentShieldOverlay.clearAll();
        if (context == null) {
            return;
        }
        setShieldEnabled(context, false);
    }

    public static void setShieldEnabled(Context context, boolean enabled) {
        if (context == null) {
            return;
        }
        prefs(context).edit().putBoolean(KEY_SHIELD_ENABLED, enabled).commit();
    }

    public static boolean isCardShieldEnabled(Context context) {
        return prefs(context).getBoolean(KEY_SHIELD_ENABLED, false);
    }

    public static void markOverlayShown(Context context) {
        if (context == null) {
            return;
        }
        prefs(context).edit().putLong(KEY_OVERLAY_SHOWN_AT, System.currentTimeMillis()).commit();
    }

    public static long getOverlayShownAt(Context context) {
        if (context == null) {
            return 0L;
        }
        return prefs(context).getLong(KEY_OVERLAY_SHOWN_AT, 0L);
    }

    public static void markApprovedScreenConfirmed(Context context) {
        if (context == null) {
            return;
        }
        prefs(context).edit().putBoolean(KEY_APPROVED_SCREEN_CONFIRMED, true).commit();
    }

    public static boolean isApprovedScreenConfirmed(Context context) {
        if (context == null) {
            return false;
        }
        return prefs(context).getBoolean(KEY_APPROVED_SCREEN_CONFIRMED, false);
    }

    public static void endSession(Context context) {
        if (context == null) {
            return;
        }
        Context app = context.getApplicationContext();
        // Limpa overlay + prefs imediatamente. O delay de 5s deixava payment_code ativo
        // e a acessibilidade podia recriar a tarja; o timer de 10s depois falhava em
        // removê-la (sessionId != atual) e a home do totem ficava travada.
        CieloPaymentShieldOverlay.clearAll();
        CieloPrintDismissScheduler.cancel();
        try {
            prefs(app).edit().clear().commit();
        } catch (Throwable ignored) {
            // noop
        }
        new Handler(Looper.getMainLooper()).post(() -> {
            CieloPaymentShieldOverlay.clearAll();
            CieloReceiptAccessibilityService.resetApprovedHandling();
        });
    }

    /** Escape hatch: limpa sessão + tarja quando a home do totem está bloqueada. */
    public static void forceClearStuckUi(Context context) {
        if (context == null) {
            return;
        }
        Context app = context.getApplicationContext();
        try {
            prefs(app).edit().clear().commit();
        } catch (Throwable ignored) {
            // noop
        }
        CieloPrintDismissScheduler.cancel();
        CieloPaymentShieldOverlay.clearAll();
        new Handler(Looper.getMainLooper()).post(CieloPaymentShieldOverlay::clearAll);
    }

    public static boolean hasActiveSession(Context context) {
        if (context == null) {
            return false;
        }
        return !prefs(context).getString(KEY_PAYMENT_CODE, "").isEmpty();
    }

    public static long getSessionElapsedMs(Context context) {
        if (context == null) {
            return 0L;
        }
        long startedAt = prefs(context).getLong(KEY_SESSION_STARTED_AT, 0L);
        if (startedAt <= 0L) {
            return 0L;
        }
        return Math.max(0L, System.currentTimeMillis() - startedAt);
    }

    public static boolean shouldBlockAlternateCapture(Context context) {
        if (context == null) {
            return false;
        }
        String code = getPaymentCode(context);
        if (code.isEmpty()) {
            return false;
        }
        return !"PIX".equalsIgnoreCase(code);
    }

    /** Tarja inferior "Insira ou aproxime o cartão" — pagamentos com cartão. */
    public static boolean shouldShowBottomTarja(Context context) {
        return shouldBlockAlternateCapture(context);
    }

    public static boolean isDebitPayment(Context context) {
        if (context == null) {
            return false;
        }
        return "DEBITO_AVISTA".equalsIgnoreCase(getPaymentCode(context));
    }

    public static boolean isPixPayment(Context context) {
        if (context == null) {
            return false;
        }
        return "PIX".equalsIgnoreCase(getPaymentCode(context));
    }

    public static boolean isCreditPayment(Context context) {
        if (context == null) {
            return false;
        }
        return "CREDITO_AVISTA".equalsIgnoreCase(getPaymentCode(context));
    }

    public static String getPaymentCode(Context context) {
        if (context == null) {
            return "";
        }
        return prefs(context).getString(KEY_PAYMENT_CODE, "");
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
