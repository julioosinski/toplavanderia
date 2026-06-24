package app.lovable.toplavanderia;

import android.content.Context;
import android.util.Log;

/**
 * Cielo/Buzios recusa o mesmo cartão com o mesmo valor em sequência (erro -4281).
 * Rotaciona +0/+1/+2 centavos no valor enviado ao terminal para cada nova cobrança.
 */
final class CieloAmountDedup {
    private static final String TAG = "CieloAmountDedup";
    private static final String PREFS = "cielo_amount_dedup";
    private static final String KEY_SEQ = "seq";
    /** Offsets 0, 1 e 2 centavos — nunca repete o valor da cobrança anterior. */
    private static final int OFFSET_SLOTS = 3;

    private CieloAmountDedup() {
    }

    static long chargeCents(Context context, long baseCents) {
        if (baseCents <= 0) {
            return baseCents;
        }
        Context app = context.getApplicationContext();
        int seq = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getInt(KEY_SEQ, 0);
        int offset = seq % OFFSET_SLOTS;
        int nextSeq = (seq + 1) % OFFSET_SLOTS;
        app.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putInt(KEY_SEQ, nextSeq).apply();
        long charged = baseCents + offset;
        if (offset > 0) {
            Log.i(TAG, "Anti-duplicidade Cielo: base=" + baseCents + " cobrado=" + charged + " (+" + offset + " centavo(s))");
        }
        return charged;
    }
}
