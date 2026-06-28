package app.lovable.toplavanderia;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;

/** Tarja inferior fixa por 10 segundos — não remove antes (exceto toque Não imprimir). */
public class CieloPaymentOverlayService extends Service {
    private static final String TAG = "CieloPayOverlay";
    private static final String CHANNEL_ID = "cielo_payment_overlay";
    private static final int NOTIFICATION_ID = 4102;
    public static final long TARJA_DURATION_MS = 10000L;

    public static final String ACTION_START = "app.lovable.toplavanderia.action.CIELO_OVERLAY_START";
    public static final String ACTION_STOP = "app.lovable.toplavanderia.action.CIELO_OVERLAY_STOP";

    private static volatile CieloPaymentOverlayService runningInstance;

    private WindowManager windowManager;
    private final List<View> overlayViews = new ArrayList<>();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private int overlaySessionId = 0;
    private long tarjaShownAtMs = 0L;

    private final Runnable tarjaHideRunnable = new Runnable() {
        @Override
        public void run() {
            Context app = getApplicationContext();
            if (overlaySessionId != CieloPaymentSessionHelper.getSessionId(app)) {
                return;
            }
            removeOverlayInternal("timer10s");
            CieloPaymentSessionHelper.setShieldEnabled(app, false);
            Log.i(TAG, "Tarja ocultada (10s)");
        }
    };

    public static void startCardShield(Context context) {
        if (context == null || !CieloOverlayPermissionHelper.canDrawOverlays(context)) {
            return;
        }
        if (!CieloPaymentSessionHelper.isCardShieldEnabled(context)) {
            return;
        }
        Intent intent = new Intent(context, CieloPaymentOverlayService.class);
        intent.setAction(ACTION_START);
        intent.putExtra("session_id", CieloPaymentSessionHelper.getSessionId(context));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    /** Remove tarja imediatamente (ex.: antes do toque Não imprimir na tela aprovada). */
    public static void hideForTap(Context context) {
        if (context == null) {
            return;
        }
        Context app = context.getApplicationContext();
        long elapsed = CieloPaymentSessionHelper.getSessionElapsedMs(app);
        if (elapsed < 8000L && !CieloPaymentSessionHelper.isApprovedScreenConfirmed(app)) {
            Log.d(TAG, "hideForTap adiado — tarja 10s (" + elapsed + "ms)");
            return;
        }
        mainHandlerPost(() -> {
            CieloPaymentOverlayService svc = runningInstance;
            if (svc != null) {
                svc.mainHandler.removeCallbacks(svc.tarjaHideRunnable);
                svc.removeOverlayInternal("hideForTap");
            }
        });
    }

    public static void stop(Context context) {
        if (context == null) {
            return;
        }
        Context app = context.getApplicationContext();
        long elapsed = CieloPaymentSessionHelper.getSessionElapsedMs(app);
        if (elapsed > 0L && elapsed < TARJA_DURATION_MS
                && CieloPaymentSessionHelper.isCardShieldEnabled(app)) {
            Log.d(TAG, "Stop ignorado — tarja 10s (" + elapsed + "ms)");
            return;
        }
        Intent intent = new Intent(context, CieloPaymentOverlayService.class);
        intent.setAction(ACTION_STOP);
        context.startService(intent);
    }

    private static void mainHandlerPost(Runnable action) {
        Handler main = new Handler(Looper.getMainLooper());
        main.post(action);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        runningInstance = this;
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_STOP.equals(action)) {
            long elapsed = CieloPaymentSessionHelper.getSessionElapsedMs(this);
            if (elapsed > 0L && elapsed < TARJA_DURATION_MS
                    && CieloPaymentSessionHelper.isCardShieldEnabled(this)) {
                Log.d(TAG, "ACTION_STOP ignorado — tarja 10s (" + elapsed + "ms)");
                return START_NOT_STICKY;
            }
            mainHandler.removeCallbacks(tarjaHideRunnable);
            removeOverlayInternal("ACTION_STOP");
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        if (!CieloOverlayPermissionHelper.canDrawOverlays(this)) {
            Log.w(TAG, "Permissão overlay ausente");
            stopSelf();
            return START_NOT_STICKY;
        }

        overlaySessionId = intent != null ? intent.getIntExtra("session_id", 0) : 0;
        if (overlaySessionId == 0) {
            overlaySessionId = CieloPaymentSessionHelper.getSessionId(this);
        }

        startForeground(NOTIFICATION_ID, buildNotification());
        showOverlay();
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        mainHandler.removeCallbacks(tarjaHideRunnable);
        removeOverlayInternal("onDestroy");
        if (runningInstance == this) {
            runningInstance = null;
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private Notification buildNotification() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && manager != null) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                getString(R.string.cielo_overlay_channel_name),
                NotificationManager.IMPORTANCE_MIN
            );
            channel.setShowBadge(false);
            manager.createNotificationChannel(channel);
        }

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);

        return builder
            .setContentTitle(getString(R.string.cielo_overlay_notification_title))
            .setContentText(getString(R.string.cielo_overlay_notification_text))
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setOngoing(true)
            .build();
    }

    private void showOverlay() {
        int currentSessionId = CieloPaymentSessionHelper.getSessionId(this);
        if (!overlayViews.isEmpty() && overlaySessionId == currentSessionId && tarjaShownAtMs > 0L) {
            long elapsed = System.currentTimeMillis() - tarjaShownAtMs;
            if (elapsed > 0L && elapsed < TARJA_DURATION_MS) {
                Log.d(TAG, "Tarja já visível (" + elapsed + "ms) — sem reiniciar");
                return;
            }
        }

        removeOverlayInternal("showOverlay");

        int screenW = getResources().getDisplayMetrics().widthPixels;
        int screenH = getResources().getDisplayMetrics().heightPixels;
        int bandHeight = Math.max(dp(200), (int) (screenH * 0.24f));
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;

        LinearLayout band = new LinearLayout(this);
        band.setOrientation(LinearLayout.VERTICAL);
        band.setGravity(Gravity.CENTER);
        band.setBackgroundColor(Color.parseColor("#FF000000"));

        TextView hint = new TextView(this);
        hint.setText("Insira ou aproxime o cartão");
        hint.setTextColor(Color.WHITE);
        hint.setTextSize(TypedValue.COMPLEX_UNIT_SP, 28);
        hint.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        hint.setGravity(Gravity.CENTER);
        hint.setPadding(dp(16), dp(12), dp(16), dp(12));
        band.addView(hint);

        WindowManager.LayoutParams bandParams = new WindowManager.LayoutParams(
            screenW,
            bandHeight,
            type,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        );
        bandParams.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;

        try {
            windowManager.addView(band, bandParams);
            overlayViews.add(band);
            tarjaShownAtMs = System.currentTimeMillis();
            CieloPaymentSessionHelper.markOverlayShown(getApplicationContext());
            Log.i(TAG, "Tarja ativa 10s (sessão=" + overlaySessionId + ")");
            mainHandler.removeCallbacks(tarjaHideRunnable);
            mainHandler.postDelayed(tarjaHideRunnable, TARJA_DURATION_MS);
        } catch (Exception e) {
            Log.e(TAG, "Falha ao exibir tarja", e);
            removeOverlayInternal("showOverlay-falha");
        }
    }

    private void removeOverlayInternal(String reason) {
        if (windowManager == null) {
            overlayViews.clear();
            return;
        }
        if (overlayViews.isEmpty()) {
            return;
        }
        for (View view : overlayViews) {
            try {
                windowManager.removeView(view);
            } catch (Exception ignored) {
                // noop
            }
        }
        overlayViews.clear();
        Log.d(TAG, "Overlay removido (" + reason + ")");
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
