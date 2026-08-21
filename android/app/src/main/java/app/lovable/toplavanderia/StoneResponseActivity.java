package app.lovable.toplavanderia;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;

/**
 * Recebe callback do Deeplink Stone:
 * toplavanderia-stone://pay-response?...
 * toplavanderia-stone://cancel?...
 */
public class StoneResponseActivity extends Activity {
    private static final String TAG = "StoneResponseActivity";
    public static final String EXTRA_STONE_PAYMENT_RETURN = "stone_payment_return";

    private static String lastHandledSignature = "";
    private static long lastHandledAtMs;

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
            Log.w(TAG, "Intent Stone inválida");
            return;
        }
        Uri uri = intent.getData();
        if (uri == null) {
            Log.w(TAG, "Callback Stone sem URI");
            StoneDeeplinkManager.handleDeepLinkResponse(null);
            return;
        }

        String signature = uri.toString();
        long now = System.currentTimeMillis();
        synchronized (StoneResponseActivity.class) {
            if (!signature.isEmpty()
                    && signature.equals(lastHandledSignature)
                    && (now - lastHandledAtMs) < 8000L) {
                Log.w(TAG, "Callback Stone duplicado ignorado");
                return;
            }
            lastHandledSignature = signature;
            lastHandledAtMs = now;
        }

        Log.d(TAG, "Callback Stone: " + uri);
        StoneDeeplinkManager.handleDeepLinkResponse(uri);

        Intent backToTotem = new Intent(this, TotemActivity.class);
        backToTotem.putExtra(EXTRA_STONE_PAYMENT_RETURN, true);
        backToTotem.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
            | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(backToTotem);
    }
}
