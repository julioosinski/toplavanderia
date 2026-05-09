package app.lovable.toplavanderia;

import java.net.HttpURLConnection;

final class SupabaseConfig {
    private static final String DEFAULT_SUPABASE_URL = "https://rkdybjzwiwwqqzjfmerm.supabase.co";
    private static final String DEFAULT_SUPABASE_ANON_KEY =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZHlianp3aXd3cXF6amZtZXJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMDgxNjcsImV4cCI6MjA2ODg4NDE2N30.CnRP8lrmGmvcbHmWdy72ZWlfZ28cDdNoxdADnyFAOXg";
    static final String SUPABASE_URL = normalizeUrl(selectValue(BuildConfig.SUPABASE_URL, DEFAULT_SUPABASE_URL));
    static final String SUPABASE_ANON_KEY = selectValue(BuildConfig.SUPABASE_ANON_KEY, DEFAULT_SUPABASE_ANON_KEY);

    private SupabaseConfig() {}

    private static String selectValue(String primary, String fallback) {
        if (primary != null && !primary.trim().isEmpty()) {
            return primary.trim();
        }
        return fallback;
    }

    private static String normalizeUrl(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        if (trimmed.endsWith("/")) {
            return trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }

    static void applyJsonHeaders(HttpURLConnection connection) {
        connection.setRequestProperty("apikey", SUPABASE_ANON_KEY);
        connection.setRequestProperty("Authorization", "Bearer " + SUPABASE_ANON_KEY);
        connection.setRequestProperty("Content-Type", "application/json");
    }

    static boolean isConfigured() {
        return SUPABASE_URL != null && !SUPABASE_URL.isEmpty()
            && SUPABASE_ANON_KEY != null && !SUPABASE_ANON_KEY.isEmpty();
    }
}
