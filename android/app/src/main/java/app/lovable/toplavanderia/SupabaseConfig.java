package app.lovable.toplavanderia;

import java.net.HttpURLConnection;

final class SupabaseConfig {
    static final String SUPABASE_URL = BuildConfig.SUPABASE_URL;
    static final String SUPABASE_ANON_KEY = BuildConfig.SUPABASE_ANON_KEY;

    private SupabaseConfig() {}

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
