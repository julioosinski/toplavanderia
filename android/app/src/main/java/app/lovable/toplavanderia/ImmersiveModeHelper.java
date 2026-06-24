package app.lovable.toplavanderia;

import android.app.Activity;
import android.os.Build;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;

/**
 * Oculta barra de status e botões de navegação do terminal enquanto o totem está em uso.
 * Reaplica automaticamente se o usuário deslizar na borda (comportamento kiosk).
 */
final class ImmersiveModeHelper {
    private static final String TAG = "ImmersiveModeHelper";

    private ImmersiveModeHelper() {
    }

    static void enable(Activity activity) {
        if (activity == null) {
            return;
        }
        Window window = activity.getWindow();
        if (window == null) {
            return;
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        window.addFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);

        View decorView = window.getDecorView();
        if (decorView == null) {
            return;
        }

        final int legacyFlags =
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                window.setDecorFitsSystemWindows(false);
                WindowInsetsController controller = decorView.getWindowInsetsController();
                if (controller != null) {
                    controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                    // DEFAULT: não revela barras ao deslizar (evita botões da maquininha).
                    controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_DEFAULT);
                }
            } catch (Exception e) {
                Log.w(TAG, "WindowInsetsController indisponível", e);
            }
        }

        decorView.setSystemUiVisibility(legacyFlags);
        installRehideListener(decorView, legacyFlags);
    }

    private static void installRehideListener(View decorView, int legacyFlags) {
        decorView.setOnSystemUiVisibilityChangeListener(visibility -> {
            boolean navVisible = (visibility & View.SYSTEM_UI_FLAG_HIDE_NAVIGATION) == 0;
            boolean statusVisible = (visibility & View.SYSTEM_UI_FLAG_FULLSCREEN) == 0;
            if (navVisible || statusVisible) {
                decorView.post(() -> decorView.setSystemUiVisibility(legacyFlags));
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    WindowInsetsController controller = decorView.getWindowInsetsController();
                    if (controller != null) {
                        controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                        controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_DEFAULT);
                    }
                }
            }
        });
    }
}
