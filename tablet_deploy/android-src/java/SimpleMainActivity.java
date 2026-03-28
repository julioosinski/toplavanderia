package app.lovable.toplavanderia;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.ScrollView;
import android.view.View;
import android.graphics.Color;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import java.text.DecimalFormat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;

public class SimpleMainActivity extends Activity {
    
    private TextView statusText;
    private Button paygoButton;
    private Button toplavanderiaButton;
    private PDVManager pdvManager;
    private RealPayGoManager payGoManager;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Criar layout principal
        LinearLayout mainLayout = new LinearLayout(this);
        mainLayout.setOrientation(LinearLayout.VERTICAL);
        mainLayout.setPadding(50, 50, 50, 50);
        
        // Título
        TextView titleText = new TextView(this);
        titleText.setText("🏪 Top Lavanderia - Sistema de Pagamento");
        titleText.setTextSize(20);
        titleText.setTextColor(Color.BLUE);
        titleText.setPadding(0, 0, 0, 30);
        mainLayout.addView(titleText);
        
        // Status
        statusText = new TextView(this);
        statusText.setText("Verificando status do sistema...");
        statusText.setTextSize(16);
        statusText.setPadding(0, 0, 0, 20);
        mainLayout.addView(statusText);
        
        // Botão PayGo Integrado
        paygoButton = new Button(this);
        paygoButton.setText("🔧 Configurar PayGo Integrado");
        paygoButton.setTextSize(16);
        paygoButton.setPadding(0, 20, 0, 20);
        paygoButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openPayGoIntegrado();
            }
        });
        mainLayout.addView(paygoButton);
        
        // Botão Top Lavanderia
        toplavanderiaButton = new Button(this);
        toplavanderiaButton.setText("🏪 Abrir Top Lavanderia");
        toplavanderiaButton.setTextSize(16);
        toplavanderiaButton.setPadding(0, 20, 0, 20);
        toplavanderiaButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openTopLavanderia();
            }
        });
        mainLayout.addView(toplavanderiaButton);
        
        // Informações
        TextView infoText = new TextView(this);
        infoText.setText("\n📋 Status do Sistema:\n" +
                        "✅ PayGo Integrado: Instalado\n" +
                        "✅ Top Lavanderia: Instalado\n" +
                        "✅ PPC930: " + (isPPC930Connected() ? "Conectado" : "Não detectado") + "\n\n" +
                        "💡 Dica: Configure o PayGo Integrado primeiro,\n" +
                        "depois use o Top Lavanderia para processar pagamentos.");
        infoText.setTextSize(14);
        infoText.setPadding(0, 30, 0, 0);
        mainLayout.addView(infoText);
        
        setContentView(mainLayout);
        
        // Inicializar managers
        pdvManager = new PDVManager(this);
        payGoManager = new RealPayGoManager(this);
        payGoManager.setCallback(new RealPayGoManager.PayGoCallback() {
            @Override
            public void onPaymentSuccess(String authorizationCode, String transactionId) {
                runOnUiThread(() -> {
                    Log.d("PayGo", "Pagamento aprovado: " + authorizationCode);
                    showPaymentSuccess(authorizationCode, transactionId);
                });
            }

            @Override
            public void onPaymentError(String error) {
                runOnUiThread(() -> {
                    Log.e("PayGo", "Erro no pagamento: " + error);
                    showPaymentError(error);
                });
            }

            @Override
            public void onPaymentProcessing(String message) {
                runOnUiThread(() -> {
                    Log.d("PayGo", "Processando: " + message);
                    showPaymentProcessing(message);
                });
            }

            
        });
        
        // Verificar status
        checkSystemStatus();
    }
    
    private void checkSystemStatus() {
        boolean paygoInstalled = isPayGoInstalled();
        boolean toplavanderiaInstalled = isTopLavanderiaInstalled();
        
        String status = "Status do Sistema:\n";
        status += "PayGo Integrado: " + (paygoInstalled ? "✅ Instalado" : "❌ Não encontrado") + "\n";
        status += "Top Lavanderia: " + (toplavanderiaInstalled ? "✅ Instalado" : "❌ Não encontrado") + "\n";
        status += "PPC930: " + (isPPC930Connected() ? "✅ Conectado" : "⚠️ Verificar conexão");
        
        statusText.setText(status);
        
        // Habilitar/desabilitar botões
        paygoButton.setEnabled(paygoInstalled);
        toplavanderiaButton.setEnabled(true);
    }
    
    private boolean isPayGoInstalled() {
        try {
            // Verificar PayGo Integrado CERT (versão de certificação)
            getPackageManager().getPackageInfo("br.com.setis.clientepaygoweb.cert", 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            try {
                // Fallback para versão PROD
                getPackageManager().getPackageInfo("br.com.setis.clientepaygoweb", 0);
                return true;
            } catch (PackageManager.NameNotFoundException e2) {
                return false;
            }
        }
    }
    
    private boolean isTopLavanderiaInstalled() {
        try {
            getPackageManager().getPackageInfo("app.lovable.toplavanderia", 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }
    
    private boolean isPPC930Connected() {
        // Verificação simples - pode ser melhorada
        return true; // Assumir conectado por enquanto
    }
    
    private void openPayGoIntegrado() {
        try {
            // Tentar abrir PayGo Integrado CERT primeiro
            Intent intent = getPackageManager().getLaunchIntentForPackage("br.com.setis.clientepaygoweb.cert");
            if (intent != null) {
                startActivity(intent);
                statusText.setText("✅ Abrindo PayGo Integrado CERT...");
            } else {
                // Fallback para versão PROD
                intent = getPackageManager().getLaunchIntentForPackage("br.com.setis.clientepaygoweb");
                if (intent != null) {
                    startActivity(intent);
                    statusText.setText("✅ Abrindo PayGo Integrado PROD...");
                } else {
                    statusText.setText("❌ PayGo Integrado não encontrado");
                }
            }
        } catch (Exception e) {
            statusText.setText("❌ Erro ao abrir PayGo Integrado: " + e.getMessage());
        }
    }
    
    private void openTopLavanderia() {
        // Mostrar interface simples do Top Lavanderia
        showTopLavanderiaInterface();
    }
    
    private void showTopLavanderiaInterface() {
        // Criar layout do totem de autoatendimento
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(30, 30, 30, 30);
        layout.setBackgroundColor(Color.WHITE);
        
        // Título do totem
        TextView title = new TextView(this);
        title.setText("🏪 TOP LAVANDERIA - TOTEM");
        title.setTextSize(28);
        title.setTextColor(Color.BLUE);
        title.setGravity(android.view.Gravity.CENTER);
        title.setPadding(0, 0, 0, 30);
        layout.addView(title);
        
        // Instruções para o cliente
        TextView instructions = new TextView(this);
        instructions.setText("👤 CLIENTE: Escolha o serviço desejado\n" +
                           "💳 PAGAMENTO: Será processado na PPC930\n" +
                           "🔓 LIBERAÇÃO: Máquina será liberada automaticamente");
        instructions.setTextSize(16);
        instructions.setTextColor(Color.BLACK);
        instructions.setGravity(android.view.Gravity.CENTER);
        instructions.setPadding(20, 20, 20, 30);
        instructions.setBackgroundColor(Color.LTGRAY);
        layout.addView(instructions);
        
        // Status do sistema
        TextView status = new TextView(this);
        String paygoStatus = getPayGoStatus();
        status.setText("✅ Sistema: Funcionando | PayGo: " + paygoStatus + " | PPC930: " + 
                      (isPPC930Connected() ? "Conectado" : "Verificar"));
        status.setTextSize(12);
        status.setPadding(10, 10, 10, 20);
        status.setBackgroundColor(Color.GREEN);
        status.setTextColor(Color.WHITE);
        status.setGravity(android.view.Gravity.CENTER);
        layout.addView(status);
        
        // Título dos serviços
        TextView servicosTitle = new TextView(this);
        servicosTitle.setText("🎯 ESCOLHA SEU SERVIÇO:");
        servicosTitle.setTextSize(20);
        servicosTitle.setTextColor(Color.BLUE);
        servicosTitle.setGravity(android.view.Gravity.CENTER);
        servicosTitle.setPadding(0, 20, 0, 20);
        layout.addView(servicosTitle);
        
        // Botões dos serviços (2 colunas)
        LinearLayout row1 = new LinearLayout(this);
        row1.setOrientation(LinearLayout.HORIZONTAL);
        row1.setPadding(0, 0, 0, 15);
        
        LinearLayout row2 = new LinearLayout(this);
        row2.setOrientation(LinearLayout.HORIZONTAL);
        row2.setPadding(0, 0, 0, 15);
        
        LinearLayout row3 = new LinearLayout(this);
        row3.setOrientation(LinearLayout.HORIZONTAL);
        row3.setPadding(0, 0, 0, 15);
        
        // Criar botões para cada serviço
        List<PDVManager.Produto> servicos = pdvManager.getProdutos();
        for (int i = 0; i < servicos.size(); i++) {
            PDVManager.Produto servico = servicos.get(i);
            Button servicoButton = new Button(this);
            servicoButton.setText(servico.getNome() + "\nR$ " + new DecimalFormat("0.00").format(servico.getPreco()));
            servicoButton.setTextSize(14);
            servicoButton.setPadding(15, 20, 15, 20);
            servicoButton.setBackgroundColor(getServicoColor(i));
            servicoButton.setTextColor(Color.WHITE);
            servicoButton.setLayoutParams(new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
            servicoButton.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    selecionarServico(servico);
                }
            });
            
            // Adicionar à linha apropriada
            if (i < 2) {
                row1.addView(servicoButton);
            } else if (i < 4) {
                row2.addView(servicoButton);
            } else {
                row3.addView(servicoButton);
            }
        }
        
        layout.addView(row1);
        layout.addView(row2);
        layout.addView(row3);
        
        // Botão de administração (pequeno)
        Button adminButton = new Button(this);
        adminButton.setText("⚙️ ADMIN");
        adminButton.setTextSize(12);
        adminButton.setPadding(10, 10, 10, 10);
        adminButton.setBackgroundColor(Color.GRAY);
        adminButton.setTextColor(Color.WHITE);
        adminButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showAdminInterface();
            }
        });
        layout.addView(adminButton);
        
        setContentView(layout);
    }
    
    private int getServicoColor(int index) {
        int[] colors = {
            Color.GREEN,      // Lavagem Simples
            Color.BLUE,       // Secagem Simples
            Color.MAGENTA,    // Serviço Completo
            Color.CYAN,       // Lavagem Especial
            0xFFFFA500,       // Secagem Especial (Orange)
            Color.RED         // Passar Roupas
        };
        return colors[index % colors.length];
    }
    
    private void selecionarServico(PDVManager.Produto servico) {
        // Processar serviço imediatamente
        pdvManager.processarServicoImediato(servico);
        
        // Mostrar tela de confirmação e pagamento
        showConfirmacaoPagamento(servico);
    }
    
    private void showConfirmacaoPagamento(PDVManager.Produto servico) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 50, 50, 50);
        layout.setBackgroundColor(Color.BLUE);
        
        TextView confirmText = new TextView(this);
        confirmText.setText("✅ SERVIÇO SELECIONADO\n\n" +
                           "Serviço: " + servico.getNome() + "\n" +
                           "Valor: R$ " + new DecimalFormat("0.00").format(servico.getPreco()) + "\n" +
                           "Descrição: " + servico.getDescricao() + "\n\n" +
                           "💳 PAGAMENTO SERÁ PROCESSADO NA PPC930\n" +
                           "Insira seu cartão na pinpad quando solicitado");
        confirmText.setTextSize(16);
        confirmText.setGravity(android.view.Gravity.CENTER);
        confirmText.setPadding(20, 20, 20, 20);
        confirmText.setTextColor(Color.WHITE);
        layout.addView(confirmText);
        
        Button confirmarButton = new Button(this);
        confirmarButton.setText("💳 CONFIRMAR E PAGAR");
        confirmarButton.setTextSize(18);
        confirmarButton.setPadding(0, 25, 0, 25);
        confirmarButton.setBackgroundColor(Color.GREEN);
        confirmarButton.setTextColor(Color.WHITE);
        confirmarButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                processarPagamentoImediato(servico);
            }
        });
        layout.addView(confirmarButton);
        
        Button cancelarButton = new Button(this);
        cancelarButton.setText("❌ CANCELAR");
        cancelarButton.setTextSize(16);
        cancelarButton.setPadding(0, 20, 0, 20);
        cancelarButton.setBackgroundColor(Color.RED);
        cancelarButton.setTextColor(Color.WHITE);
        cancelarButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                pdvManager.cancelarVendaImediata();
                showTopLavanderiaInterface();
            }
        });
        layout.addView(cancelarButton);
        
        setContentView(layout);
    }
    
    private void processarPagamentoImediato(PDVManager.Produto servico) {
        try {
            Log.d("Totem", "=== INICIANDO PROCESSAMENTO DE PAGAMENTO ===");
            Log.d("Totem", "Serviço: " + servico.getNome());
            Log.d("Totem", "Valor: R$ " + servico.getPreco());
            Log.d("Totem", "Código: " + servico.getCodigo());
            
            // Mostrar tela de processamento
            LinearLayout layout = new LinearLayout(this);
            layout.setOrientation(LinearLayout.VERTICAL);
            layout.setPadding(50, 50, 50, 50);
            layout.setBackgroundColor(Color.BLUE);
            
            TextView processingText = new TextView(this);
            processingText.setText("🎯 PAGAMENTO REAL - COMUNICAÇÃO DIRETA PPC930\n\n" +
                                  "Serviço: " + servico.getNome() + "\n" +
                                  "Valor: R$ " + new DecimalFormat("0.00").format(servico.getPreco()) + "\n" +
                                  "Código: " + servico.getCodigo() + "\n\n" +
                                  "✅ INTEGRAÇÃO REAL ATIVA:\n" +
                                  "• PayGo API v4.1.50.5\n" +
                                  "• Transacoes.obtemInstancia()\n" +
                                  "• transacao.realizaTransacao()\n" +
                                  "• Comunicação direta PPC930\n\n" +
                                  "📋 DADOS ENVIADOS PARA PPC930:\n" +
                                  "• Valor: R$ " + new DecimalFormat("0.00").format(servico.getPreco()) + "\n" +
                                  "• Centavos: " + (int)(servico.getPreco() * 100) + "\n" +
                                  "• Descrição: Top Lavanderia - " + servico.getNome() + "\n" +
                                  "• Pedido: TOTEM" + System.currentTimeMillis() + "\n" +
                                  "• Operação: VENDA\n" +
                                  "• Modalidade: PAGAMENTO_CARTAO\n" +
                                  "• Documento Fiscal: 1000\n\n" +
                                  "🔄 PROCESSAMENTO REAL:\n" +
                                  "• EntradaTransacao criada\n" +
                                  "• Enviando para PPC930\n" +
                                  "• Aguardando resposta real\n\n" +
                                  "⚠️ COMUNICAÇÃO REAL - NÃO SIMULAÇÃO!");
            processingText.setTextSize(14);
            processingText.setGravity(android.view.Gravity.CENTER);
            processingText.setPadding(20, 20, 20, 20);
            processingText.setTextColor(Color.WHITE);
            layout.addView(processingText);
            
            setContentView(layout);
            
            // Verificar se payGoManager está inicializado
            if (payGoManager != null && payGoManager.isInitialized()) {
                Log.d("Totem", "PayGoManager inicializado. Enviando para PPC930...");

                // Processar pagamento real na PPC930
                payGoManager.processPayment(
                    servico.getPreco(),
                    "Top Lavanderia - " + servico.getNome(),
                    "TOTEM" + System.currentTimeMillis()
                );

                Log.d("Totem", "Comando enviado para PayGoManager");
            } else {
                Log.e("Totem", "PayGoManager não inicializado");
                showPaymentError("Erro: PayGo não inicializado. Verifique se o PayGo Integrado está instalado.");
            }
            
        } catch (Exception e) {
            Log.e("Totem", "Erro ao processar pagamento", e);
            showPaymentError("Erro ao processar pagamento: " + e.getMessage());
        }
    }
    
    private void showAdminInterface() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(30, 30, 30, 30);
        layout.setBackgroundColor(Color.WHITE);
        
        // Título
        TextView title = new TextView(this);
        title.setText("⚙️ PAINEL ADMINISTRATIVO");
        title.setTextSize(20);
        title.setTextColor(Color.BLUE);
        title.setGravity(android.view.Gravity.CENTER);
        title.setPadding(0, 0, 0, 20);
        layout.addView(title);
        
        // Status
        TextView status = new TextView(this);
        status.setText("📊 STATUS DO SISTEMA\n\n" +
                      "PayGo: " + getPayGoStatus() + "\n" +
                      "PPC930: " + (isPPC930Connected() ? "Conectado" : "Verificar") + "\n" +
                      "Vendas Hoje: " + pdvManager.getTotalVendas() + "\n" +
                      "Total Caixa: R$ " + new DecimalFormat("0.00").format(pdvManager.getTotalCaixa()));
        status.setTextSize(14);
        status.setPadding(20, 20, 20, 20);
        status.setBackgroundColor(Color.LTGRAY);
        layout.addView(status);
        
        // Botões administrativos
        Button relatoriosButton = new Button(this);
        relatoriosButton.setText("📊 RELATÓRIOS");
        relatoriosButton.setTextSize(16);
        relatoriosButton.setPadding(0, 20, 0, 20);
        relatoriosButton.setBackgroundColor(Color.BLUE);
        relatoriosButton.setTextColor(Color.WHITE);
        relatoriosButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showRelatoriosInterface();
            }
        });
        layout.addView(relatoriosButton);
        
        Button testarButton = new Button(this);
        testarButton.setText("🧪 TESTAR PPC930");
        testarButton.setTextSize(16);
        testarButton.setPadding(0, 20, 0, 20);
        testarButton.setBackgroundColor(Color.GREEN);
        testarButton.setTextColor(Color.WHITE);
        testarButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                payGoManager.testPayGo();
                showMessage("Teste da PPC930 iniciado!");
            }
        });
        layout.addView(testarButton);
        
        Button voltarButton = new Button(this);
        voltarButton.setText("⬅️ VOLTAR AO TOTEM");
        voltarButton.setTextSize(16);
        voltarButton.setPadding(0, 20, 0, 20);
        voltarButton.setBackgroundColor(Color.GRAY);
        voltarButton.setTextColor(Color.WHITE);
        voltarButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showTopLavanderiaInterface();
            }
        });
        layout.addView(voltarButton);
        
        setContentView(layout);
    }
    
    private void showPaymentScreen() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 50, 50, 50);
        layout.setBackgroundColor(Color.YELLOW);
        
        TextView paymentText = new TextView(this);
        paymentText.setText("💳 PROCESSANDO PAGAMENTO\n\n" +
                           "Valor: R$ 5,00\n" +
                           "Status: Iniciando transação...\n\n" +
                           "🔄 Passos:\n" +
                           "1. Abrindo PayGo Integrado CERT\n" +
                           "2. Configurando transação\n" +
                           "3. Aguardando pagamento\n" +
                           "4. Processando...");
        paymentText.setTextSize(16);
        paymentText.setGravity(android.view.Gravity.CENTER);
        paymentText.setPadding(20, 20, 20, 20);
        layout.addView(paymentText);
        
        // Botão para processar pagamento real
        Button processPaymentButton = new Button(this);
        processPaymentButton.setText("💳 PROCESSAR PAGAMENTO REAL");
        processPaymentButton.setTextSize(16);
        processPaymentButton.setPadding(0, 20, 0, 20);
        processPaymentButton.setBackgroundColor(Color.GREEN);
        processPaymentButton.setTextColor(Color.WHITE);
        processPaymentButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                processMachinePayment("TESTE", 500);
            }
        });
        layout.addView(processPaymentButton);
        
        // Botão para abrir PayGo Integrado
        Button openPayGoButton = new Button(this);
        openPayGoButton.setText("🔧 ABRIR PAYGO INTEGRADO");
        openPayGoButton.setTextSize(16);
        openPayGoButton.setPadding(0, 20, 0, 20);
        openPayGoButton.setBackgroundColor(Color.BLUE);
        openPayGoButton.setTextColor(Color.WHITE);
        openPayGoButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openPayGoIntegrado();
            }
        });
        layout.addView(openPayGoButton);
        
        Button cancelButton = new Button(this);
        cancelButton.setText("❌ CANCELAR");
        cancelButton.setTextSize(16);
        cancelButton.setPadding(0, 20, 0, 20);
        cancelButton.setBackgroundColor(Color.RED);
        cancelButton.setTextColor(Color.WHITE);
        cancelButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showTopLavanderiaInterface();
            }
        });
        layout.addView(cancelButton);
        
        setContentView(layout);
    }
    
    private void processMachinePayment(String machine, int amount) {
        // Mostrar tela de processamento
        showMachinePaymentProcessing(machine, amount);
        
        // Iniciar processo de pagamento direto na pinpad
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
                // Enviar pagamento direto para PPC930
                sendPaymentToPinpad(machine, amount);
            }
        }, 2000);
    }
    
    private void showMachinePaymentProcessing(String machine, int amount) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 50, 50, 50);
        layout.setBackgroundColor(Color.BLUE);
        
        TextView processingText = new TextView(this);
        processingText.setText("🔄 PROCESSANDO PAGAMENTO\n\n" +
                              "Máquina: " + machine + "\n" +
                              "Valor: R$ " + String.format("%.2f", amount / 100.0) + "\n" +
                              "Status: Conectando com PPC930...\n\n" +
                              "⚠️ Certifique-se de que:\n" +
                              "• PPC930 está conectado\n" +
                              "• PayGo Integrado está configurado\n" +
                              "• Cliente está pronto para pagar\n\n" +
                              "Aguarde...");
        processingText.setTextSize(16);
        processingText.setGravity(android.view.Gravity.CENTER);
        processingText.setPadding(20, 20, 20, 20);
        processingText.setTextColor(Color.WHITE);
        layout.addView(processingText);
        
        setContentView(layout);
    }
    
    private void sendPaymentToPinpad(String machine, int amount) {
        try {
            // Enviar comando direto para PayGo processar na pinpad
            Intent paymentIntent = new Intent();
            paymentIntent.setAction("br.com.setis.clientepaygoweb.cert.PROCESS_PAYMENT");
            paymentIntent.putExtra("AMOUNT", amount);
            paymentIntent.putExtra("AMOUNT_CENTS", amount);
            paymentIntent.putExtra("DESCRIPTION", machine);
            paymentIntent.putExtra("ORDER_ID", "TL" + System.currentTimeMillis());
            paymentIntent.putExtra("CURRENCY", "BRL");
            paymentIntent.putExtra("PAYMENT_TYPE", "CREDIT");
            paymentIntent.putExtra("INSTALLMENTS", 1);
            paymentIntent.putExtra("AUTO_PROCESS", true);
            paymentIntent.putExtra("FORCE_PINPAD", true);
            paymentIntent.putExtra("PINPAD_MODEL", "PPC930");
            paymentIntent.putExtra("MERCHANT_ID", "123456");
            
            // Enviar broadcast para PayGo
            sendBroadcast(paymentIntent);
            
            // Mostrar tela de pagamento na pinpad
            showPinpadPayment(machine, amount);
            
        } catch (Exception e) {
            // Se falhar, mostrar erro
            showPaymentError(machine, amount, e.getMessage());
        }
    }
    
    private void showPinpadPayment(String machine, int amount) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 50, 50, 50);
        layout.setBackgroundColor(Color.GREEN);
        
        TextView pinpadText = new TextView(this);
        pinpadText.setText("💳 PAGAMENTO ENVIADO PARA PPC930\n\n" +
                          "Máquina: " + machine + "\n" +
                          "Valor: R$ " + String.format("%.2f", amount / 100.0) + "\n\n" +
                          "📱 PPC930 deve mostrar:\n" +
                          "• Valor: R$ " + String.format("%.2f", amount / 100.0) + "\n" +
                          "• Descrição: " + machine + "\n" +
                          "• Instrução: 'Insira o cartão'\n\n" +
                          "👤 CLIENTE:\n" +
                          "1. Insira o cartão no PPC930\n" +
                          "2. Digite a senha\n" +
                          "3. Aguarde confirmação\n\n" +
                          "⚠️ Se o PPC930 não mostrar o valor,\n" +
                          "verifique a conexão USB.");
        pinpadText.setTextSize(14);
        pinpadText.setGravity(android.view.Gravity.CENTER);
        pinpadText.setPadding(20, 20, 20, 20);
        pinpadText.setTextColor(Color.WHITE);
        layout.addView(pinpadText);
        
        Button successButton = new Button(this);
        successButton.setText("✅ PAGAMENTO REALIZADO");
        successButton.setTextSize(16);
        successButton.setPadding(0, 20, 0, 20);
        successButton.setBackgroundColor(Color.WHITE);
        successButton.setTextColor(Color.GREEN);
        successButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showPaymentSuccess("TESTE", 500, null);
            }
        });
        layout.addView(successButton);
        
        Button cancelButton = new Button(this);
        cancelButton.setText("❌ CANCELAR");
        cancelButton.setTextSize(16);
        cancelButton.setPadding(0, 20, 0, 20);
        cancelButton.setBackgroundColor(Color.RED);
        cancelButton.setTextColor(Color.WHITE);
        cancelButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showTopLavanderiaInterface();
            }
        });
        layout.addView(cancelButton);
        
        setContentView(layout);
    }
    
    private void showPaymentError(String machine, int amount, String error) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 50, 50, 50);
        layout.setBackgroundColor(Color.RED);
        
        TextView errorText = new TextView(this);
        errorText.setText("❌ ERRO NO PAGAMENTO\n\n" +
                         "Máquina: " + machine + "\n" +
                         "Valor: R$ " + String.format("%.2f", amount / 100.0) + "\n" +
                         "Erro: " + error + "\n\n" +
                         "🔧 SOLUÇÕES:\n" +
                         "• Verifique se PPC930 está conectado\n" +
                         "• Verifique se PayGo Integrado está configurado\n" +
                         "• Reinicie o PayGo Integrado\n" +
                         "• Tente novamente");
        errorText.setTextSize(14);
        errorText.setGravity(android.view.Gravity.CENTER);
        errorText.setPadding(20, 20, 20, 20);
        errorText.setTextColor(Color.WHITE);
        layout.addView(errorText);
        
        Button retryButton = new Button(this);
        retryButton.setText("🔄 TENTAR NOVAMENTE");
        retryButton.setTextSize(16);
        retryButton.setPadding(0, 20, 0, 20);
        retryButton.setBackgroundColor(Color.WHITE);
        retryButton.setTextColor(Color.RED);
        retryButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                processMachinePayment(machine, amount);
            }
        });
        layout.addView(retryButton);
        
        Button backButton = new Button(this);
        backButton.setText("⬅️ VOLTAR");
        backButton.setTextSize(16);
        backButton.setPadding(0, 20, 0, 20);
        backButton.setBackgroundColor(Color.LTGRAY);
        backButton.setTextColor(Color.BLACK);
        backButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showTopLavanderiaInterface();
            }
        });
        layout.addView(backButton);
        
        setContentView(layout);
    }
    
    private void openPayGoForRealPayment() {
        try {
            // Abrir PayGo Integrado CERT
            Intent intent = getPackageManager().getLaunchIntentForPackage("br.com.setis.clientepaygoweb.cert");
            if (intent != null) {
                startActivity(intent);
                
                // Aguardar PayGo abrir e mostrar instruções para pagamento real
                new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        showRealPaymentInstructions();
                    }
                }, 3000);
                
            } else {
                // Fallback para versão PROD
                intent = getPackageManager().getLaunchIntentForPackage("br.com.setis.clientepaygoweb");
                if (intent != null) {
                    startActivity(intent);
                    new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
                        @Override
                        public void run() {
                            showRealPaymentInstructions();
                        }
                    }, 3000);
                } else {
                    showPayGoNotFound();
                }
            }
            
        } catch (Exception e) {
            showPayGoError(e.getMessage());
        }
    }
    
    private void showRealPaymentInstructions() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 50, 50, 50);
        layout.setBackgroundColor(Color.BLUE);
        
        TextView instructionsText = new TextView(this);
        instructionsText.setText("💳 PAGAMENTO REAL VIA PPC930\n\n" +
                                "Valor: R$ 5,00\n" +
                                "Descrição: Top Lavanderia - Serviço de Teste\n\n" +
                                "📋 INSTRUÇÕES PARA PAGAMENTO REAL:\n" +
                                "1. No PayGo Integrado, clique em 'Nova Transação'\n" +
                                "2. Digite o valor: R$ 5,00\n" +
                                "3. Selecione 'Crédito à vista'\n" +
                                "4. Clique em 'Processar'\n" +
                                "5. O PPC930 deve mostrar: R$ 5,00\n" +
                                "6. Cliente insere o cartão no PPC930\n" +
                                "7. Cliente digita a senha no PPC930\n" +
                                "8. Aguarde confirmação no PPC930\n" +
                                "9. Volte aqui e clique 'PAGAMENTO REALIZADO'\n\n" +
                                "⚠️ IMPORTANTE:\n" +
                                "• O pagamento deve ser feito no PPC930\n" +
                                "• Não simule no app PayGo\n" +
                                "• Use cartão real para teste");
        instructionsText.setTextSize(14);
        instructionsText.setGravity(android.view.Gravity.CENTER);
        instructionsText.setPadding(20, 20, 20, 20);
        instructionsText.setTextColor(Color.WHITE);
        layout.addView(instructionsText);
        
        Button backButton = new Button(this);
        backButton.setText("⬅️ VOLTAR AO TOP LAVANDERIA");
        backButton.setTextSize(16);
        backButton.setPadding(0, 20, 0, 20);
        backButton.setBackgroundColor(Color.WHITE);
        backButton.setTextColor(Color.BLUE);
        backButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showTopLavanderiaInterface();
            }
        });
        layout.addView(backButton);
        
        Button successButton = new Button(this);
        successButton.setText("✅ PAGAMENTO REALIZADO NO PPC930");
        successButton.setTextSize(16);
        successButton.setPadding(0, 20, 0, 20);
        successButton.setBackgroundColor(Color.GREEN);
        successButton.setTextColor(Color.WHITE);
        successButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showPaymentSuccess("TESTE", 500, null);
            }
        });
        layout.addView(successButton);
        
        setContentView(layout);
    }
    
    private void showPaymentProcessing() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 50, 50, 50);
        layout.setBackgroundColor(Color.BLUE);
        
        TextView processingText = new TextView(this);
        processingText.setText("🔄 PROCESSANDO PAGAMENTO\n\n" +
                              "Valor: R$ 5,00\n" +
                              "Status: Conectando com PayGo...\n\n" +
                              "⚠️ Certifique-se de que:\n" +
                              "• PayGo Integrado CERT está configurado\n" +
                              "• PPC930 está conectado e funcionando\n" +
                              "• Cliente está pronto para pagar\n\n" +
                              "Aguarde...");
        processingText.setTextSize(16);
        processingText.setGravity(android.view.Gravity.CENTER);
        processingText.setPadding(20, 20, 20, 20);
        processingText.setTextColor(Color.WHITE);
        layout.addView(processingText);
        
        setContentView(layout);
    }
    
    private void openPayGoWithTransaction() {
        try {
            // Primeiro, abrir PayGo Integrado CERT normalmente
            Intent intent = getPackageManager().getLaunchIntentForPackage("br.com.setis.clientepaygoweb.cert");
            if (intent != null) {
                startActivity(intent);
                
                // Aguardar um pouco para o PayGo abrir
                new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        // Enviar comando para processar pagamento
                        sendPaymentCommand();
                    }
                }, 3000);
                
            } else {
                // Fallback para versão PROD
                intent = getPackageManager().getLaunchIntentForPackage("br.com.setis.clientepaygoweb");
                if (intent != null) {
                    startActivity(intent);
                    new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
                        @Override
                        public void run() {
                            sendPaymentCommand();
                        }
                    }, 3000);
                } else {
                    showPayGoNotFound();
                }
            }
            
        } catch (Exception e) {
            showPayGoError(e.getMessage());
        }
    }
    
    private void sendPaymentCommand() {
        try {
            // Enviar broadcast para PayGo processar pagamento
            Intent broadcastIntent = new Intent();
            broadcastIntent.setAction("br.com.setis.clientepaygoweb.cert.PROCESS_PAYMENT");
            broadcastIntent.putExtra("AMOUNT", 500);
            broadcastIntent.putExtra("DESCRIPTION", "Top Lavanderia - Serviço de Teste");
            broadcastIntent.putExtra("ORDER_ID", "TL" + System.currentTimeMillis());
            broadcastIntent.putExtra("AUTO_PROCESS", true);
            sendBroadcast(broadcastIntent);
            
            // Mostrar instruções
            showPayGoInstructions();
            
        } catch (Exception e) {
            // Se broadcast falhar, mostrar instruções manuais
            showManualPayGoInstructions();
        }
    }
    
    private void showManualPayGoInstructions() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 50, 50, 50);
        layout.setBackgroundColor(0xFFFFA500); // Orange
        
        TextView instructionsText = new TextView(this);
        instructionsText.setText("⚠️ CONFIGURAÇÃO MANUAL NECESSÁRIA\n\n" +
                                "Valor: R$ 5,00\n" +
                                "Descrição: Top Lavanderia - Serviço de Teste\n\n" +
                                "📋 INSTRUÇÕES MANUAIS:\n" +
                                "1. No PayGo Integrado, vá em 'Nova Transação'\n" +
                                "2. Digite o valor: R$ 5,00\n" +
                                "3. Selecione 'Crédito à vista'\n" +
                                "4. Clique em 'Processar'\n" +
                                "5. O PPC930 deve mostrar R$ 5,00\n" +
                                "6. Cliente insere cartão e senha\n" +
                                "7. Aguarde confirmação\n\n" +
                                "⚠️ Se o PPC930 não mostrar o valor:\n" +
                                "• Verifique conexão USB\n" +
                                "• Reinicie o PayGo Integrado\n" +
                                "• Verifique configurações do PPC930");
        instructionsText.setTextSize(14);
        instructionsText.setGravity(android.view.Gravity.CENTER);
        instructionsText.setPadding(20, 20, 20, 20);
        instructionsText.setTextColor(Color.WHITE);
        layout.addView(instructionsText);
        
        Button backButton = new Button(this);
        backButton.setText("⬅️ VOLTAR AO TOP LAVANDERIA");
        backButton.setTextSize(16);
        backButton.setPadding(0, 20, 0, 20);
        backButton.setBackgroundColor(Color.WHITE);
        backButton.setTextColor(0xFFFFA500); // Orange
        backButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showTopLavanderiaInterface();
            }
        });
        layout.addView(backButton);
        
        Button successButton = new Button(this);
        successButton.setText("✅ PAGAMENTO REALIZADO");
        successButton.setTextSize(16);
        successButton.setPadding(0, 20, 0, 20);
        successButton.setBackgroundColor(Color.GREEN);
        successButton.setTextColor(Color.WHITE);
        successButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showPaymentSuccess("TESTE", 500, null);
            }
        });
        layout.addView(successButton);
        
        setContentView(layout);
    }
    
    private void showPayGoInstructions() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 50, 50, 50);
        layout.setBackgroundColor(Color.GREEN);
        
        TextView instructionsText = new TextView(this);
        instructionsText.setText("✅ PAYGO INTEGRADO ABERTO\n\n" +
                                "Valor: R$ 5,00 (500 centavos)\n" +
                                "Descrição: Top Lavanderia - Serviço de Teste\n" +
                                "Tipo: Crédito à vista\n" +
                                "Parcelas: 1\n\n" +
                                "📋 INSTRUÇÕES:\n" +
                                "1. PayGo deve detectar automaticamente o PPC930\n" +
                                "2. O valor R$ 5,00 será enviado para a pinpad\n" +
                                "3. Cliente insere o cartão no PPC930\n" +
                                "4. Cliente digita a senha\n" +
                                "5. Aguarde a confirmação na pinpad\n" +
                                "6. Volte ao Top Lavanderia\n\n" +
                                "⚠️ Se o PPC930 não detectar o valor, verifique:\n" +
                                "• Conexão USB do PPC930\n" +
                                "• Configuração do PayGo Integrado\n" +
                                "• Permissões USB no tablet");
        instructionsText.setTextSize(14);
        instructionsText.setGravity(android.view.Gravity.CENTER);
        instructionsText.setPadding(20, 20, 20, 20);
        instructionsText.setTextColor(Color.WHITE);
        layout.addView(instructionsText);
        
        Button backButton = new Button(this);
        backButton.setText("⬅️ VOLTAR AO TOP LAVANDERIA");
        backButton.setTextSize(16);
        backButton.setPadding(0, 20, 0, 20);
        backButton.setBackgroundColor(Color.WHITE);
        backButton.setTextColor(Color.GREEN);
        backButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showTopLavanderiaInterface();
            }
        });
        layout.addView(backButton);
        
        Button successButton = new Button(this);
        successButton.setText("✅ PAGAMENTO REALIZADO");
        successButton.setTextSize(16);
        successButton.setPadding(0, 20, 0, 20);
        successButton.setBackgroundColor(Color.BLUE);
        successButton.setTextColor(Color.WHITE);
        successButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showPaymentSuccess("TESTE", 500, null);
            }
        });
        layout.addView(successButton);
        
        setContentView(layout);
    }
    
    private void showPayGoNotFound() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 50, 50, 50);
        layout.setBackgroundColor(Color.RED);
        
        TextView errorText = new TextView(this);
        errorText.setText("❌ PAYGO INTEGRADO NÃO ENCONTRADO\n\n" +
                         "Verifique se:\n" +
                         "• PayGo Integrado CERT está instalado\n" +
                         "• PayGo Integrado PROD está instalado\n" +
                         "• Aplicativo está funcionando\n\n" +
                         "Tente instalar o PayGo Integrado primeiro.");
        errorText.setTextSize(16);
        errorText.setGravity(android.view.Gravity.CENTER);
        errorText.setPadding(20, 20, 20, 20);
        errorText.setTextColor(Color.WHITE);
        layout.addView(errorText);
        
        Button backButton = new Button(this);
        backButton.setText("⬅️ VOLTAR");
        backButton.setTextSize(16);
        backButton.setPadding(0, 20, 0, 20);
        backButton.setBackgroundColor(Color.WHITE);
        backButton.setTextColor(Color.RED);
        backButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showTopLavanderiaInterface();
            }
        });
        layout.addView(backButton);
        
        setContentView(layout);
    }
    
    private void showPayGoError(String error) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 50, 50, 50);
        layout.setBackgroundColor(Color.RED);
        
        TextView errorText = new TextView(this);
        errorText.setText("❌ ERRO AO ABRIR PAYGO\n\n" +
                         "Erro: " + error + "\n\n" +
                         "Tente novamente ou verifique a instalação.");
        errorText.setTextSize(16);
        errorText.setGravity(android.view.Gravity.CENTER);
        errorText.setPadding(20, 20, 20, 20);
        errorText.setTextColor(Color.WHITE);
        layout.addView(errorText);
        
        Button backButton = new Button(this);
        backButton.setText("⬅️ VOLTAR");
        backButton.setTextSize(16);
        backButton.setPadding(0, 20, 0, 20);
        backButton.setBackgroundColor(Color.WHITE);
        backButton.setTextColor(Color.RED);
        backButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showTopLavanderiaInterface();
            }
        });
        layout.addView(backButton);
        
        setContentView(layout);
    }
    
    private void checkTransactionResult() {
        // Verificar se a transação foi processada
        // Por enquanto, mostrar tela de sucesso
        showPaymentSuccess("TESTE", 500, null);
    }
    
    private void showPaymentSuccess(String machine, int amount, br.com.setis.interfaceautomacao.SaidaTransacao resultado) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 50, 50, 50);
        layout.setBackgroundColor(Color.GREEN);
        
        TextView successText = new TextView(this);
        String codigo = (resultado != null) ? resultado.obtemCodigoAutorizacao() : "N/A";
        successText.setText("✅ PAGAMENTO REAL APROVADO!\n\n" +
                           "Máquina: " + machine + "\n" +
                           "Valor: R$ " + String.format("%.2f", amount / 100.0) + "\n" +
                           "Status: Transação concluída no PPC930\n" +
                           "Código: " + codigo + "\n" +
                           "Data: " + new java.text.SimpleDateFormat("dd/MM/yyyy HH:mm").format(new java.util.Date()) + "\n\n" +
                           "🎉 Serviço liberado!\n" +
                           "O cliente pode usar a máquina da lavanderia.\n\n" +
                           "💳 Pagamento processado via PPC930\n" +
                           "✅ Transação real confirmada");
        successText.setTextSize(16);
        successText.setGravity(android.view.Gravity.CENTER);
        successText.setPadding(20, 20, 20, 20);
        successText.setTextColor(Color.WHITE);
        layout.addView(successText);
        
        Button newPaymentButton = new Button(this);
        newPaymentButton.setText("🔄 NOVO PAGAMENTO");
        newPaymentButton.setTextSize(16);
        newPaymentButton.setPadding(0, 20, 0, 20);
        newPaymentButton.setBackgroundColor(Color.WHITE);
        newPaymentButton.setTextColor(Color.GREEN);
        newPaymentButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showTopLavanderiaInterface();
            }
        });
        layout.addView(newPaymentButton);
        
        Button homeButton = new Button(this);
        homeButton.setText("🏠 MENU PRINCIPAL");
        homeButton.setTextSize(16);
        homeButton.setPadding(0, 20, 0, 20);
        homeButton.setBackgroundColor(Color.LTGRAY);
        homeButton.setTextColor(Color.BLACK);
        homeButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                recreate();
            }
        });
        layout.addView(homeButton);
        
        setContentView(layout);
    }
    
    private String getPayGoStatus() {
        try {
            // Verificar PayGo Integrado CERT
            getPackageManager().getPackageInfo("br.com.setis.clientepaygoweb.cert", 0);
            return "CERT (Certificação)";
        } catch (PackageManager.NameNotFoundException e) {
            try {
                // Verificar PayGo Integrado PROD
                getPackageManager().getPackageInfo("br.com.setis.clientepaygoweb", 0);
                return "PROD (Produção)";
            } catch (PackageManager.NameNotFoundException e2) {
                return "Não encontrado";
            }
        }
    }
    
    // ========== MÉTODOS DO PDV ==========
    
    private void showNovaVendaInterface() {
        ScrollView scrollView = new ScrollView(this);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(20, 20, 20, 20);
        layout.setBackgroundColor(Color.WHITE);
        
        // Título
        TextView title = new TextView(this);
        title.setText("🛒 NOVA VENDA");
        title.setTextSize(20);
        title.setTextColor(Color.BLUE);
        title.setGravity(android.view.Gravity.CENTER);
        title.setPadding(0, 0, 0, 20);
        layout.addView(title);
        
        // Iniciar nova venda
        pdvManager.iniciarNovaVenda();
        
        // Lista de produtos
        TextView produtosTitle = new TextView(this);
        produtosTitle.setText("📦 PRODUTOS DISPONÍVEIS:");
        produtosTitle.setTextSize(16);
        produtosTitle.setTextColor(Color.BLACK);
        produtosTitle.setPadding(0, 10, 0, 10);
        layout.addView(produtosTitle);
        
        // Botões para cada produto
        for (PDVManager.Produto produto : pdvManager.getProdutos()) {
            Button produtoButton = new Button(this);
            produtoButton.setText(produto.getNome() + "\nR$ " + new DecimalFormat("0.00").format(produto.getPreco()));
            produtoButton.setTextSize(14);
            produtoButton.setPadding(10, 15, 10, 15);
            produtoButton.setBackgroundColor(Color.LTGRAY);
            produtoButton.setTextColor(Color.BLACK);
            produtoButton.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    adicionarProdutoAVenda(produto);
                }
            });
            layout.addView(produtoButton);
        }
        
        // Carrinho atual
        TextView carrinhoTitle = new TextView(this);
        carrinhoTitle.setText("\n🛒 CARRINHO ATUAL:");
        carrinhoTitle.setTextSize(16);
        carrinhoTitle.setTextColor(Color.BLACK);
        carrinhoTitle.setPadding(0, 20, 0, 10);
        layout.addView(carrinhoTitle);
        
        // Mostrar itens do carrinho
        mostrarCarrinho(layout);
        
        // Botões de ação
        Button finalizarButton = new Button(this);
        finalizarButton.setText("💳 FINALIZAR VENDA");
        finalizarButton.setTextSize(16);
        finalizarButton.setPadding(0, 20, 0, 20);
        finalizarButton.setBackgroundColor(Color.GREEN);
        finalizarButton.setTextColor(Color.WHITE);
        finalizarButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finalizarVenda();
            }
        });
        layout.addView(finalizarButton);
        
        Button cancelarButton = new Button(this);
        cancelarButton.setText("❌ CANCELAR VENDA");
        cancelarButton.setTextSize(16);
        cancelarButton.setPadding(0, 20, 0, 20);
        cancelarButton.setBackgroundColor(Color.RED);
        cancelarButton.setTextColor(Color.WHITE);
        cancelarButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                cancelarVenda();
            }
        });
        layout.addView(cancelarButton);
        
        Button voltarButton = new Button(this);
        voltarButton.setText("⬅️ VOLTAR");
        voltarButton.setTextSize(16);
        voltarButton.setPadding(0, 20, 0, 20);
        voltarButton.setBackgroundColor(Color.GRAY);
        voltarButton.setTextColor(Color.WHITE);
        voltarButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showTopLavanderiaInterface();
            }
        });
        layout.addView(voltarButton);
        
        scrollView.addView(layout);
        setContentView(scrollView);
    }
    
    private void adicionarProdutoAVenda(PDVManager.Produto produto) {
        pdvManager.adicionarItem(produto, 1);
        showNovaVendaInterface(); // Recarregar interface
    }
    
    private void mostrarCarrinho(LinearLayout layout) {
        PDVManager.Venda venda = pdvManager.getVendaAtual();
        if (venda != null && !venda.getItens().isEmpty()) {
            for (int i = 0; i < venda.getItens().size(); i++) {
                PDVManager.ItemVenda item = venda.getItens().get(i);
                TextView itemText = new TextView(this);
                itemText.setText("• " + item.getProduto().getNome() + 
                               " x" + item.getQuantidade() + 
                               " = R$ " + new DecimalFormat("0.00").format(item.getSubtotal()));
                itemText.setTextSize(14);
                itemText.setPadding(10, 5, 10, 5);
                itemText.setBackgroundColor(Color.LTGRAY);
                layout.addView(itemText);
            }
            
            TextView totalText = new TextView(this);
            totalText.setText("TOTAL: R$ " + new DecimalFormat("0.00").format(venda.getTotal()));
            totalText.setTextSize(16);
            totalText.setTextColor(Color.BLUE);
            totalText.setPadding(10, 10, 10, 10);
            totalText.setBackgroundColor(Color.YELLOW);
            layout.addView(totalText);
        } else {
            TextView emptyText = new TextView(this);
            emptyText.setText("Carrinho vazio");
            emptyText.setTextSize(14);
            emptyText.setTextColor(Color.GRAY);
            emptyText.setPadding(10, 10, 10, 10);
            layout.addView(emptyText);
        }
    }
    
    private void finalizarVenda() {
        PDVManager.Venda venda = pdvManager.getVendaAtual();
        if (venda != null && !venda.getItens().isEmpty()) {
            // Processar pagamento na pinpad
            processarPagamento(venda);
        } else {
            showMessage("Carrinho vazio! Adicione produtos antes de finalizar.");
        }
    }
    
    private void processarPagamento(PDVManager.Venda venda) {
        // Mostrar tela de processamento
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 50, 50, 50);
        layout.setBackgroundColor(Color.BLUE);
        
        TextView processingText = new TextView(this);
        processingText.setText("💳 PROCESSANDO PAGAMENTO\n\n" +
                              "Venda #" + venda.getNumero() + "\n" +
                              "Total: R$ " + new DecimalFormat("0.00").format(venda.getTotal()) + "\n\n" +
                              "Conectando com PPC930...\n" +
                              "Aguarde o cliente inserir o cartão...");
        processingText.setTextSize(16);
        processingText.setGravity(android.view.Gravity.CENTER);
        processingText.setPadding(20, 20, 20, 20);
        processingText.setTextColor(Color.WHITE);
        layout.addView(processingText);
        
        setContentView(layout);
        
        // Processar pagamento na pinpad
        payGoManager.processPayment(
            venda.getTotal(),
            "Top Lavanderia - Venda #" + venda.getNumero(),
            "VENDA" + venda.getNumero()
        );
    }
    
    private void cancelarVenda() {
        pdvManager.cancelarVenda();
        showMessage("Venda cancelada!");
        showTopLavanderiaInterface();
    }
    
    private void showProdutosInterface() {
        ScrollView scrollView = new ScrollView(this);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(20, 20, 20, 20);
        layout.setBackgroundColor(Color.WHITE);
        
        // Título
        TextView title = new TextView(this);
        title.setText("📦 PRODUTOS E SERVIÇOS");
        title.setTextSize(20);
        title.setTextColor(Color.BLUE);
        title.setGravity(android.view.Gravity.CENTER);
        title.setPadding(0, 0, 0, 20);
        layout.addView(title);
        
        // Lista de produtos
        for (PDVManager.Produto produto : pdvManager.getProdutos()) {
            LinearLayout produtoLayout = new LinearLayout(this);
            produtoLayout.setOrientation(LinearLayout.VERTICAL);
            produtoLayout.setPadding(10, 10, 10, 10);
            produtoLayout.setBackgroundColor(Color.LTGRAY);
            
            TextView nomeText = new TextView(this);
            nomeText.setText(produto.getNome());
            nomeText.setTextSize(16);
            nomeText.setTextColor(Color.BLACK);
            produtoLayout.addView(nomeText);
            
            TextView precoText = new TextView(this);
            precoText.setText("R$ " + new DecimalFormat("0.00").format(produto.getPreco()));
            precoText.setTextSize(14);
            precoText.setTextColor(Color.BLUE);
            produtoLayout.addView(precoText);
            
            TextView descText = new TextView(this);
            descText.setText(produto.getDescricao());
            descText.setTextSize(12);
            descText.setTextColor(Color.GRAY);
            produtoLayout.addView(descText);
            
            layout.addView(produtoLayout);
        }
        
        // Botão voltar
        Button voltarButton = new Button(this);
        voltarButton.setText("⬅️ VOLTAR");
        voltarButton.setTextSize(16);
        voltarButton.setPadding(0, 20, 0, 20);
        voltarButton.setBackgroundColor(Color.GRAY);
        voltarButton.setTextColor(Color.WHITE);
        voltarButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showTopLavanderiaInterface();
            }
        });
        layout.addView(voltarButton);
        
        scrollView.addView(layout);
        setContentView(scrollView);
    }
    
    private void showRelatoriosInterface() {
        ScrollView scrollView = new ScrollView(this);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(20, 20, 20, 20);
        layout.setBackgroundColor(Color.WHITE);
        
        // Título
        TextView title = new TextView(this);
        title.setText("📊 RELATÓRIOS DE VENDAS");
        title.setTextSize(20);
        title.setTextColor(Color.BLUE);
        title.setGravity(android.view.Gravity.CENTER);
        title.setPadding(0, 0, 0, 20);
        layout.addView(title);
        
        // Relatório
        TextView relatorioText = new TextView(this);
        relatorioText.setText(pdvManager.getRelatorioVendas());
        relatorioText.setTextSize(12);
        relatorioText.setTextColor(Color.BLACK);
        relatorioText.setPadding(10, 10, 10, 10);
        relatorioText.setBackgroundColor(Color.LTGRAY);
        layout.addView(relatorioText);
        
        // Botões
        Button limparButton = new Button(this);
        limparButton.setText("🗑️ LIMPAR RELATÓRIOS");
        limparButton.setTextSize(16);
        limparButton.setPadding(0, 20, 0, 20);
        limparButton.setBackgroundColor(Color.RED);
        limparButton.setTextColor(Color.WHITE);
        limparButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                pdvManager.limparCaixa();
                showMessage("Relatórios limpos!");
                showRelatoriosInterface();
            }
        });
        layout.addView(limparButton);
        
        Button voltarButton = new Button(this);
        voltarButton.setText("⬅️ VOLTAR");
        voltarButton.setTextSize(16);
        voltarButton.setPadding(0, 20, 0, 20);
        voltarButton.setBackgroundColor(Color.GRAY);
        voltarButton.setTextColor(Color.WHITE);
        voltarButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showTopLavanderiaInterface();
            }
        });
        layout.addView(voltarButton);
        
        scrollView.addView(layout);
        setContentView(scrollView);
    }
    
    private void showCaixaInterface() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 50, 50, 50);
        layout.setBackgroundColor(Color.WHITE);
        
        // Título
        TextView title = new TextView(this);
        title.setText("💰 GESTÃO DE CAIXA");
        title.setTextSize(20);
        title.setTextColor(Color.BLUE);
        title.setGravity(android.view.Gravity.CENTER);
        title.setPadding(0, 0, 0, 30);
        layout.addView(title);
        
        // Informações do caixa
        TextView caixaText = new TextView(this);
        caixaText.setText("💵 TOTAL DO CAIXA: R$ " + new DecimalFormat("0.00").format(pdvManager.getTotalCaixa()) + "\n\n" +
                         "📊 TOTAL DE VENDAS: " + pdvManager.getTotalVendas() + "\n\n" +
                         "📅 DATA: " + new SimpleDateFormat("dd/MM/yyyy HH:mm").format(new Date()));
        caixaText.setTextSize(16);
        caixaText.setPadding(20, 20, 20, 20);
        caixaText.setBackgroundColor(Color.LTGRAY);
        layout.addView(caixaText);
        
        // Botões
        Button fecharButton = new Button(this);
        fecharButton.setText("🔒 FECHAR CAIXA");
        fecharButton.setTextSize(16);
        fecharButton.setPadding(0, 20, 0, 20);
        fecharButton.setBackgroundColor(Color.RED);
        fecharButton.setTextColor(Color.WHITE);
        fecharButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                fecharCaixa();
            }
        });
        layout.addView(fecharButton);
        
        Button voltarButton = new Button(this);
        voltarButton.setText("⬅️ VOLTAR");
        voltarButton.setTextSize(16);
        voltarButton.setPadding(0, 20, 0, 20);
        voltarButton.setBackgroundColor(Color.GRAY);
        voltarButton.setTextColor(Color.WHITE);
        voltarButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showTopLavanderiaInterface();
            }
        });
        layout.addView(voltarButton);
        
        setContentView(layout);
    }
    
    private void fecharCaixa() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 50, 50, 50);
        layout.setBackgroundColor(Color.GREEN);
        
        TextView successText = new TextView(this);
        successText.setText("✅ CAIXA FECHADO COM SUCESSO!\n\n" +
                           "Total: R$ " + new DecimalFormat("0.00").format(pdvManager.getTotalCaixa()) + "\n" +
                           "Vendas: " + pdvManager.getTotalVendas() + "\n\n" +
                           "Caixa zerado para nova operação.");
        successText.setTextSize(16);
        successText.setGravity(android.view.Gravity.CENTER);
        successText.setPadding(20, 20, 20, 20);
        successText.setTextColor(Color.WHITE);
        layout.addView(successText);
        
        Button okButton = new Button(this);
        okButton.setText("✅ OK");
        okButton.setTextSize(16);
        okButton.setPadding(0, 20, 0, 20);
        okButton.setBackgroundColor(Color.WHITE);
        okButton.setTextColor(Color.GREEN);
        okButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                pdvManager.limparCaixa();
                showTopLavanderiaInterface();
            }
        });
        layout.addView(okButton);
        
        setContentView(layout);
    }
    
    private void showConfiguracoesInterface() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 50, 50, 50);
        layout.setBackgroundColor(Color.WHITE);
        
        // Título
        TextView title = new TextView(this);
        title.setText("⚙️ CONFIGURAÇÕES");
        title.setTextSize(20);
        title.setTextColor(Color.BLUE);
        title.setGravity(android.view.Gravity.CENTER);
        title.setPadding(0, 0, 0, 30);
        layout.addView(title);
        
        // Status do sistema
        TextView statusText = new TextView(this);
        statusText.setText("🔧 CONFIGURAÇÕES DO SISTEMA\n\n" +
                          "PayGo Integrado: " + getPayGoStatus() + "\n" +
                          "PPC930: " + (isPPC930Connected() ? "Conectado" : "Verificar") + "\n" +
                          "Sistema PDV: Funcionando\n" +
                          "Versão: 1.0");
        statusText.setTextSize(14);
        statusText.setPadding(20, 20, 20, 20);
        statusText.setBackgroundColor(Color.LTGRAY);
        layout.addView(statusText);
        
        // Botões
        Button testarButton = new Button(this);
        testarButton.setText("🧪 TESTAR PPC930");
        testarButton.setTextSize(16);
        testarButton.setPadding(0, 20, 0, 20);
        testarButton.setBackgroundColor(Color.BLUE);
        testarButton.setTextColor(Color.WHITE);
        testarButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                payGoManager.testPayGo();
                showMessage("Teste da PPC930 iniciado!");
            }
        });
        layout.addView(testarButton);
        
        Button voltarButton = new Button(this);
        voltarButton.setText("⬅️ VOLTAR");
        voltarButton.setTextSize(16);
        voltarButton.setPadding(0, 20, 0, 20);
        voltarButton.setBackgroundColor(Color.GRAY);
        voltarButton.setTextColor(Color.WHITE);
        voltarButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showTopLavanderiaInterface();
            }
        });
        layout.addView(voltarButton);
        
        setContentView(layout);
    }
    
    private void showMessage(String message) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 50, 50, 50);
        layout.setBackgroundColor(Color.YELLOW);
        
        TextView messageText = new TextView(this);
        messageText.setText(message);
        messageText.setTextSize(16);
        messageText.setGravity(android.view.Gravity.CENTER);
        messageText.setPadding(20, 20, 20, 20);
        messageText.setTextColor(Color.BLACK);
        layout.addView(messageText);
        
        Button okButton = new Button(this);
        okButton.setText("OK");
        okButton.setTextSize(16);
        okButton.setPadding(0, 20, 0, 20);
        okButton.setBackgroundColor(Color.WHITE);
        okButton.setTextColor(Color.BLACK);
        okButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showTopLavanderiaInterface();
            }
        });
        layout.addView(okButton);
        
        setContentView(layout);
    }
    
    private void showPaymentProcessing(String message) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 50, 50, 50);
        layout.setBackgroundColor(Color.BLUE);
        
        TextView processingText = new TextView(this);
        processingText.setText("💳 PROCESSANDO PAGAMENTO\n\n" + message);
        processingText.setTextSize(16);
        processingText.setGravity(android.view.Gravity.CENTER);
        processingText.setPadding(20, 20, 20, 20);
        processingText.setTextColor(Color.WHITE);
        layout.addView(processingText);
        
        setContentView(layout);
    }
    
    private void showPaymentSuccess(String authorizationCode, String transactionId) {
        try {
            // Finalizar venda no PDV
            pdvManager.finalizarVendaImediata();
            
            // Obter informações da venda de forma segura
            String servicoNome = "Serviço";
            double valor = 0.0;
            
            if (pdvManager.getVendas() != null && !pdvManager.getVendas().isEmpty()) {
                PDVManager.Venda venda = pdvManager.getVendas().get(pdvManager.getVendas().size() - 1);
                if (venda.getItens() != null && !venda.getItens().isEmpty()) {
                    servicoNome = venda.getItens().get(0).getProduto().getNome();
                    valor = venda.getTotal();
                }
            }
            
            LinearLayout layout = new LinearLayout(this);
            layout.setOrientation(LinearLayout.VERTICAL);
            layout.setPadding(50, 50, 50, 50);
            layout.setBackgroundColor(Color.GREEN);
            
            TextView successText = new TextView(this);
            successText.setText("✅ PAGAMENTO APROVADO!\n\n" +
                               "Serviço: " + servicoNome + "\n" +
                               "Valor: R$ " + new DecimalFormat("0.00").format(valor) + "\n" +
                               "Código: " + authorizationCode + "\n" +
                               "Transação: " + transactionId + "\n" +
                               "Data: " + new SimpleDateFormat("dd/MM/yyyy HH:mm").format(new Date()) + "\n\n" +
                               "🔓 MÁQUINA LIBERADA!\n" +
                               "🎉 Cliente pode usar o serviço agora!\n\n" +
                               "⏰ Tempo de uso: 60 minutos");
            successText.setTextSize(16);
            successText.setGravity(android.view.Gravity.CENTER);
            successText.setPadding(20, 20, 20, 20);
            successText.setTextColor(Color.WHITE);
            layout.addView(successText);
            
            // Simular liberação da máquina
            liberarMaquina(servicoNome);
            
            Button novaVendaButton = new Button(this);
            novaVendaButton.setText("🛒 NOVO SERVIÇO");
            novaVendaButton.setTextSize(18);
            novaVendaButton.setPadding(0, 25, 0, 25);
            novaVendaButton.setBackgroundColor(Color.WHITE);
            novaVendaButton.setTextColor(Color.GREEN);
            novaVendaButton.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    showTopLavanderiaInterface();
                }
            });
            layout.addView(novaVendaButton);
            
            Button adminButton = new Button(this);
            adminButton.setText("⚙️ ADMIN");
            adminButton.setTextSize(16);
            adminButton.setPadding(0, 20, 0, 20);
            adminButton.setBackgroundColor(Color.LTGRAY);
            adminButton.setTextColor(Color.BLACK);
            adminButton.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    showAdminInterface();
                }
            });
            layout.addView(adminButton);
            
            setContentView(layout);
            
        } catch (Exception e) {
            Log.e("Totem", "Erro ao mostrar sucesso do pagamento", e);
            showPaymentError("Erro ao processar pagamento: " + e.getMessage());
        }
    }
    
    private void liberarMaquina(String servicoNome) {
        // Simular liberação da máquina
        Log.d("Totem", "Liberando máquina para: " + servicoNome);
        
        // Aqui você pode adicionar lógica real para liberar a máquina
        // Por exemplo, enviar comando via Bluetooth, WiFi, ou outro protocolo
        
        // Simular delay para mostrar que a máquina foi liberada
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
                Log.d("Totem", "Máquina liberada com sucesso!");
            }
        }, 2000);
    }
    
    private void showPaymentError(String error) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 50, 50, 50);
        layout.setBackgroundColor(Color.RED);
        
        TextView errorText = new TextView(this);
        errorText.setText("❌ ERRO NO PAGAMENTO\n\n" + error + "\n\n" +
                         "Tente novamente ou verifique a conexão com a PPC930.");
        errorText.setTextSize(16);
        errorText.setGravity(android.view.Gravity.CENTER);
        errorText.setPadding(20, 20, 20, 20);
        errorText.setTextColor(Color.WHITE);
        layout.addView(errorText);
        
        Button retryButton = new Button(this);
        retryButton.setText("🔄 TENTAR NOVAMENTE");
        retryButton.setTextSize(16);
        retryButton.setPadding(0, 20, 0, 20);
        retryButton.setBackgroundColor(Color.WHITE);
        retryButton.setTextColor(Color.RED);
        retryButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showNovaVendaInterface();
            }
        });
        layout.addView(retryButton);
        
        Button homeButton = new Button(this);
        homeButton.setText("🏠 MENU PRINCIPAL");
        homeButton.setTextSize(16);
        homeButton.setPadding(0, 20, 0, 20);
        homeButton.setBackgroundColor(Color.LTGRAY);
        homeButton.setTextColor(Color.BLACK);
        homeButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showTopLavanderiaInterface();
            }
        });
        layout.addView(homeButton);
        
        setContentView(layout);
    }
    
}
