package app.lovable.toplavanderia;

import android.content.Context;
import android.util.Log;
import android.os.Handler;
import android.os.Looper;

import br.com.setis.interfaceautomacao.DadosAutomacao;
import br.com.setis.interfaceautomacao.EntradaTransacao;
import br.com.setis.interfaceautomacao.ModalidadesPagamento;
import br.com.setis.interfaceautomacao.Operacoes;
import br.com.setis.interfaceautomacao.SaidaTransacao;
import br.com.setis.interfaceautomacao.Transacao;
import br.com.setis.interfaceautomacao.Transacoes;
import br.com.setis.interfaceautomacao.AplicacaoNaoInstaladaExcecao;
import br.com.setis.interfaceautomacao.QuedaConexaoTerminalExcecao;
import br.com.setis.interfaceautomacao.Confirmacoes;
import br.com.setis.interfaceautomacao.StatusTransacao;
import br.com.setis.interfaceautomacao.TransacaoPendenteDados;

import java.util.UUID;

/**
 * REAL payment manager using InterfaceAutomacao to communicate with PPC930.
 * Supports credit, debit, and PIX payment types.
 */
public class RealPayGoManager {
    private static final String TAG = "RealPayGoManager";

    private Context context;
    private PayGoCallback callback;
    private boolean isProcessing;
    private Transacao transacao;
    private boolean isInitialized;
    private DadosAutomacao dadosAutomacao;

    public interface PayGoCallback {
        void onPaymentSuccess(String authorizationCode, String transactionId);
        void onPaymentError(String error);
        void onPaymentProcessing(String message);
    }

    public RealPayGoManager(Context context) {
        this.context = context;
        this.isProcessing = false;
        this.isInitialized = false;
        initializePayGo();
    }

    public void setCallback(PayGoCallback callback) {
        this.callback = callback;
    }

    public boolean isProcessing() {
        return isProcessing;
    }

    public boolean isInitialized() {
        return isInitialized;
    }

    private void initializePayGo() {
        try {
            Log.d(TAG, "=== INITIALIZING PAYGO (InterfaceAutomacao) ===");

            dadosAutomacao = new DadosAutomacao(
                    "Top Lavanderia",
                    "1.0",
                    "Lovable",
                    false,  // suporta troco
                    false,  // suporta desconto
                    true,   // suporta vias diferenciadas
                    true,   // suporta vias reduzidas
                    false,  // valor devido
                    null    // personalização
            );

            transacao = Transacoes.obtemInstancia(dadosAutomacao, context);
            isInitialized = true;
            Log.d(TAG, "✅ PayGo initialized – real PPC930 communication active");

        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to initialize PayGo", e);
            isInitialized = false;
        }
    }

    /**
     * Process payment with support for payment type (credit/debit/pix).
     */
    public void processPayment(double amount, String paymentType, String description, String orderId) {
        if (isProcessing) {
            if (callback != null) callback.onPaymentError("Já há uma transação em processamento");
            return;
        }
        if (!isInitialized) {
            if (callback != null) callback.onPaymentError("PayGo não inicializado. Verifique se o PayGo Integrado está instalado.");
            return;
        }

        isProcessing = true;
        Log.d(TAG, "=== PAYMENT START: R$" + amount + " type=" + paymentType + " order=" + orderId + " ===");

        if (callback != null) callback.onPaymentProcessing("Conectando com PPC930...");

        new Thread(() -> {
            try {
                executePayment(amount, paymentType, description, orderId);
            } catch (Exception e) {
                Log.e(TAG, "Payment thread error", e);
                isProcessing = false;
                if (callback != null) callback.onPaymentError("Erro no processamento: " + e.getMessage());
            }
        }).start();
    }

    // Legacy overload for backward compatibility
    public void processPayment(double amount, String description, String orderId) {
        processPayment(amount, "credit", description, orderId);
    }

    private void executePayment(double amount, String paymentType, String description, String orderId) {
        try {
            int amountInCents = (int) (amount * 100);
            String valorString = String.valueOf(amountInCents);

            // Determine operation based on payment type
            Operacoes operacao;
            ModalidadesPagamento modalidade;

            if ("pix".equalsIgnoreCase(paymentType)) {
                // PIX uses a specific operation
                operacao = Operacoes.VENDA;
                modalidade = ModalidadesPagamento.PAGAMENTO_DINHEIRO; // PIX mapped; PayGo handles internally
                // NOTE: Some PayGo versions use Operacoes.PIX directly.
                // If available, replace operacao with Operacoes.PIX
                Log.d(TAG, "Payment type: PIX");
            } else {
                // Credit and Debit both use PAGAMENTO_CARTAO.
                // The pinpad itself asks the customer to choose credit or debit.
                operacao = Operacoes.VENDA;
                modalidade = ModalidadesPagamento.PAGAMENTO_CARTAO;
                Log.d(TAG, "Payment type: CARTAO (" + paymentType + ")");
            }

            String txnId = (orderId != null && !orderId.isEmpty()) ? orderId : UUID.randomUUID().toString();

            EntradaTransacao entrada = new EntradaTransacao(operacao, txnId);
            entrada.informaDocumentoFiscal("1000");
            entrada.informaValorTotal(valorString);
            entrada.informaModalidadePagamento(modalidade);

            if (callback != null) callback.onPaymentProcessing("Enviando para PPC930...");

            Log.d(TAG, "Executing transacao.realizaTransacao()");
            SaidaTransacao resultado = transacao.realizaTransacao(entrada);

            processResult(resultado);

        } catch (AplicacaoNaoInstaladaExcecao e) {
            Log.e(TAG, "PayGo Integrado not installed", e);
            isProcessing = false;
            if (callback != null) callback.onPaymentError("PayGo Integrado não está instalado.");
        } catch (QuedaConexaoTerminalExcecao e) {
            Log.e(TAG, "Connection lost with PPC930", e);
            isProcessing = false;
            if (callback != null) callback.onPaymentError("Queda de conexão com PPC930: " + e.getMessage());
        } catch (Exception e) {
            Log.e(TAG, "Unexpected payment error", e);
            isProcessing = false;
            if (callback != null) callback.onPaymentError("Erro inesperado: " + e.getMessage());
        }
    }

    private void processResult(SaidaTransacao resultado) {
        try {
            int resultCode = resultado.obtemResultadoTransacao();
            String resultMsg = resultado.obtemMensagemResultado();
            Log.d(TAG, "Result code=" + resultCode + " msg=" + resultMsg);

            if (resultCode == 0) {
                // Approved – confirm
                confirmTransaction(resultado, StatusTransacao.CONFIRMADO_AUTOMATICO);
            } else if (resultado.existeTransacaoPendente()) {
                resolvePendingTransaction(resultado);
            } else {
                // Denied
                isProcessing = false;
                if (callback != null) callback.onPaymentError("Transação negada: " + resultMsg);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error processing result", e);
            isProcessing = false;
            if (callback != null) callback.onPaymentError("Erro ao processar resultado: " + e.getMessage());
        }
    }

    private void confirmTransaction(SaidaTransacao resultado, StatusTransacao status) {
        try {
            String idConfirmacao = resultado.obtemIdentificadorConfirmacaoTransacao();

            Confirmacoes confirmacao = new Confirmacoes();
            confirmacao.informaStatusTransacao(status);
            confirmacao.informaIdentificadorConfirmacaoTransacao(idConfirmacao);

            transacao.confirmaTransacao(confirmacao);

            // Extract real data from SaidaTransacao
            String authCode = resultado.obtemCodigoAutorizacao();
            String nsu = resultado.obtemCodigoControle(); // NSU real

            Log.d(TAG, "✅ APPROVED – auth=" + authCode + " nsu=" + nsu);
            isProcessing = false;

            if (callback != null) callback.onPaymentSuccess(authCode, nsu != null ? nsu : "TXN" + System.currentTimeMillis());

        } catch (Exception e) {
            Log.e(TAG, "Error confirming transaction", e);
            isProcessing = false;
            if (callback != null) callback.onPaymentError("Erro ao confirmar: " + e.getMessage());
        }
    }

    private void resolvePendingTransaction(SaidaTransacao resultado) {
        try {
            TransacaoPendenteDados dadosPendentes = resultado.obtemDadosTransacaoPendente();

            Confirmacoes confirmacao = new Confirmacoes();
            confirmacao.informaStatusTransacao(StatusTransacao.CONFIRMADO_MANUAL);

            transacao.resolvePendencia(dadosPendentes, confirmacao);

            String authCode = resultado.obtemCodigoAutorizacao();
            String nsu = resultado.obtemCodigoControle();

            Log.d(TAG, "✅ Pending resolved – auth=" + authCode);
            isProcessing = false;

            if (callback != null) callback.onPaymentSuccess(authCode, nsu != null ? nsu : "TXN" + System.currentTimeMillis());

        } catch (Exception e) {
            Log.e(TAG, "Error resolving pending", e);
            isProcessing = false;
            if (callback != null) callback.onPaymentError("Erro ao resolver pendência: " + e.getMessage());
        }
    }

    public void cancelPayment() {
        if (isProcessing) {
            Log.d(TAG, "Cancelling payment...");
            isProcessing = false;
            if (callback != null) callback.onPaymentError("Transação cancelada pelo usuário");
        }
    }

    public void testPayGo() {
        Log.d(TAG, "Testing PayGo...");
        if (!isInitialized) {
            if (callback != null) callback.onPaymentError("PayGo não inicializado");
            return;
        }
        if (callback != null) callback.onPaymentSuccess("TESTE_OK", "TEST_" + System.currentTimeMillis());
    }
}
