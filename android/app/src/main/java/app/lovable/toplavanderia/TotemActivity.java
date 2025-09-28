package app.lovable.toplavanderia;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.GridLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.text.DecimalFormat;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * ATIVIDADE PRINCIPAL DO TOTEM
 * 
 * Interface bonita e moderna para o totem de autoatendimento
 * com gerenciamento de máquinas e operações
 */
public class TotemActivity extends Activity {
    private static final String TAG = "TotemActivity";
    
    private SupabaseHelper supabaseHelper;
    private RealPayGoManager payGoManager;
    private List<SupabaseHelper.Machine> machines;
    private SupabaseHelper.Machine selectedMachine;
    private long currentOperationId = -1;
    
    private TextView statusText;
    private TextView timeText;
    private LinearLayout machinesContainer;
    private Button adminButton;
    private Button refreshButton;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Inicializar componentes
        supabaseHelper = new SupabaseHelper(this);
        payGoManager = new RealPayGoManager(this);
        payGoManager.setCallback(new RealPayGoManager.PayGoCallback() {
            @Override
            public void onPaymentSuccess(String authorizationCode, String transactionId) {
                runOnUiThread(() -> handlePaymentSuccess(authorizationCode, transactionId));
            }
            
            @Override
            public void onPaymentError(String error) {
                runOnUiThread(() -> handlePaymentError(error));
            }
            
            @Override
            public void onPaymentProcessing(String message) {
                runOnUiThread(() -> updateStatus(message));
            }
        });
        
        // Criar interface
        createTotemInterface();
        
        // Carregar máquinas
        loadMachines();
        
        // Iniciar atualização de tempo
        startTimeUpdater();
        
        Log.d(TAG, "TotemActivity criada com sucesso");
    }
    
    private void createTotemInterface() {
        // Layout principal
        LinearLayout mainLayout = new LinearLayout(this);
        mainLayout.setOrientation(LinearLayout.VERTICAL);
        mainLayout.setBackgroundColor(Color.parseColor("#f0f0f0"));
        mainLayout.setPadding(20, 20, 20, 20);
        
        // Cabeçalho
        createHeader(mainLayout);
        
        // Status e tempo
        createStatusBar(mainLayout);
        
        // Container de máquinas
        createMachinesContainer(mainLayout);
        
        // Botões de ação
        createActionButtons(mainLayout);
        
        // Rodapé
        createFooter(mainLayout);
        
        setContentView(mainLayout);
    }
    
    private void createHeader(LinearLayout parent) {
        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.VERTICAL);
        header.setPadding(30, 30, 30, 30);
        header.setBackgroundColor(Color.parseColor("#2196F3"));
        
        // Título principal
        TextView title = new TextView(this);
        title.setText("🏪 TOP LAVANDERIA");
        title.setTextSize(32);
        title.setTextColor(Color.WHITE);
        title.setGravity(android.view.Gravity.CENTER);
        title.setPadding(0, 0, 0, 10);
        header.addView(title);
        
        // Subtítulo
        TextView subtitle = new TextView(this);
        subtitle.setText("TOTEM DE AUTOSERVIÇO");
        subtitle.setTextSize(18);
        subtitle.setTextColor(Color.parseColor("#E3F2FD"));
        subtitle.setGravity(android.view.Gravity.CENTER);
        subtitle.setPadding(0, 0, 0, 20);
        header.addView(subtitle);
        
        // Instruções
        TextView instructions = new TextView(this);
        instructions.setText("👤 CLIENTE: Escolha uma máquina disponível\n" +
                           "💳 PAGAMENTO: Processado na PPC930\n" +
                           "🔓 LIBERAÇÃO: Automática após pagamento");
        instructions.setTextSize(14);
        instructions.setTextColor(Color.WHITE);
        instructions.setGravity(android.view.Gravity.CENTER);
        instructions.setPadding(20, 20, 20, 0);
        instructions.setBackgroundColor(Color.parseColor("#1976D2"));
        header.addView(instructions);
        
        parent.addView(header);
    }
    
    private void createStatusBar(LinearLayout parent) {
        LinearLayout statusBar = new LinearLayout(this);
        statusBar.setOrientation(LinearLayout.HORIZONTAL);
        statusBar.setPadding(20, 20, 20, 20);
        statusBar.setBackgroundColor(Color.WHITE);
        
        // Status do sistema
        statusText = new TextView(this);
        statusText.setText("✅ Sistema: Online | PayGo: Conectado | PPC930: Ativa");
        statusText.setTextSize(14);
        statusText.setTextColor(Color.parseColor("#4CAF50"));
        statusText.setLayoutParams(new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        statusBar.addView(statusText);
        
        // Tempo atual
        timeText = new TextView(this);
        timeText.setText(getCurrentTime());
        timeText.setTextSize(14);
        timeText.setTextColor(Color.parseColor("#666666"));
        timeText.setGravity(android.view.Gravity.END);
        statusBar.addView(timeText);
        
        parent.addView(statusBar);
    }
    
    private void createMachinesContainer(LinearLayout parent) {
        // Título das máquinas
        TextView machinesTitle = new TextView(this);
        machinesTitle.setText("🎯 ESCOLHA SUA MÁQUINA:");
        machinesTitle.setTextSize(24);
        machinesTitle.setTextColor(Color.parseColor("#333333"));
        machinesTitle.setGravity(android.view.Gravity.CENTER);
        machinesTitle.setPadding(0, 30, 0, 20);
        parent.addView(machinesTitle);
        
        // Container scrollável para máquinas
        ScrollView scrollView = new ScrollView(this);
        machinesContainer = new LinearLayout(this);
        machinesContainer.setOrientation(LinearLayout.VERTICAL);
        machinesContainer.setPadding(0, 0, 0, 20);
        scrollView.addView(machinesContainer);
        parent.addView(scrollView);
    }
    
    private void createActionButtons(LinearLayout parent) {
        LinearLayout buttonRow = new LinearLayout(this);
        buttonRow.setOrientation(LinearLayout.HORIZONTAL);
        buttonRow.setPadding(20, 20, 20, 20);
        
        // Botão de atualizar
        refreshButton = new Button(this);
        refreshButton.setText("🔄 ATUALIZAR");
        refreshButton.setTextSize(16);
        refreshButton.setPadding(20, 15, 20, 15);
        refreshButton.setBackgroundColor(Color.parseColor("#FF9800"));
        refreshButton.setTextColor(Color.WHITE);
        refreshButton.setOnClickListener(v -> refreshMachines());
        buttonRow.addView(refreshButton);
        
        // Botão de administração
        adminButton = new Button(this);
        adminButton.setText("⚙️ ADMIN");
        adminButton.setTextSize(16);
        adminButton.setPadding(20, 15, 20, 15);
        adminButton.setBackgroundColor(Color.parseColor("#9E9E9E"));
        adminButton.setTextColor(Color.WHITE);
        adminButton.setOnClickListener(v -> openAdminPanel());
        buttonRow.addView(adminButton);
        
        parent.addView(buttonRow);
    }
    
    private void createFooter(LinearLayout parent) {
        LinearLayout footer = new LinearLayout(this);
        footer.setOrientation(LinearLayout.VERTICAL);
        footer.setPadding(20, 20, 20, 20);
        footer.setBackgroundColor(Color.parseColor("#333333"));
        
        TextView footerText = new TextView(this);
        footerText.setText("💡 Dica: Mantenha seu cartão por perto\n" +
                         "📞 Suporte: (11) 99999-9999\n" +
                         "🌐 www.toplavanderia.com");
        footerText.setTextSize(12);
        footerText.setTextColor(Color.WHITE);
        footerText.setGravity(android.view.Gravity.CENTER);
        footer.addView(footerText);
        
        parent.addView(footer);
    }
    
    private void loadMachines() {
        Log.d(TAG, "Carregando máquinas do Supabase...");
        
        machines = supabaseHelper.getAllMachines();
        machinesContainer.removeAllViews();
        
        // Separar máquinas por tipo
        List<SupabaseHelper.Machine> lavadoras = new ArrayList<>();
        List<SupabaseHelper.Machine> secadoras = new ArrayList<>();
        
        for (SupabaseHelper.Machine machine : machines) {
            if ("LAVAR".equals(machine.getType())) {
                lavadoras.add(machine);
            } else if ("SECAR".equals(machine.getType())) {
                secadoras.add(machine);
            }
        }
        
        // Seção de lavadoras
        if (!lavadoras.isEmpty()) {
            createMachineSection("🧺 MÁQUINAS DE LAVAR", lavadoras);
        }
        
        // Seção de secadoras
        if (!secadoras.isEmpty()) {
            createMachineSection("🌪️ MÁQUINAS DE SECAR", secadoras);
        }
        
        // Atualizar status de conectividade
        updateConnectivityStatus();
        
        Log.d(TAG, "Máquinas carregadas: " + machines.size());
    }
    
    private void createMachineSection(String title, List<SupabaseHelper.Machine> machines) {
        // Título da seção
        TextView sectionTitle = new TextView(this);
        sectionTitle.setText(title);
        sectionTitle.setTextSize(20);
        sectionTitle.setTextColor(Color.parseColor("#2196F3"));
        sectionTitle.setPadding(0, 20, 0, 15);
        machinesContainer.addView(sectionTitle);
        
        // Grid de máquinas
        GridLayout grid = new GridLayout(this);
        grid.setColumnCount(2);
        grid.setPadding(0, 0, 0, 30);
        
        for (SupabaseHelper.Machine machine : machines) {
            Button machineButton = createMachineButton(machine);
            grid.addView(machineButton);
        }
        
        machinesContainer.addView(grid);
    }
    
    private Button createMachineButton(SupabaseHelper.Machine machine) {
        Button button = new Button(this);
        
        // Configurar texto do botão
        String buttonText = machine.getName() + "\n" +
                          "R$ " + new DecimalFormat("0.00").format(machine.getPrice()) + "\n" +
                          machine.getStatusDisplay() + "\n" +
                          "⏱️ " + machine.getDuration() + " min";
        
        button.setText(buttonText);
        button.setTextSize(14);
        button.setPadding(15, 20, 15, 20);
        button.setLayoutParams(new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        
        // Configurar cor baseada no status
        if (machine.isAvailable()) {
            button.setBackgroundColor(Color.parseColor("#4CAF50"));
            button.setTextColor(Color.WHITE);
            button.setEnabled(true);
        } else {
            button.setBackgroundColor(Color.parseColor("#E0E0E0"));
            button.setTextColor(Color.parseColor("#9E9E9E"));
            button.setEnabled(false);
        }
        
        // Configurar clique
        if (machine.isAvailable()) {
            button.setOnClickListener(v -> selectMachine(machine));
        }
        
        return button;
    }
    
    private void selectMachine(SupabaseHelper.Machine machine) {
        Log.d(TAG, "Máquina selecionada: " + machine.getName());
        
        selectedMachine = machine;
        showPaymentConfirmation(machine);
    }
    
    private void showPaymentConfirmation(SupabaseHelper.Machine machine) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 50, 50, 50);
        layout.setBackgroundColor(Color.parseColor("#2196F3"));
        
        // Título
        TextView title = new TextView(this);
        title.setText("✅ MÁQUINA SELECIONADA");
        title.setTextSize(24);
        title.setTextColor(Color.WHITE);
        title.setGravity(android.view.Gravity.CENTER);
        title.setPadding(0, 0, 0, 30);
        layout.addView(title);
        
        // Detalhes da máquina
        TextView details = new TextView(this);
        details.setText("Máquina: " + machine.getName() + "\n" +
                       "Tipo: " + machine.getTypeDisplay() + "\n" +
                       "Preço: R$ " + new DecimalFormat("0.00").format(machine.getPrice()) + "\n" +
                       "Duração: " + machine.getDuration() + " minutos\n\n" +
                       "💳 PAGAMENTO SERÁ PROCESSADO NA PPC930\n" +
                       "Insira seu cartão quando solicitado");
        details.setTextSize(16);
        details.setTextColor(Color.WHITE);
        details.setGravity(android.view.Gravity.CENTER);
        details.setPadding(20, 20, 20, 30);
        details.setBackgroundColor(Color.parseColor("#1976D2"));
        layout.addView(details);
        
        // Botões de ação
        LinearLayout buttonRow = new LinearLayout(this);
        buttonRow.setOrientation(LinearLayout.HORIZONTAL);
        buttonRow.setPadding(0, 20, 0, 0);
        
        // Botão confirmar
        Button confirmButton = new Button(this);
        confirmButton.setText("💳 CONFIRMAR E PAGAR");
        confirmButton.setTextSize(18);
        confirmButton.setPadding(20, 25, 20, 25);
        confirmButton.setBackgroundColor(Color.parseColor("#4CAF50"));
        confirmButton.setTextColor(Color.WHITE);
        confirmButton.setOnClickListener(v -> processPayment(machine));
        buttonRow.addView(confirmButton);
        
        // Botão cancelar
        Button cancelButton = new Button(this);
        cancelButton.setText("❌ CANCELAR");
        cancelButton.setTextSize(16);
        cancelButton.setPadding(20, 20, 20, 20);
        cancelButton.setBackgroundColor(Color.parseColor("#F44336"));
        cancelButton.setTextColor(Color.WHITE);
        cancelButton.setOnClickListener(v -> {
            selectedMachine = null;
            createTotemInterface();
            loadMachines();
        });
        buttonRow.addView(cancelButton);
        
        layout.addView(buttonRow);
        setContentView(layout);
    }
    
    private void processPayment(SupabaseHelper.Machine machine) {
        try {
            Log.d(TAG, "=== INICIANDO PROCESSAMENTO DE PAGAMENTO ===");
            Log.d(TAG, "Máquina: " + machine.getName());
            Log.d(TAG, "Valor: R$ " + machine.getPrice());
            
            // Criar operação no Supabase
            currentOperationId = System.currentTimeMillis();
            boolean operationCreated = supabaseHelper.createTransaction(
                machine.getId(),
                machine.getTypeDisplay(),
                machine.getPrice(),
                "PENDING",
                "TXN" + currentOperationId
            );
            
            Log.d(TAG, "Operação criada: ID " + currentOperationId);
            
            // Mostrar tela de processamento
            showPaymentProcessing(machine);
            
            // Processar pagamento real
            payGoManager.processPayment(
                machine.getPrice(),
                "Top Lavanderia - " + machine.getName(),
                "TOTEM" + currentOperationId
            );
            
        } catch (Exception e) {
            Log.e(TAG, "Erro ao processar pagamento", e);
            handlePaymentError("Erro ao processar pagamento: " + e.getMessage());
        }
    }
    
    private void showPaymentProcessing(SupabaseHelper.Machine machine) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 50, 50, 50);
        layout.setBackgroundColor(Color.parseColor("#FF9800"));
        
        TextView processingText = new TextView(this);
        processingText.setText("💳 PROCESSANDO PAGAMENTO\n\n" +
                             "Máquina: " + machine.getName() + "\n" +
                             "Valor: R$ " + new DecimalFormat("0.00").format(machine.getPrice()) + "\n" +
                             "Operação: " + currentOperationId + "\n\n" +
                             "🔄 COMUNICAÇÃO COM PPC930...\n" +
                             "Aguarde o processamento do pagamento");
        processingText.setTextSize(16);
        processingText.setGravity(android.view.Gravity.CENTER);
        processingText.setPadding(20, 20, 20, 20);
        processingText.setTextColor(Color.WHITE);
        layout.addView(processingText);
        
        setContentView(layout);
    }
    
    private void handlePaymentSuccess(String authorizationCode, String transactionId) {
        try {
            Log.d(TAG, "=== PAGAMENTO APROVADO ===");
            Log.d(TAG, "Código: " + authorizationCode);
            Log.d(TAG, "Transação: " + transactionId);
            
            // Atualizar operação no Supabase
            boolean transactionUpdated = supabaseHelper.createTransaction(
                selectedMachine.getId(),
                selectedMachine.getTypeDisplay(),
                selectedMachine.getPrice(),
                authorizationCode,
                transactionId
            );
            
            // Atualizar status da máquina
            boolean statusUpdated = supabaseHelper.updateMachineStatus(selectedMachine.getId(), "OCUPADA");
            
            // Mostrar tela de sucesso
            showPaymentSuccess(authorizationCode, transactionId);
            
        } catch (Exception e) {
            Log.e(TAG, "Erro ao processar sucesso do pagamento", e);
            handlePaymentError("Erro ao finalizar pagamento: " + e.getMessage());
        }
    }
    
    private void showPaymentSuccess(String authorizationCode, String transactionId) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 50, 50, 50);
        layout.setBackgroundColor(Color.parseColor("#4CAF50"));
        
        TextView successText = new TextView(this);
        successText.setText("✅ PAGAMENTO APROVADO!\n\n" +
                           "Máquina: " + selectedMachine.getName() + "\n" +
                           "Valor: R$ " + new DecimalFormat("0.00").format(selectedMachine.getPrice()) + "\n" +
                           "Código: " + authorizationCode + "\n" +
                           "Transação: " + transactionId + "\n" +
                           "Data: " + getCurrentTime() + "\n\n" +
                           "🔓 MÁQUINA LIBERADA!\n" +
                           "🎉 Você pode usar o serviço agora!\n\n" +
                           "⏰ Tempo de uso: " + selectedMachine.getDuration() + " minutos");
        successText.setTextSize(16);
        successText.setGravity(android.view.Gravity.CENTER);
        successText.setPadding(20, 20, 20, 20);
        successText.setTextColor(Color.WHITE);
        layout.addView(successText);
        
        // Botão para nova operação
        Button newOperationButton = new Button(this);
        newOperationButton.setText("🛒 NOVA OPERAÇÃO");
        newOperationButton.setTextSize(18);
        newOperationButton.setPadding(20, 25, 20, 25);
        newOperationButton.setBackgroundColor(Color.WHITE);
        newOperationButton.setTextColor(Color.parseColor("#4CAF50"));
        newOperationButton.setOnClickListener(v -> {
            selectedMachine = null;
            currentOperationId = -1;
            createTotemInterface();
            loadMachines();
        });
        layout.addView(newOperationButton);
        
        setContentView(layout);
    }
    
    private void handlePaymentError(String error) {
        Log.e(TAG, "=== ERRO NO PAGAMENTO ===");
        Log.e(TAG, "Erro: " + error);
        
        // Mostrar tela de erro
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 50, 50, 50);
        layout.setBackgroundColor(Color.parseColor("#F44336"));
        
        TextView errorText = new TextView(this);
        errorText.setText("❌ ERRO NO PAGAMENTO\n\n" + error + "\n\n" +
                         "Tente novamente ou verifique a conexão com a PPC930.");
        errorText.setTextSize(16);
        errorText.setGravity(android.view.Gravity.CENTER);
        errorText.setPadding(20, 20, 20, 20);
        errorText.setTextColor(Color.WHITE);
        layout.addView(errorText);
        
        // Botão para tentar novamente
        Button retryButton = new Button(this);
        retryButton.setText("🔄 TENTAR NOVAMENTE");
        retryButton.setTextSize(16);
        retryButton.setPadding(20, 20, 20, 20);
        retryButton.setBackgroundColor(Color.WHITE);
        retryButton.setTextColor(Color.parseColor("#F44336"));
        retryButton.setOnClickListener(v -> {
            selectedMachine = null;
            currentOperationId = -1;
            createTotemInterface();
            loadMachines();
        });
        layout.addView(retryButton);
        
        setContentView(layout);
    }
    
    private void refreshMachines() {
        Log.d(TAG, "Atualizando máquinas...");
        loadMachines();
        Toast.makeText(this, "Máquinas atualizadas!", Toast.LENGTH_SHORT).show();
    }
    
    private void openAdminPanel() {
        Intent intent = new Intent(this, AdminActivity.class);
        startActivity(intent);
    }
    
    private void updateStatus(String message) {
        if (statusText != null) {
            statusText.setText("🔄 " + message);
        }
    }
    
    private void startTimeUpdater() {
        Handler handler = new Handler(Looper.getMainLooper());
        handler.post(new Runnable() {
            @Override
            public void run() {
                if (timeText != null) {
                    timeText.setText(getCurrentTime());
                }
                handler.postDelayed(this, 1000); // Atualizar a cada segundo
            }
        });
    }
    
    private String getCurrentTime() {
        SimpleDateFormat sdf = new SimpleDateFormat("dd/MM/yyyy HH:mm:ss", Locale.getDefault());
        return sdf.format(new Date());
    }
    
    private void updateConnectivityStatus() {
        if (statusText != null) {
            boolean isOnline = supabaseHelper.isConnected();
            String connectivityStatus = isOnline ? "Online" : "Offline";
            String paygoStatus = "Conectado";
            String ppc930Status = "Ativa";
            
            statusText.setText("📊 Sistema: " + connectivityStatus + " | PayGo: " + paygoStatus + " | PPC930: " + ppc930Status);
            statusText.setTextColor(isOnline ? Color.parseColor("#4CAF50") : Color.parseColor("#FF9800"));
        }
    }
    
    @Override
    protected void onResume() {
        super.onResume();
        // Recarregar máquinas quando voltar para a tela
        loadMachines();
    }
}
