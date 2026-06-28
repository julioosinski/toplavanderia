package app.lovable.toplavanderia;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Totem Cielo:
 * 1) Dispensa comprovante ("Não imprimir") quando detecta o diálogo da Cielo.
 * 2) Em pagamento crédito/débito, intercepta toques em "Gerar QR Code" / "Digitar Cartão"
 *    e exibe orientação para usar o leitor físico.
 */
public class CieloReceiptAccessibilityService extends AccessibilityService {
    private static final String TAG = "CieloReceiptA11y";

    private static final String[] CIELO_PACKAGES = {
        "br.com.cielosmart.payment",
        "com.ads.lio.uriappclient",
        "cielo.smart.order.manager",
        "br.com.cielosmart.orderservice"
    };

    private static final String[] PRINT_PROMPT_HINTS = {
        "deseja imprimir",
        "imprimir comprovante",
        "imprimir o comprovante",
        "via do cliente",
        "imprimir via"
    };

    private static final String[] DISMISS_BUTTON_TEXTS = {
        "nao imprimir",
        "não imprimir",
        "continuar sem imprimir",
        "pular impressao",
        "pular impressão"
    };

    /** Botões da Cielo que confundem em pagamento cartão (crédito/débito). */
    private static final String[] FORBIDDEN_CAPTURE_BUTTONS = {
        "gerar qr code",
        "gerar qrcode",
        "digitar cartao",
        "digitar cartão",
        "digitar o cartao",
        "digitar o cartão"
    };

    /** Telas alternativas (após toque) — voltar ao leitor de cartão. */
    private static final String[] ALTERNATE_CAPTURE_SCREEN_HINTS = {
        "digite o numero do cartao",
        "digite o número do cartão",
        "numero do cartao",
        "número do cartão",
        "escaneie o qr",
        "escaneie o qrcode",
        "leia o qr code"
    };

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private long lastDismissAtMs = 0L;
    private long lastCardHintAtMs = 0L;

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null) {
            return;
        }
        CharSequence pkgSeq = event.getPackageName();
        if (pkgSeq == null || !isCieloPackage(pkgSeq.toString())) {
            return;
        }

        int type = event.getEventType();
        if (type == AccessibilityEvent.TYPE_VIEW_CLICKED) {
            handleForbiddenCaptureClick(event);
            return;
        }

        if (type != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
                && type != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) {
            return;
        }

        if (System.currentTimeMillis() - lastDismissAtMs < 1500L) {
            return;
        }

        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) {
            return;
        }

        try {
            if (CieloPaymentSessionHelper.shouldBlockAlternateCapture(this)
                    && treeContainsAlternateCaptureScreen(root)) {
                showCardOnlyHintAndBack("alternate-screen");
                return;
            }
            if (!treeContainsPrintPrompt(root)) {
                return;
            }
            AccessibilityNodeInfo target = findDismissButton(root);
            if (target != null && target.isClickable() && target.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
                lastDismissAtMs = System.currentTimeMillis();
                Log.i(TAG, "Comprovante Cielo dispensado automaticamente");
            }
        } finally {
            root.recycle();
        }
    }

    @Override
    public void onInterrupt() {
        // noop
    }

    private void handleForbiddenCaptureClick(AccessibilityEvent event) {
        if (!CieloPaymentSessionHelper.shouldBlockAlternateCapture(this)) {
            return;
        }
        if (System.currentTimeMillis() - lastCardHintAtMs < 1200L) {
            return;
        }

        AccessibilityNodeInfo source = event.getSource();
        if (source == null) {
            return;
        }
        try {
            if (nodeMatchesForbiddenCapture(source)) {
                Log.i(TAG, "Toque bloqueado em captura alternativa Cielo");
                showCardOnlyHintAndBack("forbidden-click");
            }
        } finally {
            source.recycle();
        }
    }

    private void showCardOnlyHintAndBack(String reason) {
        lastCardHintAtMs = System.currentTimeMillis();
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

    private boolean nodeMatchesForbiddenCapture(AccessibilityNodeInfo node) {
        String combined = normalize(joinText(node.getText(), node.getContentDescription()));
        if (combined.isEmpty()) {
            return false;
        }
        for (String label : FORBIDDEN_CAPTURE_BUTTONS) {
            if (combined.contains(label) || combined.equals(label)) {
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
        List<AccessibilityNodeInfo> clickables = new ArrayList<>();
        collectClickables(root, clickables);

        AccessibilityNodeInfo best = null;
        int bestScore = -1;
        for (AccessibilityNodeInfo node : clickables) {
            int score = scoreDismissButton(node);
            if (score > bestScore) {
                if (best != null) {
                    best.recycle();
                }
                best = AccessibilityNodeInfo.obtain(node);
                bestScore = score;
            }
        }

        for (AccessibilityNodeInfo node : clickables) {
            node.recycle();
        }
        return best;
    }

    private void collectClickables(AccessibilityNodeInfo node, List<AccessibilityNodeInfo> out) {
        if (node == null) {
            return;
        }
        if (node.isClickable()) {
            out.add(AccessibilityNodeInfo.obtain(node));
        }
        int childCount = node.getChildCount();
        for (int i = 0; i < childCount; i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                collectClickables(child, out);
                child.recycle();
            }
        }
    }

    private int scoreDismissButton(AccessibilityNodeInfo node) {
        String combined = normalize(joinText(node.getText(), node.getContentDescription()));
        if (combined.isEmpty()) {
            return -1;
        }
        if (combined.contains("imprimir") && !combined.contains("nao imprimir") && !combined.contains("não imprimir")) {
            return -1;
        }
        int score = -1;
        for (String label : DISMISS_BUTTON_TEXTS) {
            if (combined.equals(label)) {
                score = Math.max(score, 120);
            }
        }
        return score;
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
