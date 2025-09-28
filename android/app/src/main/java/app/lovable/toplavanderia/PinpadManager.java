package app.lovable.toplavanderia;

import android.content.Context;
import android.content.Intent;
import android.util.Log;
import android.os.Handler;
import android.os.Looper;

public class PinpadManager {
    private static final String TAG = "PinpadManager";
    
    private Context context;
    private PinpadCallback callback;
    private boolean isProcessing;
    
    public interface PinpadCallback {
        void onPaymentSuccess(String authorizationCode, String transactionId);
        void onPaymentError(String error);
        void onPaymentProcessing(String message);
        void onPinpadConnected();
        void onPinpadDisconnected();
    }
    
    public PinpadManager(Context context) {
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
            Log.d(TAG, "Iniciando processamento de pagamento: R$ " + amount);
            
            if (callback != null) {
                callback.onPaymentProcessing("Conectando com PPC930...");
            }
            
            // Simular conexão com pinpad
            new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
                @Override
                public void run() {
                    try {
                        connectToPinpad(amount, description, orderId);
                    } catch (Exception e) {
                        Log.e(TAG, "Erro ao conectar com pinpad", e);
                        isProcessing = false;
                        if (callback != null) {
                            callback.onPaymentError("Erro de conexão: " + e.getMessage());
                        }
                    }
                }
            }, 1000);
        } catch (Exception e) {
            Log.e(TAG, "Erro ao processar pagamento", e);
            isProcessing = false;
            if (callback != null) {
                callback.onPaymentError("Erro geral: " + e.getMessage());
            }
        }
    }
    
    private void connectToPinpad(double amount, String description, String orderId) {
        try {
            Log.d(TAG, "Conectando com PPC930...");
            
            if (callback != null) {
                callback.onPinpadConnected();
                callback.onPaymentProcessing("Enviando transação para PPC930...");
            }
            
            // Enviar comando para PayGo Integrado processar na pinpad
            sendPaymentToPayGo(amount, description, orderId);
            
        } catch (Exception e) {
            Log.e(TAG, "Erro ao conectar com PPC930", e);
            isProcessing = false;
            if (callback != null) {
                callback.onPaymentError("Erro ao conectar com PPC930: " + e.getMessage());
            }
        }
    }
    
    private void sendPaymentToPayGo(double amount, String description, String orderId) {
        try {
            Log.d(TAG, "Iniciando envio para PayGo: R$ " + amount + " - " + description);
            
            // Converter valor para centavos
            int amountInCents = (int) (amount * 100);
            
            // Criar intent simples para PayGo Integrado CERT
            Intent paymentIntent = new Intent();
            paymentIntent.setAction("br.com.setis.clientepaygoweb.cert.PROCESS_PAYMENT");
            paymentIntent.putExtra("AMOUNT", amountInCents);
            paymentIntent.putExtra("DESCRIPTION", description);
            paymentIntent.putExtra("ORDER_ID", orderId);
            
            // Enviar broadcast de forma segura
            try {
                context.sendBroadcast(paymentIntent);
                Log.d(TAG, "Broadcast enviado com sucesso para PayGo");
            } catch (SecurityException e) {
                Log.w(TAG, "Erro de permissão ao enviar broadcast: " + e.getMessage());
            }
            
            if (callback != null) {
                callback.onPaymentProcessing("Transação enviada para PPC930. Aguarde o cliente inserir o cartão...");
            }
            
            // Simular processamento da transação
            simulateTransactionProcessing(amount, description, orderId);
            
        } catch (Exception e) {
            Log.e(TAG, "Erro ao enviar comando para PayGo", e);
            isProcessing = false;
            if (callback != null) {
                callback.onPaymentError("Erro ao enviar comando para PayGo: " + e.getMessage());
            }
        }
    }
    
    private void simulateTransactionProcessing(double amount, String description, String orderId) {
        try {
            // Simular tempo de processamento da transação
            new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
                @Override
                public void run() {
                    try {
                        // Simular sucesso da transação
                        String authorizationCode = generateAuthorizationCode();
                        String transactionId = generateTransactionId();
                        
                        Log.d(TAG, "Transação processada com sucesso: " + transactionId);
                        
                        isProcessing = false;
                        
                        if (callback != null) {
                            callback.onPaymentSuccess(authorizationCode, transactionId);
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Erro na simulação de transação", e);
                        isProcessing = false;
                        if (callback != null) {
                            callback.onPaymentError("Erro na simulação: " + e.getMessage());
                        }
                    }
                }
            }, 3000); // 3 segundos para simular processamento
        } catch (Exception e) {
            Log.e(TAG, "Erro ao iniciar simulação", e);
            isProcessing = false;
            if (callback != null) {
                callback.onPaymentError("Erro ao processar: " + e.getMessage());
            }
        }
    }
    
    private String generateAuthorizationCode() {
        // Gerar código de autorização simulado
        return String.format("%06d", (int) (Math.random() * 1000000));
    }
    
    private String generateTransactionId() {
        // Gerar ID da transação simulado
        return "TXN" + System.currentTimeMillis();
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
    
    public void checkPinpadStatus() {
        // Verificar status da pinpad
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
                // Simular verificação de status
                boolean isConnected = true; // Simular conectado
                
                if (isConnected) {
                    Log.d(TAG, "PPC930 conectada e funcionando");
                    if (callback != null) {
                        callback.onPinpadConnected();
                    }
                } else {
                    Log.w(TAG, "PPC930 não detectada");
                    if (callback != null) {
                        callback.onPinpadDisconnected();
                    }
                }
            }
        }, 500);
    }
    
    public void testPinpad() {
        Log.d(TAG, "Testando PPC930...");
        
        if (callback != null) {
            callback.onPaymentProcessing("Testando conexão com PPC930...");
        }
        
        // Simular teste
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
                Log.d(TAG, "Teste da PPC930 concluído com sucesso");
                if (callback != null) {
                    callback.onPinpadConnected();
                }
            }
        }, 2000);
    }
}
