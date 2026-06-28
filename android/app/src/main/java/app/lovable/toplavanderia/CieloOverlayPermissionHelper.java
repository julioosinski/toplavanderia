package app.lovable.toplavanderia;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;

public final class CieloOverlayPermissionHelper {
    private CieloOverlayPermissionHelper() {
    }

    public static boolean canDrawOverlays(Context context) {
        return Settings.canDrawOverlays(context.getApplicationContext());
    }

    public static Intent buildSettingsIntent(Context context) {
        return new Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:" + context.getPackageName())
        );
    }
}
