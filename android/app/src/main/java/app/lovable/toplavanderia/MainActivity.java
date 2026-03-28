package app.lovable.toplavanderia;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.util.Log;

import com.getcapacitor.BridgeActivity;

/**
 * MainActivity - Capacitor BridgeActivity
 * 
 * Loads the React/Capacitor WebView and registers native plugins
 * (PayGO, USB, TEF) so the React UI can communicate with PPC930.
 * 
 * Replaces TotemActivity as launcher. Keeps kiosk-mode flags and
 * USB intent handling via AndroidManifest meta-data.
 */
public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Register custom Capacitor plugins BEFORE super.onCreate
        registerPlugin(PayGOPlugin.class);
        registerPlugin(USBPlugin.class);
        registerPlugin(TEFPlugin.class);

        super.onCreate(savedInstanceState);

        applyKioskWindowFlags();

        Log.d(TAG, "✅ MainActivity (BridgeActivity) created with PayGO, USB, TEF plugins");
    }

    /**
     * Ao plugar o pinpad USB, o sistema dispara USB_DEVICE_ATTACHED e pode chamar
     * onNewIntent/onResume. Reaplica flags para não perder "tela sempre ligada".
     * Se a tela apagar ao conectar o leitor, também avalie alimentação USB (hub com fonte).
     */
    @Override
    public void onResume() {
        super.onResume();
        applyKioskWindowFlags();
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        applyKioskWindowFlags();
    }

    private void applyKioskWindowFlags() {
        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_FULLSCREEN |
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        );

        View decorView = getWindow().getDecorView();
        decorView.setKeepScreenOn(true);
        decorView.setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY |
            View.SYSTEM_UI_FLAG_FULLSCREEN |
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        );
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applyKioskWindowFlags();
        }
    }
}
