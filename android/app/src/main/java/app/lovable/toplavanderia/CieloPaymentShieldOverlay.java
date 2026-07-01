package app.lovable.toplavanderia;

import android.accessibilityservice.AccessibilityService;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;

/**
 * Tarja e bloqueio de QR/digitar cartão via TYPE_ACCESSIBILITY_OVERLAY.
 * Não usa SYSTEM_ALERT_WINDOW — funciona na maquininha de produção sem "Exibir sobre apps".
 */
final class CieloPaymentShieldOverlay {
    private static final String TAG = "CieloShieldOverlay";
    static final long TARJA_DURATION_MS = 10000L;
    private static final long MIN_MS_BEFORE_HIDE_FOR_TAP = 8000L;
    private static AccessibilityService boundService;
    private static WindowManager windowManager;
    private static final List<View> blockerViews = new ArrayList<>();
    private static View bottomTarjaView;
    private static int bottomTarjaSessionId;
    private static long bottomTarjaShownAtMs;
    private static final Handler mainHandler = new Handler(Looper.getMainLooper());
    private static long lastHintAtMs = 0L;
    private static Runnable bottomTarjaHideRunnable;

    private CieloPaymentShieldOverlay() {
    }

    static void bind(AccessibilityService service) {
        boundService = service;
        windowManager = (WindowManager) service.getSystemService(Context.WINDOW_SERVICE);
    }

    static void unbind() {
        clearAll();
        boundService = null;
        windowManager = null;
    }

    static boolean isTarjaVisible() {
        return bottomTarjaView != null;
    }

    static void updateBlockers(List<Rect> buttonBounds) {
        if (boundService == null || windowManager == null) {
            return;
        }
        mainHandler.post(() -> applyBlockers(buttonBounds));
    }

    /** Exibe tarja uma vez por sessão — não remove/recria se já estiver fixa. */
    static void showBottomTarja(Context context) {
        if (boundService == null || windowManager == null || context == null) {
            return;
        }
        if (!CieloPaymentSessionHelper.isCardShieldEnabled(context)) {
            return;
        }
        if (!CieloPaymentSessionHelper.shouldBlockAlternateCapture(context)) {
            return;
        }
        Context app = context.getApplicationContext();
        int sessionId = CieloPaymentSessionHelper.getSessionId(app);
        if (bottomTarjaView != null && bottomTarjaSessionId == sessionId) {
            return;
        }
        mainHandler.post(() -> applyBottomTarja(app));
    }

    static void hideForTap(Context context) {
        if (context == null) {
            return;
        }
        Context app = context.getApplicationContext();
        long elapsed = CieloPaymentSessionHelper.getSessionElapsedMs(app);
        if (elapsed < MIN_MS_BEFORE_HIDE_FOR_TAP
                && !CieloPaymentSessionHelper.isApprovedScreenConfirmed(app)) {
            Log.d(TAG, "hideForTap adiado — tarja 10s (" + elapsed + "ms)");
            return;
        }
        mainHandler.post(CieloPaymentShieldOverlay::removeBottomTarjaInternal);
    }

    /** Remove só os bloqueadores de botão — mantém a tarja inferior fixa. */
    static void clearBlockers() {
        mainHandler.post(CieloPaymentShieldOverlay::clearBlockersOnMainThread);
    }

    /** Fim de sessão — remove tarja e bloqueadores. */
    static void clearAll() {
        mainHandler.post(CieloPaymentShieldOverlay::clearAllOnMainThread);
    }

    /** @deprecated use {@link #clearAll()} */
    static void clear() {
        clearAll();
    }

    private static void clearBlockersOnMainThread() {
        if (windowManager == null) {
            blockerViews.clear();
            return;
        }
        for (View view : blockerViews) {
            try {
                windowManager.removeView(view);
            } catch (Exception ignored) {
                // noop
            }
        }
        blockerViews.clear();
    }

    private static void clearAllOnMainThread() {
        cancelBottomTarjaTimer();
        removeBottomTarjaInternal();
        clearBlockersOnMainThread();
    }

    private static void applyBlockers(List<Rect> buttonBounds) {
        clearBlockersOnMainThread();

        if (buttonBounds == null || buttonBounds.isEmpty() || windowManager == null) {
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

    private static void applyBottomTarja(Context app) {
        int sessionId = CieloPaymentSessionHelper.getSessionId(app);
        if (sessionId <= 0 || boundService == null || windowManager == null) {
            return;
        }
        if (bottomTarjaView != null && bottomTarjaSessionId == sessionId) {
            return;
        }

        int screenW = boundService.getResources().getDisplayMetrics().widthPixels;
        int screenH = boundService.getResources().getDisplayMetrics().heightPixels;
        int bandHeight = Math.max(dp(200), (int) (screenH * 0.24f));

        LinearLayout band = new LinearLayout(boundService);
        band.setOrientation(LinearLayout.VERTICAL);
        band.setGravity(Gravity.CENTER);
        band.setBackgroundColor(Color.parseColor("#FF000000"));

        TextView hint = new TextView(boundService);
        hint.setText("Insira ou aproxime o cartão");
        hint.setTextColor(Color.WHITE);
        hint.setTextSize(TypedValue.COMPLEX_UNIT_SP, 28);
        hint.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        hint.setGravity(Gravity.CENTER);
        hint.setPadding(dp(16), dp(12), dp(16), dp(12));
        band.addView(hint);

        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
            screenW,
            bandHeight,
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;

        try {
            windowManager.addView(band, params);
            bottomTarjaView = band;
            bottomTarjaSessionId = sessionId;
            bottomTarjaShownAtMs = System.currentTimeMillis();
            CieloPaymentSessionHelper.markOverlayShown(app);
            Log.i(TAG, "Tarja a11y fixa 10s (sessão=" + sessionId + ")");
            scheduleBottomTarjaHide(app, sessionId);
        } catch (Exception e) {
            Log.e(TAG, "Falha tarja a11y", e);
            removeBottomTarjaInternal();
        }
    }

    private static void scheduleBottomTarjaHide(Context app, int sessionId) {
        if (bottomTarjaHideRunnable != null) {
            return;
        }
        bottomTarjaHideRunnable = () -> {
            bottomTarjaHideRunnable = null;
            if (CieloPaymentSessionHelper.getSessionId(app) != sessionId) {
                return;
            }
            removeBottomTarjaInternal();
            CieloPaymentSessionHelper.setShieldEnabled(app, false);
            Log.i(TAG, "Tarja a11y ocultada (10s)");
        };
        mainHandler.postDelayed(bottomTarjaHideRunnable, TARJA_DURATION_MS);
    }

    private static void cancelBottomTarjaTimer() {
        if (bottomTarjaHideRunnable != null) {
            mainHandler.removeCallbacks(bottomTarjaHideRunnable);
            bottomTarjaHideRunnable = null;
        }
    }

    private static void removeBottomTarjaInternal() {
        cancelBottomTarjaTimer();
        if (bottomTarjaView == null || windowManager == null) {
            bottomTarjaView = null;
            bottomTarjaSessionId = 0;
            bottomTarjaShownAtMs = 0L;
            return;
        }
        try {
            windowManager.removeView(bottomTarjaView);
        } catch (Exception ignored) {
            // noop
        }
        bottomTarjaView = null;
        bottomTarjaSessionId = 0;
        bottomTarjaShownAtMs = 0L;
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

    private static int dp(int value) {
        if (boundService == null) {
            return value;
        }
        return Math.round(value * boundService.getResources().getDisplayMetrics().density);
    }
}
