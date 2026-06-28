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
import android.os.IBinder;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * Cobre a faixa inferior da tela Cielo (botões QR / digitar cartão) com overlay do Top Lavanderia.
 * Não depende de ler a árvore de acessibilidade do app Cielo.
 */
public class CieloPaymentOverlayService extends Service {
    private static final String TAG = "CieloPayOverlay";
    private static final String CHANNEL_ID = "cielo_payment_overlay";
    private static final int NOTIFICATION_ID = 4102;

    public static final String ACTION_START = "app.lovable.toplavanderia.action.CIELO_OVERLAY_START";
    public static final String ACTION_STOP = "app.lovable.toplavanderia.action.CIELO_OVERLAY_STOP";

    private WindowManager windowManager;
    private View overlayView;

    public static void startCardShield(Context context) {
        if (context == null || !CieloOverlayPermissionHelper.canDrawOverlays(context)) {
            return;
        }
        Intent intent = new Intent(context, CieloPaymentOverlayService.class);
        intent.setAction(ACTION_START);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    public static void stop(Context context) {
        if (context == null) {
            return;
        }
        Intent intent = new Intent(context, CieloPaymentOverlayService.class);
        intent.setAction(ACTION_STOP);
        context.startService(intent);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_STOP.equals(action)) {
            removeOverlay();
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        if (!CieloOverlayPermissionHelper.canDrawOverlays(this)) {
            Log.w(TAG, "Permissão 'exibir sobre outros apps' ausente");
            stopSelf();
            return START_NOT_STICKY;
        }

        startForeground(NOTIFICATION_ID, buildNotification());
        showOverlay();
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        removeOverlay();
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
        removeOverlay();

        int screenHeight = getResources().getDisplayMetrics().heightPixels;
        int overlayHeight = Math.max(dp(180), (int) (screenHeight * 0.22f));

        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER);
        panel.setBackgroundColor(Color.parseColor("#E61E293B"));
        panel.setClickable(true);
        panel.setFocusable(true);
        panel.setPadding(dp(16), dp(12), dp(16), dp(12));

        TextView title = new TextView(this);
        title.setText("Aproxime ou insira o cartão");
        title.setTextColor(Color.WHITE);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        title.setGravity(Gravity.CENTER);
        panel.addView(title);

        TextView subtitle = new TextView(this);
        subtitle.setText("Não use QR Code nem digitar cartão");
        subtitle.setTextColor(Color.parseColor("#CBD5E1"));
        subtitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        subtitle.setGravity(Gravity.CENTER);
        subtitle.setPadding(0, dp(8), 0, 0);
        panel.addView(subtitle);

        panel.setOnClickListener(v -> {
            Intent hint = new Intent(this, CieloCardOnlyHintActivity.class);
            hint.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(hint);
        });

        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            overlayHeight,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.BOTTOM;

        overlayView = panel;
        try {
            windowManager.addView(overlayView, params);
            Log.i(TAG, "Overlay inferior ativo (" + overlayHeight + "px)");
        } catch (Exception e) {
            Log.e(TAG, "Falha ao exibir overlay", e);
            overlayView = null;
        }
    }

    private void removeOverlay() {
        if (windowManager == null || overlayView == null) {
            overlayView = null;
            return;
        }
        try {
            windowManager.removeView(overlayView);
        } catch (Exception ignored) {
            // noop
        }
        overlayView = null;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
