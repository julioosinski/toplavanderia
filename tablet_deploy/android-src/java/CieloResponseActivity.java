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

        Log.d(TAG, "Callback Cielo recebido: scheme=" + uri.getScheme()
                + " host=" + uri.getHost()
                + " responsecode=" + uri.getQueryParameter("responsecode"));
        CieloLioManager.handleDeepLinkResponse(uri);
    }
}
