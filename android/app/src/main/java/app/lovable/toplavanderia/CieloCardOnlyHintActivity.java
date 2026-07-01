package app.lovable.toplavanderia;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * Orientação quando o assistente de acessibilidade intercepta QR/digitar cartão na Cielo.
 */
public class CieloCardOnlyHintActivity extends Activity {
    private static final String CIELO_PAYMENT_PACKAGE = "br.com.cielosmart.payment";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(48, 48, 48, 48);
        root.setBackgroundColor(Color.parseColor("#F0000000"));

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(40, 40, 40, 40);
        card.setBackgroundColor(Color.parseColor("#111827"));

        TextView title = new TextView(this);
        title.setText("Insira ou aproxime o cartão");
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 26);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setTextColor(Color.WHITE);
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, 0, 0, 32);
        card.addView(title);

        Button ok = new Button(this);
        ok.setText("Entendi — voltar ao pagamento");
        ok.setTextColor(Color.WHITE);
        ok.setBackgroundColor(Color.parseColor("#2563EB"));
        ok.setMinHeight(dp(52));
        ok.setOnClickListener(v -> returnToCieloPayment());
        card.addView(ok);

        root.addView(card);
        setContentView(root);
    }

    private void returnToCieloPayment() {
        Context app = getApplicationContext();
        boolean resumeShield = CieloPaymentSessionHelper.shouldBlockAlternateCapture(this);
        Intent cielo = getPackageManager().getLaunchIntentForPackage(CIELO_PAYMENT_PACKAGE);
        if (cielo != null) {
            cielo.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        }
        finish();
        try {
            if (cielo != null) {
                app.startActivity(cielo);
            }
            if (resumeShield && CieloPaymentSessionHelper.isCardShieldEnabled(app)) {
                new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(
                    () -> CieloReceiptAccessibilityService.requestBottomTarja(app),
                    600L
                );
            }
        } catch (Exception ignored) {
            // noop
        }
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
