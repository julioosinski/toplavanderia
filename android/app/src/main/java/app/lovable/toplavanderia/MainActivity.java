package app.lovable.toplavanderia;

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

        // Kiosk-mode: fullscreen, keep screen on
        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        );

        View decorView = getWindow().getDecorView();
        decorView.setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY |
            View.SYSTEM_UI_FLAG_FULLSCREEN |
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        );

        Log.d(TAG, "✅ MainActivity (BridgeActivity) created with PayGO, USB, TEF plugins");
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            View decorView = getWindow().getDecorView();
            decorView.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY |
                View.SYSTEM_UI_FLAG_FULLSCREEN |
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            );
        }
    }
}
