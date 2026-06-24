package app.lovable.toplavanderia;

import android.os.Build;
import android.util.Log;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.Socket;
import java.net.URL;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.security.cert.CertPath;
import java.security.cert.CertPathValidator;
import java.security.cert.CertificateException;
import java.security.cert.CertificateFactory;
import java.security.cert.PKIXParameters;
import java.security.cert.TrustAnchor;
import java.security.cert.X509Certificate;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLEngine;
import javax.net.ssl.TrustManager;
import javax.net.ssl.TrustManagerFactory;
import javax.net.ssl.X509ExtendedTrustManager;
import javax.net.ssl.X509TrustManager;

/**
 * DX8000 com relógio errado → falha OCSP ao acessar Supabase HTTPS.
 * Revalida cadeia sem revogação OCSP (mantém CAs do sistema).
 */
final class CieloSslWorkaround {
    private static final String TAG = "CieloSslWorkaround";
    private static volatile boolean initialized;
    private static volatile SSLContext lenientSslContext;

    private CieloSslWorkaround() {}

    static void ensureInitialized() {
        if (initialized) return;
        synchronized (CieloSslWorkaround.class) {
            if (initialized) return;
            try {
                System.setProperty(
                        "com.android.org.conscrypt.disableCertificateRevocationCheck",
                        "true");
            } catch (Exception ignored) {
                /* optional on some API levels */
            }
            if (isCieloTerminal()) {
                lenientSslContext = buildLenientSslContext();
                Log.i(TAG, "SSL leniente (sem OCSP) ativo no terminal Cielo");
            }
            initialized = true;
        }
    }

    static HttpURLConnection openConnection(String urlString) throws IOException {
        ensureInitialized();
        return configure((HttpURLConnection) new URL(urlString).openConnection());
    }

    static HttpURLConnection openConnection(URL url) throws IOException {
        ensureInitialized();
        return configure((HttpURLConnection) url.openConnection());
    }

    private static HttpURLConnection configure(HttpURLConnection conn) {
        if (lenientSslContext != null && conn instanceof HttpsURLConnection) {
            HttpsURLConnection https = (HttpsURLConnection) conn;
            https.setSSLSocketFactory(lenientSslContext.getSocketFactory());
            https.setHostnameVerifier(CieloSslWorkaround::verifyHostname);
        }
        return conn;
    }

    /** Supabase: confiança direta; demais hosts (ex. api.cielo.com.br): verificador padrão do sistema. */
    private static boolean verifyHostname(String hostname, javax.net.ssl.SSLSession session) {
        if (hostname == null) {
            return false;
        }
        if (hostname.endsWith(".supabase.co") || hostname.equals("supabase.co")) {
            return true;
        }
        if (hostname.endsWith(".cielo.com.br") || hostname.equals("cielo.com.br")) {
            return HttpsURLConnection.getDefaultHostnameVerifier().verify(hostname, session);
        }
        return HttpsURLConnection.getDefaultHostnameVerifier().verify(hostname, session);
    }

    static boolean isCieloTerminal() {
        String model = Build.MODEL == null ? "" : Build.MODEL.toUpperCase(Locale.US);
        String manufacturer = Build.MANUFACTURER == null ? "" : Build.MANUFACTURER.toUpperCase(Locale.US);
        return model.contains("DX8000")
                || model.contains("L300")
                || model.contains("L400")
                || manufacturer.contains("CIELO");
    }

    private static SSLContext buildLenientSslContext() {
        try {
            TrustManagerFactory tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
            tmf.init((KeyStore) null);
            final X509TrustManager systemTm = (X509TrustManager) tmf.getTrustManagers()[0];

            X509ExtendedTrustManager tm = new X509ExtendedTrustManager() {
                @Override
                public void checkClientTrusted(X509Certificate[] chain, String authType, Socket socket)
                        throws CertificateException {
                    systemTm.checkClientTrusted(chain, authType);
                }

                @Override
                public void checkClientTrusted(X509Certificate[] chain, String authType, SSLEngine engine)
                        throws CertificateException {
                    systemTm.checkClientTrusted(chain, authType);
                }

                @Override
                public void checkServerTrusted(X509Certificate[] chain, String authType, Socket socket)
                        throws CertificateException {
                    checkServerTrustedLenient(chain, authType, systemTm);
                }

                @Override
                public void checkServerTrusted(X509Certificate[] chain, String authType, SSLEngine engine)
                        throws CertificateException {
                    checkServerTrustedLenient(chain, authType, systemTm);
                }

                @Override
                public void checkClientTrusted(X509Certificate[] chain, String authType) throws CertificateException {
                    systemTm.checkClientTrusted(chain, authType);
                }

                @Override
                public void checkServerTrusted(X509Certificate[] chain, String authType) throws CertificateException {
                    checkServerTrustedLenient(chain, authType, systemTm);
                }

                @Override
                public X509Certificate[] getAcceptedIssuers() {
                    return systemTm.getAcceptedIssuers();
                }
            };

            SSLContext ctx = SSLContext.getInstance("TLS");
            ctx.init(null, new TrustManager[] { tm }, new SecureRandom());
            return ctx;
        } catch (Exception e) {
            Log.w(TAG, "Falha ao criar SSLContext leniente", e);
            return null;
        }
    }

    private static void checkServerTrustedLenient(
            X509Certificate[] chain,
            String authType,
            X509TrustManager systemTm) throws CertificateException {
        try {
            systemTm.checkServerTrusted(chain, authType);
        } catch (CertificateException e) {
            if (isLikelyOcspOrClockIssue(e)) {
                validateWithoutRevocation(chain, systemTm);
                return;
            }
            throw e;
        }
    }

    private static boolean isLikelyOcspOrClockIssue(Throwable error) {
        while (error != null) {
            String msg = error.getMessage();
            if (msg != null) {
                String lower = msg.toLowerCase(Locale.US);
                if (lower.contains("ocsp")
                        || lower.contains("validity interval")
                        || lower.contains("chain validation failed")
                        || lower.contains("revocation")) {
                    return true;
                }
            }
            error = error.getCause();
        }
        return true;
    }

    private static void validateWithoutRevocation(X509Certificate[] chain, X509TrustManager systemTm)
            throws CertificateException {
        if (chain == null || chain.length == 0) {
            throw new CertificateException("Cadeia vazia");
        }
        try {
            CertificateFactory cf = CertificateFactory.getInstance("X.509");
            CertPath certPath = cf.generateCertPath(Arrays.asList(chain));

            Set<TrustAnchor> anchors = new HashSet<>();
            for (X509Certificate issuer : systemTm.getAcceptedIssuers()) {
                anchors.add(new TrustAnchor(issuer, null));
            }

            PKIXParameters params = new PKIXParameters(anchors);
            params.setRevocationEnabled(false);

            CertPathValidator.getInstance("PKIX").validate(certPath, params);
        } catch (Exception e) {
            throw new CertificateException("Validação PKIX sem revogação falhou", e);
        }
    }
}
