package app.lovable.toplavanderia;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.content.Context;
import android.content.Intent;
import android.graphics.Path;
import android.graphics.Rect;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * Totem Cielo:
 * 1) Dispensa comprovante ("Não imprimir") quando detecta o diálogo da Cielo.
 * 2) Em pagamento crédito/débito, cobre "Gerar QR Code" / "Digitar Cartão" com overlay
 *    e orienta o cliente a usar o leitor físico.
 */
public class CieloReceiptAccessibilityService extends AccessibilityService {
    private static final String TAG = "CieloReceiptA11y";
    private static volatile CieloReceiptAccessibilityService instance;
    private static volatile String lastSnapshotNullReason = "sem tentativa";
    private static final String OUR_PACKAGE = "com.toplavanderia.app";

    /** DX8000 720×1280 — menu "02 NÃO IMPRIMIR" (esquerda) + botão azul central. */
    private static final float[][] NO_PRINT_TAP_POINTS = {
        {0.28f, 0.905f},
        {0.28f, 0.935f},
        {0.28f, 0.965f},
        {0.50f, 0.930f},
        {0.50f, 0.955f},
        {0.72f, 0.935f},
    };
    private int noPrintTapIndex = 0;
    private boolean noPrintBurstStarted = false;
    private boolean approvedPollingActive = false;
    private static final long APPROVED_POLL_MS = 300L;
    private static final long TARJA_SAFETY_MS = 90000L;
    private static final long NO_PRINT_AFTER_TARJA_REMOVED_MS = 900L;
    private static final long INITIAL_GUARD_MS = 2500L;
    private static final long A11Y_BLIND_INITIAL_MS = 4000L;
    private static final long MIN_MS_FOR_TRANSITION_APPROVAL = 6000L;
    private static final int MIN_WINDOW_CHANGES_FOR_APPROVAL = 2;
    private static final long RECENT_WINDOW_MS = 3500L;

    private static final String[] CIELO_PACKAGES = {
        "br.com.setis.pos_buziosandroid",
        "br.com.cielosmart.payment",
        "br.com.cielosmart.service",
        "br.com.cielosmart.orderservice",
        "br.com.cielosmart.launcher",
        "br.com.cielosmart.settings",
        "br.com.cielosmart.calculator",
        "br.com.cielo.transactional.services",
        "com.ads.lio.uriappclient",
        "cielo.smart.order.manager",
        "cielo.netmanager",
        "cielo.router",
        "cielo.apps",
        "cielo.lio.cashless",
        "com.m4u.lio.qrinstaller",
        "com.m4u.lio.store"
    };

    private static final String[] PRINT_PROMPT_HINTS = {
        "deseja imprimir",
        "imprimir comprovante",
        "imprimir o comprovante",
        "imprimir o comprovante do cliente",
        "via do cliente",
        "via do estabelecimento",
        "via do lojista",
        "imprimir via",
        "comprovante do cliente",
        "comprovante da transacao",
        "comprovante da transação"
    };

    private static final String[] DISMISS_BUTTON_TEXTS = {
        "nao imprimir",
        "não imprimir",
        "02 nao imprimir",
        "02 não imprimir",
        "nao imprimir comprovante",
        "não imprimir comprovante",
        "continuar sem imprimir",
        "pular impressao",
        "pular impressão",
        "sem impressao",
        "sem impressão",
        "nao desejo imprimir",
        "não desejo imprimir"
    };

    private static final String[] FORBIDDEN_CAPTURE_BUTTONS = {
        "gerar qr code",
        "gerar qrcode",
        "gerar qr",
        "digitar cartao",
        "digitar cartão",
        "digitar o cartao",
        "digitar o cartão"
    };

    private static final String[] ALTERNATE_CAPTURE_SCREEN_HINTS = {
        "digite o numero do cartao",
        "digite o número do cartão",
        "numero do cartao",
        "número do cartão",
        "escaneie o qr",
        "escaneie o qrcode",
        "leia o qr code"
    };

    private static final String[] PAYMENT_APPROVED_HINTS = {
        "pagamento aprovado",
        "pix aprovado",
        "pix recebido",
        "aprovado",
        "transacao aprovada",
        "transação aprovada",
        "pagamento autorizado",
        "transacao autorizada",
        "transação autorizada",
        "pagamento realizado",
        "transacao concluida",
        "transação concluída",
        "transacao efetuada",
        "transação efetuada",
        "aprovado com sucesso",
        "transacao aprovada com sucesso",
        "transação aprovada com sucesso",
        "compra aprovada",
        "venda aprovada",
        "aprovada ",
        " aprovada ",
        "aprovada 1",
        "aprovada 2",
        "aprovada 3",
        "aprovada 4",
        "aprovada 5",
        "aprovada 6",
        "aprovada 7",
        "aprovada 8",
        "aprovada 9"
    };

    private static final long APPROVED_DISMISS_BURST_MS = 18000L;
    private static final int MAX_PRINT_DISMISS_RETRIES = 12;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private long lastDismissAtMs = 0L;
    private long lastCardHintAtMs = 0L;
    private long lastShieldUpdateAtMs = 0L;
    private long lastApprovedShieldDismissAtMs = 0L;
    private long lastPrintDismissAttemptAtMs = 0L;
    private long approvedDismissBurstUntilMs = 0L;
    private int printDismissRetryCount = 0;
    private String lastShieldSignature = "";
    private int cieloWindowChangeCount = 0;
    private long lastCieloWindowChangeAtMs = 0L;
    private int nonInitialStablePolls = 0;
    private boolean seenForbiddenCaptureButtons = false;
    private boolean trocoBypassDone = false;
    private long lastTrocoBypassAtMs = 0L;

    private final Runnable windowTransitionRunnable = new Runnable() {
        @Override
        public void run() {
            if (noPrintBurstStarted || !CieloPaymentSessionHelper.hasActiveSession(CieloReceiptAccessibilityService.this)) {
                return;
            }
            long elapsed = CieloPaymentSessionHelper.getSessionElapsedMs(CieloReceiptAccessibilityService.this);
            if (elapsed < MIN_MS_FOR_TRANSITION_APPROVAL) {
                return;
            }
            if (cieloWindowChangeCount < MIN_WINDOW_CHANGES_FOR_APPROVAL) {
                return;
            }
            if (!detectApprovedScreen("", "window-transition@" + elapsed + "ms")) {
                return;
            }
        }
    };

    @Override
    public void onServiceConnected() {
        super.onServiceConnected();
        instance = this;
        CieloPaymentShieldOverlay.bind(this);
        if (CieloPaymentSessionHelper.hasActiveSession(this)) {
            startApprovedPolling();
        }
        Log.i(TAG, "Assistente Cielo conectado (overlay + comprovante + toque coordenado)");
    }

    @Override
    public void onDestroy() {
        if (instance == this) {
            instance = null;
        }
        CieloPaymentShieldOverlay.unbind();
        super.onDestroy();
    }

    public static boolean tapNoPrintButton() {
        CieloReceiptAccessibilityService svc = instance;
        if (svc == null) {
            Log.w(TAG, "Assistente indisponível para toque");
            return false;
        }
        svc.mainHandler.post(svc::tapNoPrintCoordinates);
        return true;
    }

    /** Envia toques em vários pontos calibrados (menu + botão central). */
    public static boolean tapNoPrintButtonBurst() {
        CieloReceiptAccessibilityService svc = instance;
        if (svc == null) {
            Log.w(TAG, "Assistente indisponível para toque");
            return false;
        }
        svc.mainHandler.post(svc::tapNoPrintBurstCoordinates);
        return true;
    }

    public static void tryDismissPrintViaTree() {
        CieloReceiptAccessibilityService svc = instance;
        if (svc == null) {
            return;
        }
        svc.mainHandler.post(svc::attemptPrintDismissViaTree);
    }

    public static boolean tryDismissPrintViaTreeSync() {
        CieloReceiptAccessibilityService svc = instance;
        if (svc == null) {
            return false;
        }
        if (Looper.myLooper() == Looper.getMainLooper()) {
            return svc.attemptPrintDismissViaTreeInternal();
        }
        final boolean[] result = {false};
        CountDownLatch latch = new CountDownLatch(1);
        svc.mainHandler.post(() -> {
            result[0] = svc.attemptPrintDismissViaTreeInternal();
            latch.countDown();
        });
        try {
            latch.await(800L, TimeUnit.MILLISECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        return result[0];
    }

    public static final class WindowSnapshot {
        public final String signature;
        public final String text;
        public final boolean initialCaptureScreen;
        public final boolean approvedText;

        WindowSnapshot(String signature, String text, boolean initialCaptureScreen, boolean approvedText) {
            this.signature = signature;
            this.text = text;
            this.initialCaptureScreen = initialCaptureScreen;
            this.approvedText = approvedText;
        }
    }

    public static CieloReceiptAccessibilityService getInstance() {
        return instance;
    }

    public static String getSnapshotNullReason() {
        return lastSnapshotNullReason;
    }

    void runOnServiceThread(Runnable action) {
        if (action == null) {
            return;
        }
        if (Looper.myLooper() == mainHandler.getLooper()) {
            action.run();
        } else {
            mainHandler.post(action);
        }
    }

    public static WindowSnapshot captureCieloWindowSnapshot() {
        CieloReceiptAccessibilityService svc = instance;
        if (svc == null) {
            lastSnapshotNullReason = "assistente null";
            return null;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) {
            lastSnapshotNullReason = "api < 21";
            return null;
        }
        return svc.buildCieloWindowSnapshot();
    }

    public static void notifyApprovedScreen(Context context, String source) {
        if (context == null) {
            return;
        }
        Context app = context.getApplicationContext();
        CieloReceiptAccessibilityService svc = instance;
        if (svc != null) {
            svc.mainHandler.post(() -> svc.onApprovedScreenDetected(source));
            return;
        }
        CieloPrintDismissScheduler.onApprovedDetected(app, source);
    }

    private WindowSnapshot buildCieloWindowSnapshot() {
        List<android.view.accessibility.AccessibilityWindowInfo> windows = getWindows();
        if (windows == null || windows.isEmpty()) {
            lastSnapshotNullReason = "getWindows vazio";
            return null;
        }

        StringBuilder signature = new StringBuilder();
        StringBuilder text = new StringBuilder();
        StringBuilder seenPkgs = new StringBuilder();
        boolean hasForbidden = false;
        int matched = 0;

        for (android.view.accessibility.AccessibilityWindowInfo window : windows) {
            if (window == null) {
                continue;
            }
            AccessibilityNodeInfo root = window.getRoot();
            if (root == null) {
                continue;
            }
            try {
                CharSequence pkgSeq = root.getPackageName();
                String pkg = pkgSeq != null ? pkgSeq.toString() : "";
                if (!isPaymentWindowPackage(pkg)) {
                    continue;
                }
                matched++;
                if (seenPkgs.indexOf(pkg) < 0) {
                    if (seenPkgs.length() > 0) {
                        seenPkgs.append(',');
                    }
                    seenPkgs.append(pkg);
                }
                signature.append(window.getId()).append(':');
                signature.append(pkg).append(':');
                signature.append(root.getClassName()).append(':');
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    CharSequence title = window.getTitle();
                    if (title != null && title.length() > 0) {
                        signature.append(title).append(':');
                    }
                }
                Rect bounds = new Rect();
                root.getBoundsInScreen(bounds);
                signature.append(bounds.width()).append('x').append(bounds.height()).append(':');
                signature.append('c').append(root.getChildCount()).append(':');
                String nodeText = nodeTextDeep(root);
                if (!nodeText.isEmpty()) {
                    appendTreeText(text, nodeText);
                }
                if (!findForbiddenButtonBounds(root).isEmpty()) {
                    hasForbidden = true;
                }
                signature.append(nodeText.length()).append('|');
            } finally {
                root.recycle();
            }
        }

        if (signature.length() == 0) {
            lastSnapshotNullReason = "0 janelas pagamento (total=" + windows.size() + ")";
            return null;
        }

        lastSnapshotNullReason = "ok(" + matched + "): " + seenPkgs;
        String allText = text.toString();
        boolean initial = hasForbidden || textContainsInitialCapture(allText);
        boolean approved = looksLikeApprovedReceipt(allText);
        return new WindowSnapshot(signature.toString(), allText, initial, approved);
    }

    private boolean isPaymentWindowPackage(String packageName) {
        if (packageName == null || packageName.isEmpty()) {
            return false;
        }
        if (OUR_PACKAGE.equals(packageName)) {
            return false;
        }
        if (packageName.startsWith("com.android.systemui")
                || packageName.equals("android")
                || packageName.startsWith("com.android.launcher")) {
            return false;
        }
        if (isCieloPackage(packageName)) {
            return true;
        }
        String lower = packageName.toLowerCase(Locale.ROOT);
        return lower.contains("cielo") || lower.contains(".lio.") || lower.contains("lio.")
            || lower.contains("buzios") || lower.contains("setis.pos")
            || lower.startsWith("com.ads.");
    }

    private boolean textContainsInitialCapture(String all) {
        if (all == null || all.isEmpty()) {
            return false;
        }
        return all.contains("digitar cartao") || all.contains("digitar cartão")
            || all.contains("gerar qr") || all.contains("gerar qrcode")
            || all.contains("gerar qr code");
    }

    private boolean tapNoPrintCoordinates() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
            return false;
        }
        android.util.DisplayMetrics dm = getResources().getDisplayMetrics();
        float w = dm.widthPixels;
        float h = dm.heightPixels;
        float[] point = NO_PRINT_TAP_POINTS[noPrintTapIndex % NO_PRINT_TAP_POINTS.length];
        noPrintTapIndex++;
        float x = w * point[0];
        float y = h * point[1];
        dispatchTapAsync(x, y);
        Log.i(TAG, "Toque coordenado (" + Math.round(x) + "," + Math.round(y) + ")");
        return true;
    }

    private void tapNoPrintBurstCoordinates() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
            return;
        }
        android.util.DisplayMetrics dm = getResources().getDisplayMetrics();
        float w = dm.widthPixels;
        float h = dm.heightPixels;
        int start = noPrintTapIndex % NO_PRINT_TAP_POINTS.length;
        for (int i = 0; i < 3; i++) {
            float[] point = NO_PRINT_TAP_POINTS[(start + i) % NO_PRINT_TAP_POINTS.length];
            float x = w * point[0];
            float y = h * point[1];
            long delay = i * 120L;
            mainHandler.postDelayed(() -> dispatchTapAsync(x, y), delay);
            Log.i(TAG, "Burst toque (" + Math.round(x) + "," + Math.round(y) + ") +" + delay + "ms");
        }
        noPrintTapIndex += 3;
    }

    private void dispatchTapAsync(float x, float y) {
        Path path = new Path();
        path.moveTo(x, y);
        path.lineTo(x + 2f, y + 2f);
        GestureDescription.StrokeDescription stroke =
            new GestureDescription.StrokeDescription(path, 0L, 80L);
        GestureDescription gesture = new GestureDescription.Builder().addStroke(stroke).build();
        dispatchGesture(gesture, new GestureResultCallback() {
            @Override
            public void onCompleted(GestureDescription gestureDescription) {
                Log.i(TAG, "Gesto concluído em (" + Math.round(x) + "," + Math.round(y) + ")");
            }

            @Override
            public void onCancelled(GestureDescription gestureDescription) {
                Log.w(TAG, "Gesto cancelado em (" + Math.round(x) + "," + Math.round(y) + ")");
            }
        }, null);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null) {
            return;
        }
        CharSequence pkgSeq = event.getPackageName();
        if (pkgSeq == null || !isCieloPackage(pkgSeq.toString())) {
            return;
        }

        if (CieloPaymentSessionHelper.hasActiveSession(this)) {
            if (CieloPaymentSessionHelper.shouldBlockAlternateCapture(this)
                    && !CieloPaymentShieldOverlay.isTarjaVisible()) {
                CieloPaymentShieldOverlay.showBottomTarja(this);
            }
            if (!noPrintBurstStarted) {
                String fromEvent = extractEventText(event);
                if (!detectApprovedScreen(fromEvent, "event")) {
                    int eventType = event.getEventType();
                    if (eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
                            || eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) {
                        scanForApprovedScreen("event-scan");
                    }
                }
            }
        }

        int type = event.getEventType();
        if (type == AccessibilityEvent.TYPE_VIEW_CLICKED) {
            handleForbiddenCaptureClick(event);
        }

        if (type != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
                && type != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
                && type != AccessibilityEvent.TYPE_VIEW_CLICKED) {
            return;
        }

        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) {
            return;
        }

        try {
            handlePaymentShield(root);
            handleTrocoScreenBypass(root);

            if (CieloPaymentSessionHelper.shouldBlockAlternateCapture(this)
                    && treeContainsAlternateCaptureScreen(root)) {
                showCardOnlyHintAndBack("alternate-screen");
            }
        } finally {
            root.recycle();
        }
    }

    private void onApprovedScreenDetected(String source) {
        if (noPrintBurstStarted || !CieloPaymentSessionHelper.hasActiveSession(this)) {
            return;
        }
        noPrintBurstStarted = true;
        stopApprovedPolling();
        CieloPrintDismissScheduler.onApprovedDetected(getApplicationContext(), source);
    }

    private boolean detectApprovedScreen(String eventText, String source) {
        if (noPrintBurstStarted || !CieloPaymentSessionHelper.hasActiveSession(this)) {
            return false;
        }
        if (!eventText.isEmpty() && looksLikeApprovedPaymentScreen(eventText)) {
            onApprovedScreenDetected(source + "-event:" + truncateForLog(eventText));
            return true;
        }

        String all = collectAllWindowsText();
        if (!all.isEmpty() && looksLikeApprovedPaymentScreen(all)) {
            onApprovedScreenDetected(source + "-tree:" + truncateForLog(all));
            return true;
        }

        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root != null) {
            try {
                String nodeText = nodeTextDeep(root);
                if (looksLikeApprovedPaymentScreen(nodeText)) {
                    onApprovedScreenDetected(source + "-node");
                    return true;
                }
            } finally {
                root.recycle();
            }
        }
        return false;
    }

    private void scanForApprovedScreen(String source) {
        detectApprovedScreen("", source);
    }

    private void ensureTarjaDuringPayment() {
        // Tarja controlada pelo timer de 10s em CieloPaymentShieldOverlay (acessibilidade).
    }

    private boolean isInitialCaptureScreen(AccessibilityNodeInfo root, String all) {
        long elapsed = CieloPaymentSessionHelper.getSessionElapsedMs(this);
        if (elapsed < INITIAL_GUARD_MS) {
            return true;
        }
        if (all == null) {
            all = collectAllWindowsText();
        }
        if (textContainsInitialCapture(all)) {
            return true;
        }
        AccessibilityNodeInfo walk = root;
        boolean owned = false;
        if (walk == null) {
            walk = getRootInActiveWindow();
            owned = walk != null;
        }
        if (walk == null) {
            return elapsed < A11Y_BLIND_INITIAL_MS;
        }
        try {
            List<Rect> forbidden = findForbiddenButtonBounds(walk);
            if (!forbidden.isEmpty()) {
                seenForbiddenCaptureButtons = true;
                return true;
            }
            if (seenForbiddenCaptureButtons) {
                return false;
            }
            return elapsed < A11Y_BLIND_INITIAL_MS;
        } finally {
            if (owned) {
                walk.recycle();
            }
        }
    }

    private String collectAllWindowsText() {
        StringBuilder sb = new StringBuilder();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            List<android.view.accessibility.AccessibilityWindowInfo> windows = getWindows();
            if (windows != null) {
                for (android.view.accessibility.AccessibilityWindowInfo window : windows) {
                    if (window == null) {
                        continue;
                    }
                    AccessibilityNodeInfo root = window.getRoot();
                    if (root == null) {
                        continue;
                    }
                    try {
                        appendTreeText(sb, nodeTextDeep(root));
                    } finally {
                        root.recycle();
                    }
                }
            }
        }
        if (sb.length() == 0) {
            AccessibilityNodeInfo root = getRootInActiveWindow();
            if (root != null) {
                try {
                    appendTreeText(sb, nodeTextDeep(root));
                } finally {
                    root.recycle();
                }
            }
        }
        return sb.toString();
    }

    private void appendTreeText(StringBuilder sb, String value) {
        if (value == null || value.isEmpty()) {
            return;
        }
        if (sb.length() > 0) {
            sb.append(' ');
        }
        sb.append(value);
    }

    private boolean looksLikeCardCaptureScreen(String all) {
        if (all.isEmpty()) {
            return false;
        }
        if (all.contains("digitar cartao") || all.contains("digitar cartão")
                || all.contains("gerar qr") || all.contains("gerar qrcode")) {
            return false;
        }
        return all.contains("aproxime") || all.contains("insira")
            || all.contains("passe o cartao") || all.contains("passe o cartão")
            || all.contains("aguardando") || all.contains("leitor");
    }

    /** Saiu da tela QR/digitar (ex.: processando cartão), mas ainda não é comprovante. */
    private boolean looksLikePastInitialScreen(String all) {
        if (all.isEmpty()) {
            return false;
        }
        if (all.contains("digitar cartao") || all.contains("digitar cartão")
                || all.contains("gerar qr") || all.contains("gerar qrcode")) {
            return false;
        }
        if (looksLikePrintOrApprovedScreen(all)) {
            return false;
        }
        long elapsed = CieloPaymentSessionHelper.getSessionElapsedMs(this);
        return elapsed > 6000L
            && (all.contains("credito") || all.contains("crédito")
            || all.contains("debito") || all.contains("débito")
            || all.contains(" r$") || all.contains("cartao") || all.contains("cartão"));
    }

    private boolean looksLikePrintOrApprovedScreen(String all) {
        return looksLikeApprovedPaymentScreen(all);
    }

    /** Tela aprovada ou menu de impressão — nunca captura/processando. */
    private boolean looksLikeApprovedPaymentScreen(String all) {
        if (all == null || all.isEmpty()) {
            return false;
        }
        String lower = normalize(all);
        if (lower.contains("aproxime") || lower.contains("insira") || lower.contains("passe o cart")
                || lower.contains("processando") || lower.contains("gerar qr")
                || lower.contains("digitar cart")) {
            return false;
        }
        if (lower.contains("nao imprimir") || lower.contains("não imprimir")) {
            return true;
        }
        // "aprovad" cobre aprovada/aprovado (PIX costuma usar "Pagamento aprovado").
        return lower.contains("aprovad");
    }

    private void attemptPrintDismissViaTree() {
        attemptPrintDismissViaTreeInternal();
    }

    private boolean attemptPrintDismissViaTreeInternal() {
        if (!CieloPaymentSessionHelper.hasActiveSession(this)) {
            return false;
        }
        CieloPaymentShieldOverlay.hideForTap(getApplicationContext());
        AccessibilityNodeInfo btn = findDismissButtonInAllWindows();
        if (btn == null) {
            return false;
        }
        try {
            if (clickNode(btn)) {
                Log.i(TAG, "Clicou 'Não imprimir' via árvore de acessibilidade");
                CieloPrintDismissScheduler.markDismissSucceeded();
                return true;
            }
        } finally {
            btn.recycle();
        }
        return false;
    }
    private final Runnable approvedPollRunnable = new Runnable() {
        @Override
        public void run() {
            if (!approvedPollingActive
                    || !CieloPaymentSessionHelper.hasActiveSession(CieloReceiptAccessibilityService.this)) {
                stopApprovedPolling();
                return;
            }
            scanForApprovedScreen("poll");
            if (approvedPollingActive) {
                mainHandler.postDelayed(this, APPROVED_POLL_MS);
            }
        }
    };

    private void startApprovedPolling() {
        stopApprovedPolling();
        approvedPollingActive = true;
        mainHandler.post(approvedPollRunnable);
        Log.d(TAG, "Monitor de tela aprovada iniciado");
    }

    private void stopApprovedPolling() {
        approvedPollingActive = false;
        mainHandler.removeCallbacks(approvedPollRunnable);
    }

    public static void requestBottomTarja(Context context) {
        CieloReceiptAccessibilityService svc = instance;
        if (svc == null || context == null) {
            return;
        }
        svc.runOnServiceThread(() -> CieloPaymentShieldOverlay.showBottomTarja(context));
    }

    public static void onPaymentSessionStarted() {
        CieloReceiptAccessibilityService svc = instance;
        if (svc != null) {
            svc.startApprovedPolling();
        }
    }

    private String extractEventText(AccessibilityEvent event) {
        StringBuilder sb = new StringBuilder();
        if (event.getText() != null) {
            for (CharSequence part : event.getText()) {
                if (part != null && part.length() > 0) {
                    sb.append(part).append(' ');
                }
            }
        }
        appendIfPresent(sb, event.getContentDescription());
        return normalize(sb.toString());
    }

    private void appendIfPresent(StringBuilder sb, CharSequence value) {
        if (value == null || value.length() == 0) {
            return;
        }
        if (sb.length() > 0) {
            sb.append(' ');
        }
        sb.append(value);
    }

    private String truncateForLog(String value) {
        if (value.length() <= 80) {
            return value;
        }
        return value.substring(0, 80) + "...";
    }

    private boolean isApprovedReceiptScreen(AccessibilityNodeInfo root) {
        if (root == null) {
            return false;
        }
        return looksLikeApprovedReceipt(nodeTextDeep(root));
    }

    /**
     * Tela pós-pagamento: "Aprovada …" + botão "Não imprimir".
     * Ignora telas anteriores (QR / digitar cartão / aproximar cartão).
     */
    private boolean looksLikeApprovedReceipt(String all) {
        if (all.isEmpty()) {
            return false;
        }
        if (all.contains("digitar cartao") || all.contains("digitar cartão")
                || all.contains("gerar qr") || all.contains("gerar qrcode")
                || all.contains("aproxime") || all.contains("insira")
                || all.contains("passe o cartao") || all.contains("passe o cartão")
                || all.contains("processando")) {
            return false;
        }
        if (all.contains("nao imprimir") || all.contains("não imprimir")) {
            return true;
        }
        for (String hint : PAYMENT_APPROVED_HINTS) {
            if (all.contains(hint)) {
                return true;
            }
        }
        for (String hint : PRINT_PROMPT_HINTS) {
            if (all.contains(hint)) {
                return true;
            }
        }
        return false;
    }

    /** Reinicia estado ao iniciar nova sessão de pagamento. */
    public static void resetApprovedHandling() {
        CieloPrintDismissScheduler.reset();
        CieloReceiptAccessibilityService svc = instance;
        if (svc != null) {
            svc.noPrintBurstStarted = false;
            svc.noPrintTapIndex = 0;
            svc.cieloWindowChangeCount = 0;
            svc.lastCieloWindowChangeAtMs = 0L;
            svc.nonInitialStablePolls = 0;
            svc.seenForbiddenCaptureButtons = false;
            svc.trocoBypassDone = false;
            svc.lastTrocoBypassAtMs = 0L;
            svc.mainHandler.removeCallbacks(svc.windowTransitionRunnable);
            svc.stopApprovedPolling();
        }
    }

    private void beginApprovedDismissBurst() {
        approvedDismissBurstUntilMs = System.currentTimeMillis() + APPROVED_DISMISS_BURST_MS;
    }

    private boolean isApprovedDismissBurstActive() {
        return System.currentTimeMillis() < approvedDismissBurstUntilMs;
    }

    private AccessibilityNodeInfo findDismissButtonInAllWindows() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) {
            return null;
        }
        List<android.view.accessibility.AccessibilityWindowInfo> windows = getWindows();
        if (windows == null || windows.isEmpty()) {
            return null;
        }
        AccessibilityNodeInfo best = null;
        int bestScore = -1;
        for (android.view.accessibility.AccessibilityWindowInfo window : windows) {
            if (window == null) {
                continue;
            }
            AccessibilityNodeInfo root = window.getRoot();
            if (root == null) {
                continue;
            }
            try {
                AccessibilityNodeInfo candidate = findDismissButton(root);
                if (candidate == null) {
                    continue;
                }
                int score = scoreDismissButtonText(nodeTextDeep(candidate));
                if (score > bestScore) {
                    if (best != null) {
                        best.recycle();
                    }
                    best = candidate;
                    bestScore = score;
                } else {
                    candidate.recycle();
                }
            } finally {
                root.recycle();
            }
        }
        return best;
    }

    private boolean clickNode(AccessibilityNodeInfo node) {
        if (node == null) {
            return false;
        }
        if (node.isClickable() && node.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
            return true;
        }
        AccessibilityNodeInfo clickable = findClickableTarget(node);
        if (clickable == null) {
            return performGestureClick(node);
        }
        try {
            if (clickable.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
                return true;
            }
        } finally {
            clickable.recycle();
        }
        return performGestureClick(node);
    }

    private boolean performGestureClick(AccessibilityNodeInfo node) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N || node == null) {
            return false;
        }
        Rect rect = new Rect();
        node.getBoundsInScreen(rect);
        if (rect.isEmpty()) {
            return false;
        }
        float x = rect.exactCenterX();
        float y = rect.exactCenterY();
        Path path = new Path();
        path.moveTo(x, y);
        GestureDescription.StrokeDescription stroke = new GestureDescription.StrokeDescription(path, 0L, 50L);
        GestureDescription gesture = new GestureDescription.Builder().addStroke(stroke).build();
        return dispatchGesture(gesture, null, null);
    }

    @Override
    public void onInterrupt() {
        CieloPaymentShieldOverlay.clearAll();
    }

    private void handlePaymentShield(AccessibilityNodeInfo root) {
        if (!CieloPaymentSessionHelper.shouldBlockAlternateCapture(this)
                || !CieloPaymentSessionHelper.isCardShieldEnabled(this)) {
            CieloPaymentShieldOverlay.clearBlockers();
            lastShieldSignature = "";
            return;
        }

        long now = System.currentTimeMillis();
        if (now - lastShieldUpdateAtMs < 250L) {
            return;
        }
        lastShieldUpdateAtMs = now;

        List<Rect> bounds = findForbiddenButtonBounds(root);
        String signature = boundsSignature(bounds);
        if (signature.equals(lastShieldSignature)) {
            return;
        }
        lastShieldSignature = signature;

        if (bounds.isEmpty()) {
            CieloPaymentShieldOverlay.clearBlockers();
            Log.d(TAG, "Escudo Cielo: nenhum botão alternativo detectado");
        } else {
            CieloPaymentShieldOverlay.updateBlockers(bounds);
            seenForbiddenCaptureButtons = true;
            Log.i(TAG, "Escudo Cielo ativo em " + bounds.size() + " botão(ões)");
        }
    }

    private void handleTrocoScreenBypass(AccessibilityNodeInfo root) {
        if (trocoBypassDone || !CieloPaymentSessionHelper.hasActiveSession(this)) {
            return;
        }
        String paymentCode = CieloPaymentSessionHelper.getPaymentCode(this);
        if ("PIX".equalsIgnoreCase(paymentCode)) {
            return;
        }
        long now = System.currentTimeMillis();
        if (now - lastTrocoBypassAtMs < 350L) {
            return;
        }
        lastTrocoBypassAtMs = now;

        String all = collectAllWindowsText();
        if (all.isEmpty() && root != null) {
            all = nodeTextDeep(root);
        }
        String lower = normalize(all);
        if (!lower.contains("troco")) {
            return;
        }

        AccessibilityNodeInfo confirm = findConfirmButtonInAllWindows();
        if (confirm != null) {
            try {
                if (clickNode(confirm)) {
                    trocoBypassDone = true;
                    Log.i(TAG, "Troco bypass: Confirmar via árvore (" + paymentCode + ")");
                    return;
                }
            } finally {
                confirm.recycle();
            }
        }

        // Fallback L400: firmware de produção às vezes não expõe o botão "Confirmar" na
        // árvore de acessibilidade. Toca nas coordenadas do botão (canto inferior direito
        // do teclado numérico da tela de troco). Não marca bypass como concluído — reavalia
        // na próxima varredura até a tela sair.
        tapTrocoConfirmCoordinates();
        Log.i(TAG, "Troco bypass: toque por coordenada (Confirmar) — árvore sem botão (" + paymentCode + ")");
    }

    private void tapTrocoConfirmCoordinates() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
            return;
        }
        android.util.DisplayMetrics dm = getResources().getDisplayMetrics();
        float w = dm.widthPixels;
        float h = dm.heightPixels;
        // "Confirmar" ocupa a coluna azul à direita, na parte inferior do teclado.
        dispatchTapAsync(w * 0.86f, h * 0.88f);
        mainHandler.postDelayed(() -> dispatchTapAsync(w * 0.86f, h * 0.82f), 140L);
    }

    private AccessibilityNodeInfo findConfirmButtonInAllWindows() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) {
            return null;
        }
        List<android.view.accessibility.AccessibilityWindowInfo> windows = getWindows();
        if (windows == null || windows.isEmpty()) {
            return null;
        }
        AccessibilityNodeInfo best = null;
        for (android.view.accessibility.AccessibilityWindowInfo window : windows) {
            if (window == null) {
                continue;
            }
            AccessibilityNodeInfo windowRoot = window.getRoot();
            if (windowRoot == null) {
                continue;
            }
            try {
                AccessibilityNodeInfo candidate = findConfirmButton(windowRoot);
                if (candidate != null) {
                    if (best != null) {
                        best.recycle();
                    }
                    best = candidate;
                }
            } finally {
                windowRoot.recycle();
            }
        }
        return best;
    }

    private AccessibilityNodeInfo findConfirmButton(AccessibilityNodeInfo root) {
        if (root == null) {
            return null;
        }
        List<AccessibilityNodeInfo> candidates = new ArrayList<>();
        collectConfirmButtonCandidates(root, candidates);
        AccessibilityNodeInfo best = null;
        for (AccessibilityNodeInfo node : candidates) {
            if (best != null) {
                best.recycle();
            }
            best = AccessibilityNodeInfo.obtain(node);
        }
        for (AccessibilityNodeInfo node : candidates) {
            node.recycle();
        }
        return best;
    }

    private void collectConfirmButtonCandidates(AccessibilityNodeInfo node, List<AccessibilityNodeInfo> out) {
        if (node == null) {
            return;
        }
        String combined = nodeTextDeep(node);
        if (combined.contains("confirmar") && !combined.contains("cancelar")) {
            AccessibilityNodeInfo clickable = findClickableTarget(node);
            if (clickable != null) {
                out.add(clickable);
            }
        }
        int childCount = node.getChildCount();
        for (int i = 0; i < childCount; i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                try {
                    collectConfirmButtonCandidates(child, out);
                } finally {
                    child.recycle();
                }
            }
        }
    }

    private void handleForbiddenCaptureClick(AccessibilityEvent event) {
        if (!CieloPaymentSessionHelper.shouldBlockAlternateCapture(this)) {
            return;
        }
        if (System.currentTimeMillis() - lastCardHintAtMs < 1200L) {
            return;
        }

        if (eventTextMatchesForbidden(event)) {
            Log.i(TAG, "Clique em captura alternativa (texto do evento)");
            showCardOnlyHintAndBack("forbidden-click-event");
            return;
        }

        AccessibilityNodeInfo source = event.getSource();
        if (source == null) {
            return;
        }
        try {
            AccessibilityNodeInfo walk = AccessibilityNodeInfo.obtain(source);
            while (walk != null) {
                if (nodeMatchesForbiddenCapture(walk)) {
                    Log.i(TAG, "Clique em captura alternativa (árvore)");
                    showCardOnlyHintAndBack("forbidden-click-tree");
                    return;
                }
                AccessibilityNodeInfo parent = walk.getParent();
                walk.recycle();
                walk = parent;
            }
        } finally {
            source.recycle();
        }
    }

    private boolean eventTextMatchesForbidden(AccessibilityEvent event) {
        if (event.getText() != null) {
            for (CharSequence part : event.getText()) {
                if (matchesForbiddenCaptureText(part)) {
                    return true;
                }
            }
        }
        return matchesForbiddenCaptureText(event.getContentDescription());
    }

    private void dismissCardShieldForApprovedPayment(String reason) {
        // Tarja não é removida na detecção — só pelo timer de 20s ou toque Não imprimir.
    }

    private boolean shouldDismissCardShield(AccessibilityNodeInfo root) {
        return isApprovedReceiptScreen(root);
    }

    private boolean treeContainsPaymentApproved(AccessibilityNodeInfo node) {
        if (node == null) {
            return false;
        }
        String combined = normalize(joinText(node.getText(), node.getContentDescription()));
        if (!combined.isEmpty()) {
            for (String hint : PAYMENT_APPROVED_HINTS) {
                if (combined.contains(hint)) {
                    return true;
                }
            }
        }
        int childCount = node.getChildCount();
        for (int i = 0; i < childCount; i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child == null) {
                continue;
            }
            try {
                if (treeContainsPaymentApproved(child)) {
                    return true;
                }
            } finally {
                child.recycle();
            }
        }
        return false;
    }

    private void showCardOnlyHintAndBack(String reason) {
        lastCardHintAtMs = System.currentTimeMillis();
        CieloPaymentShieldOverlay.clearBlockers();
        lastShieldSignature = "";
        Intent hint = new Intent(this, CieloCardOnlyHintActivity.class);
        hint.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(hint);
        mainHandler.postDelayed(() -> {
            try {
                performGlobalAction(GLOBAL_ACTION_BACK);
            } catch (Exception e) {
                Log.w(TAG, "BACK após " + reason + ": " + e.getMessage());
            }
        }, 150L);
    }

    private List<Rect> findForbiddenButtonBounds(AccessibilityNodeInfo root) {
        List<Rect> out = new ArrayList<>();
        collectForbiddenButtonBounds(root, out);
        return out;
    }

    private void collectForbiddenButtonBounds(AccessibilityNodeInfo node, List<Rect> out) {
        if (node == null) {
            return;
        }
        if (nodeMatchesForbiddenCapture(node)) {
            Rect rect = boundsForBlocking(node);
            if (rect != null && !rect.isEmpty() && !containsSimilarRect(out, rect)) {
                out.add(rect);
            }
        }
        int childCount = node.getChildCount();
        for (int i = 0; i < childCount; i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                try {
                    collectForbiddenButtonBounds(child, out);
                } finally {
                    child.recycle();
                }
            }
        }
    }

    private Rect boundsForBlocking(AccessibilityNodeInfo node) {
        AccessibilityNodeInfo target = findClickableTarget(node);
        if (target == null) {
            return null;
        }
        Rect rect = new Rect();
        target.getBoundsInScreen(rect);
        if (target != node) {
            target.recycle();
        }
        rect.inset(-8, -8);
        return rect;
    }

    private AccessibilityNodeInfo findClickableTarget(AccessibilityNodeInfo node) {
        AccessibilityNodeInfo walk = AccessibilityNodeInfo.obtain(node);
        AccessibilityNodeInfo best = null;
        while (walk != null) {
            if (walk.isClickable()) {
                if (best != null) {
                    best.recycle();
                }
                best = AccessibilityNodeInfo.obtain(walk);
            }
            AccessibilityNodeInfo parent = walk.getParent();
            walk.recycle();
            walk = parent;
        }
        if (best != null) {
            return best;
        }
        return AccessibilityNodeInfo.obtain(node);
    }

    private boolean containsSimilarRect(List<Rect> rects, Rect candidate) {
        for (Rect existing : rects) {
            if (Rect.intersects(existing, candidate)) {
                return true;
            }
        }
        return false;
    }

    private String boundsSignature(List<Rect> bounds) {
        if (bounds.isEmpty()) {
            return "empty";
        }
        StringBuilder sb = new StringBuilder();
        for (Rect rect : bounds) {
            sb.append(rect.left).append(',')
                .append(rect.top).append(',')
                .append(rect.right).append(',')
                .append(rect.bottom).append('|');
        }
        return sb.toString();
    }

    private boolean nodeMatchesForbiddenCapture(AccessibilityNodeInfo node) {
        return matchesForbiddenCaptureText(node.getText())
            || matchesForbiddenCaptureText(node.getContentDescription());
    }

    private boolean matchesForbiddenCaptureText(CharSequence value) {
        if (value == null || value.length() == 0) {
            return false;
        }
        String normalized = normalize(value.toString());
        for (String label : FORBIDDEN_CAPTURE_BUTTONS) {
            if (normalized.contains(label) || normalized.equals(label)) {
                return true;
            }
        }
        return false;
    }

    private boolean treeContainsAlternateCaptureScreen(AccessibilityNodeInfo node) {
        if (node == null) {
            return false;
        }
        String combined = normalize(joinText(node.getText(), node.getContentDescription()));
        if (!combined.isEmpty()) {
            for (String hint : ALTERNATE_CAPTURE_SCREEN_HINTS) {
                if (combined.contains(hint)) {
                    return true;
                }
            }
        }
        int childCount = node.getChildCount();
        for (int i = 0; i < childCount; i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child == null) {
                continue;
            }
            try {
                if (treeContainsAlternateCaptureScreen(child)) {
                    return true;
                }
            } finally {
                child.recycle();
            }
        }
        return false;
    }

    private boolean isCieloPackage(String packageName) {
        for (String allowed : CIELO_PACKAGES) {
            if (allowed.equals(packageName)) {
                return true;
            }
        }
        return false;
    }

    private boolean treeContainsPrintPrompt(AccessibilityNodeInfo node) {
        if (node == null) {
            return false;
        }
        CharSequence text = node.getText();
        CharSequence desc = node.getContentDescription();
        if (matchesPrintPrompt(text) || matchesPrintPrompt(desc)) {
            return true;
        }
        int childCount = node.getChildCount();
        for (int i = 0; i < childCount; i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child == null) {
                continue;
            }
            try {
                if (treeContainsPrintPrompt(child)) {
                    return true;
                }
            } finally {
                child.recycle();
            }
        }
        return false;
    }

    private boolean matchesPrintPrompt(CharSequence value) {
        if (value == null || value.length() == 0) {
            return false;
        }
        String normalized = normalize(value.toString());
        for (String hint : PRINT_PROMPT_HINTS) {
            if (normalized.contains(hint)) {
                return true;
            }
        }
        return false;
    }

    private AccessibilityNodeInfo findDismissButton(AccessibilityNodeInfo root) {
        if (root == null) {
            return null;
        }
        List<AccessibilityNodeInfo> candidates = new ArrayList<>();
        collectDismissButtonCandidates(root, candidates);

        AccessibilityNodeInfo best = null;
        int bestScore = -1;
        for (AccessibilityNodeInfo node : candidates) {
            String combined = nodeTextDeep(node);
            int score = scoreDismissButtonText(combined);
            if (score > bestScore) {
                if (best != null) {
                    best.recycle();
                }
                best = AccessibilityNodeInfo.obtain(node);
                bestScore = score;
            }
        }

        for (AccessibilityNodeInfo node : candidates) {
            node.recycle();
        }
        return best;
    }

    private void collectDismissButtonCandidates(AccessibilityNodeInfo node, List<AccessibilityNodeInfo> out) {
        if (node == null) {
            return;
        }
        String combined = nodeTextDeep(node);
        if (scoreDismissButtonText(combined) > 0) {
            AccessibilityNodeInfo clickable = findClickableTarget(node);
            if (clickable != null) {
                out.add(clickable);
            }
        } else if (node.isClickable() && isLikelyNoPrintButton(combined)) {
            out.add(AccessibilityNodeInfo.obtain(node));
        }
        int childCount = node.getChildCount();
        for (int i = 0; i < childCount; i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                try {
                    collectDismissButtonCandidates(child, out);
                } finally {
                    child.recycle();
                }
            }
        }
    }

    private boolean isLikelyNoPrintButton(String combined) {
        if (combined.isEmpty() || !isApprovedDismissBurstActive()) {
            return false;
        }
        return combined.contains("nao imprimir") || combined.contains("não imprimir");
    }

    private String nodeTextDeep(AccessibilityNodeInfo node) {
        if (node == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        appendNodeTextDeep(node, sb, 0);
        return normalize(sb.toString());
    }

    private void appendNodeTextDeep(AccessibilityNodeInfo node, StringBuilder sb, int depth) {
        if (node == null || depth > 8) {
            return;
        }
        appendIfPresent(sb, node.getText());
        appendIfPresent(sb, node.getContentDescription());
        int childCount = node.getChildCount();
        for (int i = 0; i < childCount; i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child == null) {
                continue;
            }
            try {
                appendNodeTextDeep(child, sb, depth + 1);
            } finally {
                child.recycle();
            }
        }
    }

    private int scoreDismissButtonText(String combined) {
        if (combined.isEmpty()) {
            return -1;
        }
        if (combined.contains("imprimir")
                && !combined.contains("nao imprimir")
                && !combined.contains("não imprimir")
                && !combined.contains("sem imprimir")
                && !combined.contains("pular impressao")
                && !combined.contains("pular impressão")) {
            return -1;
        }
        int score = -1;
        for (String label : DISMISS_BUTTON_TEXTS) {
            if (combined.contains(label)) {
                score = Math.max(score, 100 + label.length());
            }
        }
        if (score > 0) {
            return score;
        }
        if (isApprovedDismissBurstActive()
                && combined.contains("nao")
                && combined.contains("imprimir")) {
            return 90;
        }
        return -1;
    }

    private static String joinText(CharSequence a, CharSequence b) {
        if (a == null && b == null) {
            return "";
        }
        if (a == null) {
            return b.toString();
        }
        if (b == null) {
            return a.toString();
        }
        return a.toString() + " " + b.toString();
    }

    private static String normalize(String value) {
        return value.trim().toLowerCase(Locale.ROOT)
            .replace('á', 'a').replace('à', 'a').replace('ã', 'a')
            .replace('é', 'e').replace('ê', 'e')
            .replace('í', 'i')
            .replace('ó', 'o').replace('ô', 'o').replace('õ', 'o')
            .replace('ú', 'u')
            .replace('ç', 'c');
    }
}
