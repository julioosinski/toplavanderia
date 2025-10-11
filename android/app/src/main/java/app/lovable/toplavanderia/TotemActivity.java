package app.lovable.toplavanderia;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.GridLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;


import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
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
    private MachineStatusMonitor statusMonitor;
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
        
        // Verificar se totem está configurado
        if (!supabaseHelper.isConfigured()) {
            Log.d(TAG, "Totem não configurado - exibindo tela de configuração");
            showConfigurationScreen();
            return;
        }
        
        // Configurar listeners
        supabaseHelper.setOnMachinesLoadedListener(new SupabaseHelper.OnMachinesLoadedListener() {
            @Override
            public void onMachinesLoaded(List<SupabaseHelper.Machine> loadedMachines) {
                runOnUiThread(() -> {
                    Log.d(TAG, "Dados reais do Supabase recebidos, atualizando interface...");
                    machines = loadedMachines;
                    displayMachines();
                });
            }
        });
        
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
        
        // Criar monitor de status em tempo real
        statusMonitor = new MachineStatusMonitor(supabaseHelper);
        statusMonitor.setListener(statuses -> {
            // Atualizar UI com status real-time
            runOnUiThread(() -> updateMachineStatuses(statuses));
        });
        
        // Criar interface
        createTotemInterface();
        
        // Carregar máquinas
        loadMachines();
        
        // Iniciar atualização de tempo
        startTimeUpdater();
        
        Log.d(TAG, "TotemActivity criada com sucesso");
    }
    
    @Override
    protected void onResume() {
        super.onResume();
        if (statusMonitor != null) {
            statusMonitor.startMonitoring();
            Log.d(TAG, "Monitor de status iniciado");
        }
    }
    
    @Override
    protected void onPause() {
        super.onPause();
        if (statusMonitor != null) {
            statusMonitor.stopMonitoring();
            Log.d(TAG, "Monitor de status pausado");
        }
    }
    
    private void updateMachineStatuses(List<MachineStatusMonitor.MachineStatus> statuses) {
        if (machines == null || statuses == null) return;
        
        Log.d(TAG, "Atualizando status de " + statuses.size() + " máquinas");
        
        // Atualizar lista de máquinas com status real
        for (MachineStatusMonitor.MachineStatus status : statuses) {
            for (SupabaseHelper.Machine machine : machines) {
                if (machine.getId().equals(status.machineId)) {
                    // Atualizar status da máquina
                    machine.setEsp32Online(status.esp32Online);
                    
                    // Mapear computed status para status da máquina
                    if (status.isAvailable()) {
                        machine.setStatus("LIVRE");
                    } else if (status.isRunning()) {
                        machine.setStatus("OCUPADA");
                    } else if (status.isMaintenance()) {
                        machine.setStatus("MANUTENCAO");
                    } else {
                        machine.setStatus("OFFLINE");
                    }
                    
                    break;
                }
            }
        }
        
        // Atualizar display das máquinas
        displayMachines();
    }
    
    private void createTotemInterface() {
        // Layout principal com ScrollView para evitar overflow
        ScrollView scrollView = new ScrollView(this);
        scrollView.setFillViewport(true);
        scrollView.setBackgroundColor(Color.parseColor("#0D1117"));
        
        LinearLayout mainLayout = new LinearLayout(this);
        mainLayout.setOrientation(LinearLayout.VERTICAL);
        mainLayout.setBackgroundColor(Color.parseColor("#0D1117"));
        mainLayout.setPadding(20, 30, 20, 30);
        
        // Logo da lavanderia (se disponível)
        String logoUrl = supabaseHelper.getLaundryLogo();
        if (logoUrl != null && !logoUrl.isEmpty()) {
            ImageView logoImage = new ImageView(this);
            LinearLayout.LayoutParams logoParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                200 // altura em pixels
            );
            logoParams.gravity = android.view.Gravity.CENTER;
            logoParams.bottomMargin = 20;
            logoImage.setLayoutParams(logoParams);
            logoImage.setAdjustViewBounds(true);
            logoImage.setScaleType(ImageView.ScaleType.FIT_CENTER);
            mainLayout.addView(logoImage);
            
            // Carregar logo em background
            new Thread(() -> {
                try {
                    URL url = new URL(logoUrl);
                    HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                    connection.setDoInput(true);
                    connection.connect();
                    InputStream input = connection.getInputStream();
                    Bitmap bitmap = BitmapFactory.decodeStream(input);
                    
                    runOnUiThread(() -> logoImage.setImageBitmap(bitmap));
                } catch (Exception e) {
                    Log.e(TAG, "Erro ao carregar logo", e);
                }
            }).start();
        }
        
        // Título da lavanderia dinâmico
        TextView titleText = new TextView(this);
        String laundryName = supabaseHelper.getLaundryName();
        titleText.setText("🧺 " + laundryName.toUpperCase());
        titleText.setTextSize(28);
        titleText.setTextColor(Color.WHITE);
        titleText.setGravity(android.view.Gravity.CENTER);
        titleText.setPadding(0, 0, 0, 40);
        titleText.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        mainLayout.addView(titleText);
        
        // Status de conectividade (oculto)
        statusText = new TextView(this);
        statusText.setVisibility(android.view.View.GONE);
        mainLayout.addView(statusText);
        
        // Container de máquinas
        machinesContainer = new LinearLayout(this);
        machinesContainer.setOrientation(LinearLayout.VERTICAL);
        machinesContainer.setPadding(0, 10, 0, 0);
        mainLayout.addView(machinesContainer);
        
        scrollView.addView(mainLayout);
        setContentView(scrollView);
    }
    
    
    private void loadMachines() {
        Log.d(TAG, "Carregando máquinas do Supabase...");
        
        machines = supabaseHelper.getAllMachines();
        displayMachines();
        
        Log.d(TAG, "Interface inicial carregada, aguardando dados reais do Supabase...");
    }
    
    private void displayMachines() {
        machinesContainer.removeAllViews();
        
        Log.d(TAG, "=== EXIBINDO MÁQUINAS ===");
        Log.d(TAG, "Total de máquinas: " + machines.size());
        
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
        
        // Linha de lavadoras (parte superior)
        if (!lavadoras.isEmpty()) {
            createMachineRow("🧺 LAVADORAS", lavadoras);
        }
        
        // Linha de secadoras (parte inferior)
        if (!secadoras.isEmpty()) {
            createMachineRow("🌪️ SECADORAS", secadoras);
        }
        
        Log.d(TAG, "Interface atualizada - Lavadoras: " + lavadoras.size() + ", Secadoras: " + secadoras.size());
    }
    
    private void createMachineRow(String title, List<SupabaseHelper.Machine> machines) {
        // Título da seção com estilo moderno
        TextView sectionTitle = new TextView(this);
        sectionTitle.setText(title);
        sectionTitle.setTextSize(20); // Reduzido de 24 para 20
        sectionTitle.setTextColor(Color.parseColor("#58A6FF")); // Azul claro
        sectionTitle.setGravity(android.view.Gravity.CENTER);
        sectionTitle.setPadding(0, 20, 0, 15); // Reduzido padding
        sectionTitle.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        machinesContainer.addView(sectionTitle);
        
        // Linha de máquinas com espaçamento
        LinearLayout machineRow = new LinearLayout(this);
        machineRow.setOrientation(LinearLayout.HORIZONTAL);
        machineRow.setGravity(android.view.Gravity.CENTER);
        machineRow.setPadding(0, 0, 0, 30); // Reduzido de 50 para 30
        
        for (SupabaseHelper.Machine machine : machines) {
            Button machineButton = createMachineButton(machine);
            machineRow.addView(machineButton);
        }
        
        machinesContainer.addView(machineRow);
    }
    
    
    private Button createMachineButton(SupabaseHelper.Machine machine) {
        Button button = new Button(this);
        
        // Verificar disponibilidade baseada no ESP32 e status da máquina
        String status = machine.getStatus();
        boolean isOnline = isMachineOnline(machine);
        boolean isAvailable = isOnline && "LIVRE".equals(status);
        
        Log.d(TAG, "Criando botão para " + machine.getName() + " - Status: " + status + ", ESP32 Online: " + isOnline + ", Disponível: " + isAvailable);
        
        if (isAvailable) {
            button.setText(machine.getName() + "\n🟢 ONLINE\nDISPONÍVEL");
            button.setBackgroundColor(Color.parseColor("#238636")); // Verde GitHub
            button.setTextColor(Color.WHITE);
            button.setEnabled(true);
            button.setElevation(12);
        } else if (isOnline && "OCUPADA".equals(status)) {
            button.setText(machine.getName() + "\n🟡 ONLINE\nOCUPADA");
            button.setBackgroundColor(Color.parseColor("#D29922")); // Amarelo
            button.setTextColor(Color.WHITE);
            button.setEnabled(false);
            button.setElevation(6);
        } else if (isOnline && "MANUTENCAO".equals(status)) {
            button.setText(machine.getName() + "\n🟡 ONLINE\nMANUTENÇÃO");
            button.setBackgroundColor(Color.parseColor("#FF9800")); // Laranja
            button.setTextColor(Color.WHITE);
            button.setEnabled(false);
            button.setElevation(6);
        } else if (!isOnline) {
            button.setText(machine.getName() + "\n🔴 OFFLINE\nINDISPONÍVEL");
            button.setBackgroundColor(Color.parseColor("#21262D")); // Cinza escuro
            button.setTextColor(Color.parseColor("#7D8590"));
            button.setEnabled(false);
            button.setElevation(2);
        } else {
            // ESP32 online mas status desconhecido
            button.setText(machine.getName() + "\n🟡 ONLINE\n" + status);
            button.setBackgroundColor(Color.parseColor("#D29922")); // Amarelo
            button.setTextColor(Color.WHITE);
            button.setEnabled(false);
            button.setElevation(6);
        }
        
        button.setTextSize(14); // Reduzido de 16 para 14
        button.setPadding(15, 20, 15, 20); // Reduzido padding
        button.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        
        // Layout params responsivos
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        params.setMargins(10, 5, 10, 5); // Reduzido margens
        params.width = 180; // Reduzido de 220 para 180
        params.height = 120; // Reduzido de 140 para 120
        button.setLayoutParams(params);
        
        // Click listener apenas para máquinas disponíveis
        if (isAvailable) {
            button.setOnClickListener(v -> {
                Log.d(TAG, "Máquina selecionada: " + machine.getName());
                selectMachine(machine);
            });
        }
        
        Log.d(TAG, "Botão criado para: " + machine.getName() + " - " + status + " (Online: " + isOnline + ", Disponível: " + isAvailable + ")");
        return button;
    }
    
    private boolean isMachineOnline(SupabaseHelper.Machine machine) {
        // Verificar status real do ESP32
        boolean isOnline = machine.isEsp32Online();
        Log.d(TAG, "Verificando ESP32 para " + machine.getName() + ": " + isOnline + " (Status: " + machine.getStatus() + ")");
        return isOnline;
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
            
            // NOVO: Acionar ESP32 via Edge Function
            Log.d(TAG, "Acionando ESP32 para máquina: " + selectedMachine.getName());
            boolean esp32Activated = supabaseHelper.activateEsp32Relay(
                selectedMachine.getEsp32Id(),      // ex: "lavadora_01"
                selectedMachine.getRelayPin(),     // ex: 1
                selectedMachine.getId(),           // UUID da máquina
                transactionId,                     // ID da transação
                selectedMachine.getDuration()      // Tempo em minutos
            );
            
            if (esp32Activated) {
                Log.d(TAG, "✅ ESP32 acionado com sucesso - máquina liberada");
                
                // Iniciar uso da máquina com tempo de duração
                boolean statusUpdated = supabaseHelper.startMachineUsage(selectedMachine.getId(), selectedMachine.getDuration());
                
                // Mostrar tela de sucesso
                showPaymentSuccess(authorizationCode, transactionId);
            } else {
                Log.e(TAG, "❌ Falha ao acionar ESP32");
                handlePaymentError("Pagamento aprovado mas a máquina não pôde ser acionada. Entre em contato com a administração.");
            }
            
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
    
    private void showConfigurationScreen() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setBackgroundColor(Color.parseColor("#0D1117"));
        layout.setPadding(40, 40, 40, 40);
        layout.setGravity(android.view.Gravity.CENTER);
        
        // Logo/Título
        TextView titleText = new TextView(this);
        titleText.setText("🧺 CONFIGURAÇÃO INICIAL\n\nTOP LAVANDERIA");
        titleText.setTextSize(28);
        titleText.setTextColor(Color.WHITE);
        titleText.setGravity(android.view.Gravity.CENTER);
        titleText.setPadding(0, 0, 0, 40);
        titleText.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        layout.addView(titleText);
        
        // Instruções
        TextView instructionsText = new TextView(this);
        instructionsText.setText("Digite o CNPJ da lavanderia\n(sem pontuação)");
        instructionsText.setTextSize(16);
        instructionsText.setTextColor(Color.parseColor("#7D8590"));
        instructionsText.setGravity(android.view.Gravity.CENTER);
        instructionsText.setPadding(0, 0, 0, 30);
        layout.addView(instructionsText);
        
        // Campo de entrada do CNPJ
        android.widget.EditText cnpjInput = new android.widget.EditText(this);
        cnpjInput.setHint("00000000000000");
        cnpjInput.setTextSize(18);
        cnpjInput.setTextColor(Color.WHITE);
        cnpjInput.setHintTextColor(Color.parseColor("#7D8590"));
        cnpjInput.setBackgroundColor(Color.parseColor("#21262D"));
        cnpjInput.setPadding(30, 30, 30, 30);
        cnpjInput.setGravity(android.view.Gravity.CENTER);
        cnpjInput.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);
        cnpjInput.setMaxLines(1);
        
        LinearLayout.LayoutParams inputParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        inputParams.setMargins(0, 0, 0, 40);
        cnpjInput.setLayoutParams(inputParams);
        layout.addView(cnpjInput);
        
        // Mensagem de status
        TextView statusMessage = new TextView(this);
        statusMessage.setText("");
        statusMessage.setTextSize(14);
        statusMessage.setGravity(android.view.Gravity.CENTER);
        statusMessage.setPadding(20, 0, 20, 20);
        statusMessage.setVisibility(View.GONE);
        layout.addView(statusMessage);
        
        // Botão de confirmar
        Button confirmButton = new Button(this);
        confirmButton.setText("✅ CONFIGURAR");
        confirmButton.setTextSize(18);
        confirmButton.setPadding(40, 30, 40, 30);
        confirmButton.setBackgroundColor(Color.parseColor("#238636"));
        confirmButton.setTextColor(Color.WHITE);
        confirmButton.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        
        confirmButton.setOnClickListener(v -> {
            String cnpj = cnpjInput.getText().toString().trim();
            
            if (cnpj.length() != 14) {
                statusMessage.setText("❌ CNPJ deve ter 14 dígitos");
                statusMessage.setTextColor(Color.parseColor("#F85149"));
                statusMessage.setVisibility(View.VISIBLE);
                return;
            }
            
            // Desabilitar botão e mostrar loading
            confirmButton.setEnabled(false);
            confirmButton.setText("⏳ CONFIGURANDO...");
            statusMessage.setText("🔄 Buscando lavanderia no sistema...");
            statusMessage.setTextColor(Color.parseColor("#58A6FF"));
            statusMessage.setVisibility(View.VISIBLE);
            
            // Configurar em background
            new Thread(() -> {
                boolean success = supabaseHelper.configureLaundryByCNPJ(cnpj);
                
                runOnUiThread(() -> {
                    if (success) {
                        statusMessage.setText("✅ Configurado: " + supabaseHelper.getLaundryName());
                        statusMessage.setTextColor(Color.parseColor("#3FB950"));
                        
                        // Aguardar 2 segundos e reiniciar activity
                        new Handler(Looper.getMainLooper()).postDelayed(() -> {
                            recreate();
                        }, 2000);
                    } else {
                        statusMessage.setText("❌ CNPJ não encontrado ou lavanderia inativa");
                        statusMessage.setTextColor(Color.parseColor("#F85149"));
                        confirmButton.setEnabled(true);
                        confirmButton.setText("✅ CONFIGURAR");
                    }
                });
            }).start();
        });
        
        layout.addView(confirmButton);
        
        setContentView(layout);
    }
    
    private void updateConnectivityStatus() {
        if (statusText != null) {
            if (supabaseHelper.isOnline()) {
                statusText.setText("✅ " + machines.size() + " máquinas carregadas");
                statusText.setTextColor(Color.parseColor("#4CAF50"));
            } else {
                statusText.setText("🔄 Carregando máquinas...");
                statusText.setTextColor(Color.parseColor("#FF9800"));
            }
        }
    }
    
    @Override
    protected void onResume() {
        super.onResume();
        // Recarregar máquinas quando voltar para a tela
        loadMachines();
    }
}
