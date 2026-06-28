package app.lovable.toplavanderia;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.util.Log;

/**
 * Escuta broadcasts Buzios (pagamento aprovado). A UI não aparece na a11y — só broadcast.
 */
public class CieloPaymentBroadcastReceiver extends BroadcastReceiver {
    private static final String TAG = "CieloPayBroadcast";
    private static volatile CieloPaymentBroadcastReceiver registered;

    private CieloPaymentBroadcastReceiver() {
    }

    public static synchronized void register(Context context) {
        if (context == null || registered != null) {
            return;
        }
        Context app = context.getApplicationContext();
        CieloPaymentBroadcastReceiver receiver = new CieloPaymentBroadcastReceiver();
        IntentFilter filter = new IntentFilter();
        filter.addAction("cielo.payment.success");
        filter.addAction("cielo.payment.partial");
        filter.addAction("cielo.payment.approved");
        filter.setPriority(IntentFilter.SYSTEM_HIGH_PRIORITY);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                app.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED);
            } else {
                app.registerReceiver(receiver, filter);
            }
            registered = receiver;
            Log.i(TAG, "Receiver Cielo registrado");
        } catch (Exception e) {
            Log.e(TAG, "Falha ao registrar receiver", e);
            registered = null;
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || context == null) {
            return;
        }
        String action = intent.getAction();
        if (action == null) {
            return;
        }
        if (!CieloPaymentSessionHelper.isPaymentWindowOpen(context)) {
            Log.d(TAG, "Broadcast ignorado (fora da janela de pagamento): " + action);
            return;
        }
        String payload = extractPayload(intent);
        if (!looksLikeApprovedPayload(payload)) {
            if ("cielo.payment.partial".equals(action)) {
                Log.d(TAG, "Broadcast parcial (sem aprovação ainda)");
            } else {
                Log.d(TAG, "Broadcast ignorado (sem payload aprovado): " + action);
            }
            return;
        }
        Log.i(TAG, "Broadcast aprovado: " + action);
        CieloPrintDismissScheduler.onApprovedDetected(context, "broadcast:" + action);
    }

    private static String extractPayload(Intent intent) {
        String data = intent.getStringExtra("data");
        if (data != null && !data.isEmpty()) {
            return data;
        }
        if (intent.getExtras() != null) {
            StringBuilder sb = new StringBuilder();
            for (String key : intent.getExtras().keySet()) {
                Object value = intent.getExtras().get(key);
                if (value != null) {
                    if (sb.length() > 0) {
                        sb.append(' ');
                    }
                    sb.append(value);
                }
            }
            return sb.toString();
        }
        return "";
    }

    private static boolean looksLikeApprovedPayload(String payload) {
        if (payload == null || payload.isEmpty()) {
            return false;
        }
        String lower = payload.toLowerCase();
        return lower.contains("aprovada")
            || lower.contains("\"responsecode\":\"000\"")
            || lower.contains("responsecode=000");
    }
}
