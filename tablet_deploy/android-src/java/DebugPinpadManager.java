package app.lovable.toplavanderia;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.util.Log;
import android.os.Handler;
import android.os.Looper;

public class DebugPinpadManager {
    private static final String TAG = "DebugPinpadManager";
    
    private Context context;
    private PinpadCallback callback;
    private boolean isProcessing;
    
    public interface PinpadCallback {
        void onPaymentSuccess(String authorizationCode, String transactionId);
        void onPaymentError(String error);
        void onPaymentProcessing(String message);
    }
    
    public DebugPinpadManager(Context context) {
        this.context = context;
        this.isProcessing = false;
    }
    
    public void setCallback(PinpadCallback callback) {
        this.callback = callback;
    }
    
    public boolean isProcessing() {
        return isProcessing;
    }
    
    public void processPayment(double amount, String description, String orderId) {
        try {
            if (isProcessing) {
                Log.w(TAG, "Já há uma transação em processamento");
                return;
            }
            
            isProcessing = true;
            Log.d(TAG, "=== DEBUG: INICIANDO PAGAMENTO ===");
            Log.d(TAG, "Valor: R$ " + amount);
            Log.d(TAG, "Descrição: " + description);
            Log.d(TAG, "Pedido: " + orderId);
            
            // Verificar se PayGo está instalado
            checkPayGoInstallation();
            
            if (callback != null) {
                callback.onPaymentProcessing("Verificando PayGo e PPC930...");
            }
            
            // Tentar múltiplas abordagens
            tryMultipleApproaches(amount, description, orderId);
            
        } catch (Exception e) {
            Log.e(TAG, "Erro ao processar pagamento", e);
            isProcessing = false;
            if (callback != null) {
                callback.onPaymentError("Erro geral: " + e.getMessage());
            }
        }
    }
    
    private void checkPayGoInstallation() {
        Log.d(TAG, "=== VERIFICANDO INSTALAÇÃO DO PAYGO ===");
        
        try {
            // Verificar PayGo Integrado CERT
            context.getPackageManager().getPackageInfo("br.com.setis.clientepaygoweb.cert", 0);
            Log.d(TAG, "✅ PayGo Integrado CERT está instalado");
        } catch (PackageManager.NameNotFoundException e) {
            Log.w(TAG, "❌ PayGo Integrado CERT não encontrado");
        }
        
        try {
            // Verificar PayGo Integrado PROD
            context.getPackageManager().getPackageInfo("br.com.setis.clientepaygoweb", 0);
            Log.d(TAG, "✅ PayGo Integrado PROD está instalado");
        } catch (PackageManager.NameNotFoundException e) {
            Log.w(TAG, "❌ PayGo Integrado PROD não encontrado");
        }
    }
    
    private void tryMultipleApproaches(double amount, String description, String orderId) {
        Log.d(TAG, "=== TENTANDO MÚLTIPLAS ABORDAGENS ===");
        
        // Abordagem 1: Broadcast para PayGo Integrado CERT
        tryApproach1(amount, description, orderId);
        
        // Abordagem 2: Intent direto para PayGo
        tryApproach2(amount, description, orderId);
        
        // Abordagem 3: Broadcast genérico
        tryApproach3(amount, description, orderId);
    }
    
    private void tryApproach1(double amount, String description, String orderId) {
        try {
            Log.d(TAG, "--- ABORDAGEM 1: Broadcast PayGo Integrado CERT ---");
            
            int amountInCents = (int) (amount * 100);
            
            Intent intent = new Intent();
            intent.setAction("br.com.setis.clientepaygoweb.cert.PROCESS_PAYMENT");
            intent.putExtra("AMOUNT", amountInCents);
            intent.putExtra("DESCRIPTION", description);
            intent.putExtra("ORDER_ID", orderId);
            intent.putExtra("CURRENCY", "BRL");
            intent.putExtra("PAYMENT_TYPE", "CREDIT");
            intent.putExtra("PINPAD_MODEL", "PPC930");
            
            Log.d(TAG, "Enviando broadcast 1...");
            context.sendBroadcast(intent);
            Log.d(TAG, "✅ Broadcast 1 enviado com sucesso");
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Erro na abordagem 1", e);
        }
    }
    
    private void tryApproach2(double amount, String description, String orderId) {
        try {
            Log.d(TAG, "--- ABORDAGEM 2: Intent direto para PayGo ---");
            
            int amountInCents = (int) (amount * 100);
            
            Intent intent = new Intent();
            intent.setPackage("br.com.setis.clientepaygoweb.cert");
            intent.setAction("br.com.setis.clientepaygoweb.cert.PROCESS_PAYMENT");
            intent.putExtra("AMOUNT", amountInCents);
            intent.putExtra("DESCRIPTION", description);
            intent.putExtra("ORDER_ID", orderId);
            
            Log.d(TAG, "Enviando intent direto...");
            context.startActivity(intent);
            Log.d(TAG, "✅ Intent direto enviado com sucesso");
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Erro na abordagem 2", e);
        }
    }
    
    private void tryApproach3(double amount, String description, String orderId) {
        try {
            Log.d(TAG, "--- ABORDAGEM 3: Broadcast genérico ---");
            
            int amountInCents = (int) (amount * 100);
            
            Intent intent = new Intent();
            intent.setAction("com.paygo.PROCESS_PAYMENT");
            intent.putExtra("amount", amountInCents);
            intent.putExtra("description", description);
            intent.putExtra("order_id", orderId);
            intent.putExtra("currency", "BRL");
            
            Log.d(TAG, "Enviando broadcast genérico...");
            context.sendBroadcast(intent);
            Log.d(TAG, "✅ Broadcast genérico enviado com sucesso");
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Erro na abordagem 3", e);
        }
    }
    
    public void testPinpad() {
        Log.d(TAG, "=== TESTE COMPLETO DA PPC930 ===");
        
        if (callback != null) {
            callback.onPaymentProcessing("Iniciando teste completo da PPC930...");
        }
        
        // Teste 1: Verificar PayGo
        checkPayGoInstallation();
        
        // Teste 2: Enviar broadcast de teste
        try {
            Intent testIntent = new Intent();
            testIntent.setAction("br.com.setis.clientepaygoweb.cert.TEST_PINPAD");
            testIntent.putExtra("PINPAD_MODEL", "PPC930");
            context.sendBroadcast(testIntent);
            Log.d(TAG, "✅ Broadcast de teste enviado");
        } catch (Exception e) {
            Log.e(TAG, "❌ Erro no broadcast de teste", e);
        }
        
        // Teste 3: Simular resultado
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
                Log.d(TAG, "=== RESULTADO DO TESTE ===");
                Log.d(TAG, "Status: Teste concluído");
                Log.d(TAG, "Verifique se a PPC930 respondeu");
                
                if (callback != null) {
                    callback.onPaymentSuccess("TESTE_OK", "TEST123");
                }
            }
        }, 3000);
    }
    
    public void cancelPayment() {
        if (isProcessing) {
            Log.d(TAG, "Cancelando transação...");
            isProcessing = false;
            
            if (callback != null) {
                callback.onPaymentError("Transação cancelada pelo usuário");
            }
        }
    }
}
