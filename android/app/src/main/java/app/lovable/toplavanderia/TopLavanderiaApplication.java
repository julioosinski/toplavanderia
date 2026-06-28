package app.lovable.toplavanderia;

import android.app.Application;

/** Inicialização global — workaround SSL Cielo antes de qualquer HTTP. */
public class TopLavanderiaApplication extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        CieloSslWorkaround.ensureInitialized();
        CieloPaymentBroadcastReceiver.register(this);
    }
}
