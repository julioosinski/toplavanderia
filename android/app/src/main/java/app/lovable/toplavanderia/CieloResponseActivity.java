package app.lovable.toplavanderia;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;

/**
 * Receives callback intent from Cielo Deep Link integration:
 * order://response?response=...&responsecode=...
 */
public class CieloResponseActivity extends Activity {
    private static final String TAG = "CieloResponseActivity";
    private static String lastHandledIntentSignature;
    private static long lastHandledIntentAtMs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleIntent(getIntent());
        finish();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
        finish();
    }

    private void handleIntent(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) {
            Log.w(TAG, "Intent de callback invalida");
            return;
        }

        Uri uri = intent.getData();
        if (uri == null) {
            Log.w(TAG, "Callback Cielo sem URI");
            CieloLioManager.handleDeepLinkResponse(null);
            return;
        }

        String signature = buildCallbackSignature(uri);
        long now = System.currentTimeMillis();
        synchronized (CieloResponseActivity.class) {
            if (!signature.isEmpty()
                    && signature.equals(lastHandledIntentSignature)
                    && (now - lastHandledIntentAtMs) < 8000L) {
                Log.w(TAG, "Intent de callback duplicado ignorado");
                return;
            }
            lastHandledIntentSignature = signature;
            lastHandledIntentAtMs = now;
        }

        Log.d(TAG, "Callback Cielo recebido: scheme=" + uri.getScheme()
                + " host=" + uri.getHost()
                + " responsecode=" + uri.getQueryParameter("responsecode"));
        CieloLioManager.handleDeepLinkResponse(uri);

        Intent backToTotem = new Intent(this, TotemActivity.class);
        backToTotem.putExtra(TotemActivity.EXTRA_CIELO_PAYMENT_RETURN, true);
        backToTotem.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
            | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(backToTotem);
    }

    private static String buildCallbackSignature(Uri uri) {
        if (uri == null) {
            return "";
        }
        String response = uri.getQueryParameter("response");
        String responseCode = uri.getQueryParameter("responsecode");
        return (responseCode == null ? "" : responseCode) + "|" + (response == null ? "" : response);
    }
}
