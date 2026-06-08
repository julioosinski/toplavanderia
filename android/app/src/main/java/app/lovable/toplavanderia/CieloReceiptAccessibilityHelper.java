package app.lovable.toplavanderia;

import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.provider.Settings;
import android.view.accessibility.AccessibilityManager;

import java.util.List;

public final class CieloReceiptAccessibilityHelper {
    private CieloReceiptAccessibilityHelper() {
    }

    public static boolean isServiceEnabled(Context context) {
        AccessibilityManager manager = context.getSystemService(AccessibilityManager.class);
        if (manager == null || !manager.isEnabled()) {
            return false;
        }
        String expected = new ComponentName(context, CieloReceiptAccessibilityService.class).flattenToString();
        List<AccessibilityServiceInfo> services = manager.getEnabledAccessibilityServiceList(
            AccessibilityServiceInfo.FEEDBACK_ALL_MASK
        );
        if (services == null) {
            return false;
        }
        for (AccessibilityServiceInfo info : services) {
            if (expected.equals(info.getId())) {
                return true;
            }
        }
        return false;
    }

    public static Intent buildSettingsIntent() {
        return new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
    }
}
