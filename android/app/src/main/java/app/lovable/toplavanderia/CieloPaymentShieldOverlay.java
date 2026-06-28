package app.lovable.toplavanderia;

import android.accessibilityservice.AccessibilityService;
import android.content.Context;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;

/**
 * Cobre os botões "Gerar QR Code" / "Digitar Cartão" na tela da Cielo (TYPE_ACCESSIBILITY_OVERLAY)
 * para interceptar toques antes que abram fluxos indesejados.
 */
final class CieloPaymentShieldOverlay {
    private static AccessibilityService boundService;
    private static WindowManager windowManager;
    private static final List<View> blockerViews = new ArrayList<>();
    private static final Handler mainHandler = new Handler(Looper.getMainLooper());
    private static long lastHintAtMs = 0L;

    private CieloPaymentShieldOverlay() {
    }

    static void bind(AccessibilityService service) {
        boundService = service;
        windowManager = (WindowManager) service.getSystemService(Context.WINDOW_SERVICE);
    }

    static void unbind() {
        clear();
        boundService = null;
        windowManager = null;
    }

    static void updateBlockers(List<Rect> buttonBounds) {
        if (boundService == null || windowManager == null) {
            return;
        }
        mainHandler.post(() -> applyBlockers(buttonBounds));
    }

    static void clear() {
        if (boundService == null || windowManager == null) {
            blockerViews.clear();
            return;
        }
        mainHandler.post(() -> {
            for (View view : blockerViews) {
                try {
                    windowManager.removeView(view);
                } catch (Exception ignored) {
                    // noop
                }
            }
            blockerViews.clear();
        });
    }

    private static void applyBlockers(List<Rect> buttonBounds) {
        for (View view : blockerViews) {
            try {
                windowManager.removeView(view);
            } catch (Exception ignored) {
                // noop
            }
        }
        blockerViews.clear();

        if (buttonBounds == null || buttonBounds.isEmpty()) {
            return;
        }

        for (Rect bounds : buttonBounds) {
            if (bounds == null || bounds.isEmpty()) {
                continue;
            }
            View blocker = buildBlockerView(bounds);
            WindowManager.LayoutParams params = buildLayoutParams(bounds);
            try {
                windowManager.addView(blocker, params);
                blockerViews.add(blocker);
            } catch (Exception ignored) {
                // noop
            }
        }
    }

    private static View buildBlockerView(Rect bounds) {
        FrameLayout container = new FrameLayout(boundService);
        container.setClickable(true);
        container.setFocusable(true);
        container.setContentDescription("Use o leitor de cartao");
        container.setBackgroundColor(0xCC1E293B);

        TextView label = new TextView(boundService);
        label.setText("Use o leitor\n(aproxime ou insira o cartão)");
        label.setTextColor(0xFFF8FAFC);
        label.setTextSize(13f);
        label.setGravity(Gravity.CENTER);
        label.setPadding(12, 12, 12, 12);
        container.addView(label, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT,
            Gravity.CENTER
        ));

        container.setOnClickListener(v -> showCardHint());
        return container;
    }

    private static WindowManager.LayoutParams buildLayoutParams(Rect bounds) {
        WindowManager.LayoutParams params = new WindowManager.LayoutParams();
        params.type = WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY;
        params.format = PixelFormat.TRANSLUCENT;
        params.gravity = Gravity.TOP | Gravity.START;
        params.x = bounds.left;
        params.y = bounds.top;
        params.width = Math.max(bounds.width(), 1);
        params.height = Math.max(bounds.height(), 1);
        params.flags = WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
            | WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
        return params;
    }

    private static void showCardHint() {
        long now = System.currentTimeMillis();
        if (now - lastHintAtMs < 1200L || boundService == null) {
            return;
        }
        lastHintAtMs = now;
        Intent hint = new Intent(boundService, CieloCardOnlyHintActivity.class);
        hint.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        boundService.startActivity(hint);
    }
}
