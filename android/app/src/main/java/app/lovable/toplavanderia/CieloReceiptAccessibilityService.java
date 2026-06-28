package app.lovable.toplavanderia;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.graphics.Rect;
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
 * 2) Em pagamento crédito/débito, cobre "Gerar QR Code" / "Digitar Cartão" com overlay
 *    e orienta o cliente a usar o leitor físico.
 */
public class CieloReceiptAccessibilityService extends AccessibilityService {
    private static final String TAG = "CieloReceiptA11y";

    private static final String[] CIELO_PACKAGES = {
        "br.com.cielosmart.payment",
        "br.com.cielosmart.service",
        "br.com.cielosmart.orderservice",
        "com.ads.lio.uriappclient",
        "cielo.smart.order.manager",
        "br.com.cielosmart.launcher"
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

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private long lastDismissAtMs = 0L;
    private long lastCardHintAtMs = 0L;
    private long lastShieldUpdateAtMs = 0L;
    private String lastShieldSignature = "";

    @Override
    public void onServiceConnected() {
        super.onServiceConnected();
        CieloPaymentShieldOverlay.bind(this);
        Log.i(TAG, "Assistente Cielo conectado (overlay + comprovante)");
    }

    @Override
    public void onDestroy() {
        CieloPaymentShieldOverlay.unbind();
        super.onDestroy();
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null) {
            return;
        }
        CharSequence pkgSeq = event.getPackageName();
        if (pkgSeq == null || !isCieloPackage(pkgSeq.toString())) {
            if (CieloPaymentSessionHelper.shouldBlockAlternateCapture(this)) {
                CieloPaymentShieldOverlay.clear();
            }
            return;
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

            if (CieloPaymentSessionHelper.shouldBlockAlternateCapture(this)
                    && treeContainsAlternateCaptureScreen(root)) {
                showCardOnlyHintAndBack("alternate-screen");
                return;
            }

            if (System.currentTimeMillis() - lastDismissAtMs < 1500L) {
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
        CieloPaymentShieldOverlay.clear();
    }

    private void handlePaymentShield(AccessibilityNodeInfo root) {
        if (!CieloPaymentSessionHelper.shouldBlockAlternateCapture(this)) {
            CieloPaymentShieldOverlay.clear();
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
            CieloPaymentShieldOverlay.clear();
            Log.d(TAG, "Escudo Cielo: nenhum botão alternativo detectado");
        } else {
            CieloPaymentShieldOverlay.updateBlockers(bounds);
            Log.i(TAG, "Escudo Cielo ativo em " + bounds.size() + " botão(ões)");
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

    private void showCardOnlyHintAndBack(String reason) {
        lastCardHintAtMs = System.currentTimeMillis();
        CieloPaymentShieldOverlay.clear();
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
