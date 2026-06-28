package app.lovable.toplavanderia;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * Estado da sessão de pagamento Cielo (cartão vs PIX) para o serviço de acessibilidade.
 */
public final class CieloPaymentSessionHelper {
    private static final String PREFS = "cielo_pay_session";
    private static final String KEY_PAYMENT_CODE = "payment_code";

    private CieloPaymentSessionHelper() {
    }

    public static void beginSession(Context context, String paymentCode) {
        if (context == null) {
            return;
        }
        prefs(context).edit()
            .putString(KEY_PAYMENT_CODE, paymentCode == null ? "" : paymentCode.trim())
            .commit();
    }

    public static void endSession(Context context) {
        CieloPaymentShieldOverlay.clear();
        CieloPaymentOverlayService.stop(context);
        if (context == null) {
            return;
        }
        prefs(context).edit().clear().commit();
    }

    /** Bloqueia QR / digitar cartão quando o totem pediu crédito ou débito (não PIX). */
    public static boolean shouldBlockAlternateCapture(Context context) {
        String code = prefs(context).getString(KEY_PAYMENT_CODE, "");
        if (code.isEmpty()) {
            return false;
        }
        return !"PIX".equalsIgnoreCase(code);
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
