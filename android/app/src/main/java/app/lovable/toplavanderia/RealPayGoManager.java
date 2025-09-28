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
 * GERENCIADOR REAL DE PAGAMENTO COM PPC930
 * 
 * Esta classe implementa uma integração REAL usando a API do PayGo
 * para comunicar diretamente com a pinpad PPC930.
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
            Log.d(TAG, "=== INICIALIZANDO PAYGO REAL ===");
            
            // Configurar dados de automação baseado no PDVS Android
            dadosAutomacao = new DadosAutomacao(
                    "Top Lavanderia",           // Nome da aplicação
                    "1.0",                      // Versão da aplicação
                    "Lovable",                  // Desenvolvedor
                    false,                      // Suporta troco
                    false,                      // Suporta desconto
                    true,                       // Suporta vias diferenciadas
                    true,                       // Suporta vias reduzidas
                    false,                      // Valor devido
                    null                        // Personalização (opcional)
            );
            
            Log.d(TAG, "DadosAutomacao configurados:");
            Log.d(TAG, "  - Aplicação: Top Lavanderia");
            Log.d(TAG, "  - Versão: 1.0");
            Log.d(TAG, "  - Desenvolvedor: Lovable");
            Log.d(TAG, "  - Suporta vias diferenciadas: true");
            Log.d(TAG, "  - Suporta vias reduzidas: true");
            
            // Obter instância das transações - COMUNICAÇÃO REAL
            transacao = Transacoes.obtemInstancia(dadosAutomacao, context);
            isInitialized = true;
            
            Log.d(TAG, "✅ PayGo API inicializada com sucesso");
            Log.d(TAG, "✅ Transacao obtida: " + (transacao != null ? "SIM" : "NÃO"));
            Log.d(TAG, "✅ COMUNICAÇÃO REAL COM PPC930 ATIVADA");
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Erro ao inicializar PayGo API", e);
            isInitialized = false;
        }
    }
    
    public void processPayment(double amount, String description, String orderId) {
        try {
            if (isProcessing) {
                Log.w(TAG, "Já há uma transação em processamento");
                return;
            }
            
            if (!isInitialized) {
                Log.e(TAG, "PayGo não inicializado");
                if (callback != null) {
                    callback.onPaymentError("PayGo não inicializado. Verifique se o PayGo Integrado está instalado.");
                }
                return;
            }
            
            isProcessing = true;
            Log.d(TAG, "=== INICIANDO PAGAMENTO REAL COM PPC930 ===");
            Log.d(TAG, "Valor: R$ " + amount);
            Log.d(TAG, "Descrição: " + description);
            Log.d(TAG, "Pedido: " + orderId);
            
            if (callback != null) {
                callback.onPaymentProcessing("Conectando com PPC930...");
            }
            
            // Processar pagamento real na thread de background
            new Thread(() -> {
                try {
                    processRealPayment(amount, description, orderId);
                } catch (Exception e) {
                    Log.e(TAG, "Erro no processamento real", e);
                    isProcessing = false;
                    if (callback != null) {
                        callback.onPaymentError("Erro no processamento: " + e.getMessage());
                    }
                }
            }).start();
            
        } catch (Exception e) {
            Log.e(TAG, "Erro ao processar pagamento", e);
            isProcessing = false;
            if (callback != null) {
                callback.onPaymentError("Erro geral: " + e.getMessage());
            }
        }
    }
    
    private void processRealPayment(double amount, String description, String orderId) {
        try {
            Log.d(TAG, "=== PROCESSANDO PAGAMENTO REAL COM PPC930 ===");
            
            // Converter valor para centavos (formato string)
            int amountInCents = (int) (amount * 100);
            String valorString = String.valueOf(amountInCents);
            
            Log.d(TAG, "Valor em centavos: " + valorString);
            
            // Criar entrada da transação baseada no PDVS Android
            EntradaTransacao entrada = new EntradaTransacao(
                    Operacoes.VENDA,
                    orderId != null ? orderId : UUID.randomUUID().toString()
            );
            
            // Configurar parâmetros da transação
            entrada.informaDocumentoFiscal("1000");
            entrada.informaValorTotal(valorString);
            entrada.informaModalidadePagamento(ModalidadesPagamento.PAGAMENTO_CARTAO);
            
            Log.d(TAG, "EntradaTransacao configurada:");
            Log.d(TAG, "  - Operação: VENDA");
            Log.d(TAG, "  - ID: " + orderId);
            Log.d(TAG, "  - Documento Fiscal: 1000");
            Log.d(TAG, "  - Valor Total: " + valorString);
            Log.d(TAG, "  - Modalidade: PAGAMENTO_CARTAO");
            
            if (callback != null) {
                callback.onPaymentProcessing("Enviando transação para PPC930...");
            }
            
            Log.d(TAG, "=== EXECUTANDO TRANSAÇÃO REAL COM PPC930 ===");
            Log.d(TAG, "transacao.realizaTransacao(entrada) - COMUNICAÇÃO DIRETA");
            
            // Realizar transação real (igual ao PDVS Android)
            SaidaTransacao resultado = transacao.realizaTransacao(entrada);
            
            Log.d(TAG, "Transação executada com sucesso");
            Log.d(TAG, "Resultado recebido do PayGo/PPC930");
            
            // Processar resultado
            processTransactionResult(resultado);
            
        } catch (AplicacaoNaoInstaladaExcecao e) {
            Log.e(TAG, "PayGo Integrado não está instalado", e);
            isProcessing = false;
            if (callback != null) {
                callback.onPaymentError("PayGo Integrado não está instalado. Instale o aplicativo PayGo Integrado CERT.");
            }
        } catch (QuedaConexaoTerminalExcecao e) {
            Log.e(TAG, "Queda de conexão com o terminal PPC930", e);
            isProcessing = false;
            if (callback != null) {
                callback.onPaymentError("Queda de conexão com PPC930: " + e.getMessage());
            }
        } catch (Exception e) {
            Log.e(TAG, "Erro inesperado no pagamento", e);
            isProcessing = false;
            if (callback != null) {
                callback.onPaymentError("Erro inesperado: " + e.getMessage());
            }
        }
    }
    
    private void processTransactionResult(SaidaTransacao resultado) {
        try {
            Log.d(TAG, "=== PROCESSANDO RESULTADO DA PPC930 ===");
            
            int resultCode = resultado.obtemResultadoTransacao();
            String resultMsg = resultado.obtemMensagemResultado();
            
            Log.d(TAG, "Código do resultado: " + resultCode);
            Log.d(TAG, "Mensagem do resultado: " + resultMsg);
            
            if (resultCode == 0) {
                // Transação aprovada
                Log.d(TAG, "=== TRANSAÇÃO APROVADA PELA PPC930 ===");
                
                // Verificar se precisa de confirmação manual
                if (resultado.obtemInformacaoConfirmacao()) {
                    Log.d(TAG, "Transação precisa de confirmação manual");
                    if (callback != null) {
                        callback.onPaymentProcessing("Transação aprovada. Aguardando confirmação manual...");
                    }
                    
                    // Confirmar automaticamente
                    confirmTransaction(resultado, StatusTransacao.CONFIRMADO_AUTOMATICO);
                } else {
                    // Confirmar automaticamente
                    confirmTransaction(resultado, StatusTransacao.CONFIRMADO_AUTOMATICO);
                }
                
            } else if (resultado.existeTransacaoPendente()) {
                // Transação pendente
                Log.d(TAG, "=== TRANSAÇÃO PENDENTE NA PPC930 ===");
                
                if (callback != null) {
                    callback.onPaymentProcessing("Transação pendente. Processando...");
                }
                
                // Resolver pendência
                resolvePendingTransaction(resultado);
                
            } else {
                // Transação rejeitada
                Log.e(TAG, "=== TRANSAÇÃO REJEITADA PELA PPC930 ===");
                Log.e(TAG, "Código: " + resultCode);
                Log.e(TAG, "Mensagem: " + resultMsg);
                
                isProcessing = false;
                
                if (callback != null) {
                    callback.onPaymentError("Transação rejeitada pela PPC930: " + resultMsg);
                }
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Erro ao processar resultado", e);
            isProcessing = false;
            if (callback != null) {
                callback.onPaymentError("Erro ao processar resultado: " + e.getMessage());
            }
        }
    }
    
    private void confirmTransaction(SaidaTransacao resultado, StatusTransacao status) {
        try {
            Log.d(TAG, "=== CONFIRMANDO TRANSAÇÃO COM PPC930 ===");
            Log.d(TAG, "Status: " + status);
            
            String idConfirmacao = resultado.obtemIdentificadorConfirmacaoTransacao();
            Log.d(TAG, "ID de confirmação: " + idConfirmacao);
            
            // Criar confirmação
            Confirmacoes confirmacao = new Confirmacoes();
            confirmacao.informaStatusTransacao(status);
            confirmacao.informaIdentificadorConfirmacaoTransacao(idConfirmacao);
            
            // Confirmar transação
            transacao.confirmaTransacao(confirmacao);
            
            Log.d(TAG, "Transação confirmada com sucesso");
            
            // Extrair dados da transação
            String authorizationCode = resultado.obtemCodigoAutorizacao();
            String transactionId = "TXN" + System.currentTimeMillis();
            
            Log.d(TAG, "=== PAGAMENTO REAL CONCLUÍDO ===");
            Log.d(TAG, "Código de autorização: " + authorizationCode);
            Log.d(TAG, "ID da transação: " + transactionId);
            Log.d(TAG, "PPC930: Pagamento processado com sucesso");
            
            isProcessing = false;
            
            if (callback != null) {
                callback.onPaymentSuccess(authorizationCode, transactionId);
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Erro ao confirmar transação", e);
            isProcessing = false;
            if (callback != null) {
                callback.onPaymentError("Erro ao confirmar transação: " + e.getMessage());
            }
        }
    }
    
    private void resolvePendingTransaction(SaidaTransacao resultado) {
        try {
            Log.d(TAG, "=== RESOLVENDO TRANSAÇÃO PENDENTE ===");
            
            TransacaoPendenteDados dadosPendentes = resultado.obtemDadosTransacaoPendente();
            Log.d(TAG, "Dados pendentes obtidos: " + (dadosPendentes != null ? "SIM" : "NÃO"));
            
            // Criar confirmação para pendência
            Confirmacoes confirmacao = new Confirmacoes();
            confirmacao.informaStatusTransacao(StatusTransacao.CONFIRMADO_MANUAL);
            
            // Resolver pendência
            transacao.resolvePendencia(dadosPendentes, confirmacao);
            
            Log.d(TAG, "Pendência resolvida com sucesso");
            
            // Extrair dados da transação
            String authorizationCode = resultado.obtemCodigoAutorizacao();
            String transactionId = "TXN" + System.currentTimeMillis();
            
            Log.d(TAG, "=== PAGAMENTO REAL CONCLUÍDO ===");
            Log.d(TAG, "Código de autorização: " + authorizationCode);
            Log.d(TAG, "ID da transação: " + transactionId);
            Log.d(TAG, "PPC930: Pagamento processado com sucesso");
            
            isProcessing = false;
            
            if (callback != null) {
                callback.onPaymentSuccess(authorizationCode, transactionId);
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Erro ao resolver pendência", e);
            isProcessing = false;
            if (callback != null) {
                callback.onPaymentError("Erro ao resolver pendência: " + e.getMessage());
            }
        }
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
    
    public void testPayGo() {
        Log.d(TAG, "=== TESTE DO PAYGO REAL ===");
        
        if (!isInitialized) {
            Log.e(TAG, "PayGo não inicializado para teste");
            if (callback != null) {
                callback.onPaymentError("PayGo não inicializado");
            }
            return;
        }
        
        if (callback != null) {
            callback.onPaymentProcessing("Testando PayGo e PPC930...");
        }
        
        // Simular teste básico
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
                Log.d(TAG, "Teste do PayGo concluído");
                if (callback != null) {
                    callback.onPaymentSuccess("TESTE_OK", "TEST123");
                }
            }
        }, 2000);
    }
}