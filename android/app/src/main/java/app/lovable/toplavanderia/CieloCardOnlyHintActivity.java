package app.lovable.toplavanderia;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * Orientação exibida quando o cliente toca em QR Code ou digitar cartão no app Cielo
 * (pagamento crédito/débito — use aproximação ou inserção no leitor).
 */
public class CieloCardOnlyHintActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(48, 48, 48, 48);
        root.setBackgroundColor(Color.parseColor("#E6000000"));

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(40, 40, 40, 40);
        card.setBackgroundColor(Color.parseColor("#1E293B"));

        TextView title = new TextView(this);
        title.setText("Use o leitor de cartão");
        title.setTextSize(22f);
        title.setTextColor(Color.WHITE);
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, 0, 0, 24);
        card.addView(title);

        TextView body = new TextView(this);
        body.setText(
            "Para este pagamento, aproxime, insira ou passe o cartão no leitor da maquininha.\n\n"
                + "Não é necessário gerar QR Code nem digitar o número do cartão."
        );
        body.setTextSize(17f);
        body.setTextColor(Color.parseColor("#CBD5E1"));
        body.setGravity(Gravity.CENTER);
        body.setLineSpacing(6f, 1f);
        body.setPadding(0, 0, 0, 32);
        card.addView(body);

        Button ok = new Button(this);
        ok.setText("Entendi — voltar ao pagamento");
        ok.setTextColor(Color.WHITE);
        ok.setBackgroundColor(Color.parseColor("#2563EB"));
        ok.setOnClickListener(v -> finish());
        card.addView(ok);

        root.addView(card);
        setContentView(root);
    }
}
