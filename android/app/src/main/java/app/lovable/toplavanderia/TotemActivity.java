package app.lovable.toplavanderia;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.util.Log;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.widget.EditText;
import android.widget.Button;
import android.widget.GridLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;


import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.DecimalFormat;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * ATIVIDADE PRINCIPAL DO TOTEM
 * 
 * Interface bonita e moderna para o totem de autoatendimento
 * com gerenciamento de máquinas e operações
 */
public class TotemActivity extends Activity {
    private static final String TAG = "TotemActivity";
    /** Tela de sucesso após pagamento antes de voltar à seleção de máquinas. */
    private static final long POST_PAYMENT_SUCCESS_MS = 1000L;
    private static final int ADMIN_SECRET_TAPS = 7;
    private static final long ADMIN_TAP_WINDOW_MS = 3000L;

    private SupabaseHelper supabaseHelper;
    private PaymentManager activePaymentManager;
    private RealPayGoManager payGoManager;
    private CieloLioManager cieloManager;
    private String activeProvider = "paygo";
    private MachineStatusMonitor statusMonitor;
    private List<SupabaseHelper.Machine> machines;
    private SupabaseHelper.Machine selectedMachine;
    private long currentOperationId = -1;
    /** UUID Supabase da transação pending criada antes do pagamento. */
    private String currentPendingTransactionId = null;
    /** credit, debit ou pix — alinhado à constraint do Supabase (transactions.payment_method). */
    private String currentOperationSupabasePaymentMethod = "credit";
    private LinearLayout rootLayout;
    private ScrollView machinesScrollView;

    private TextView statusText;
    private TextView timeText;
    private TextView titleText;
    private LinearLayout machinesContainer;
    private Button adminButton;
    private Button refreshButton;
    private int adminTapCount = 0;
    private final Handler adminTapHandler = new Handler(Looper.getMainLooper());
    private Runnable adminTapResetRunnable;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applyKeepScreenAwake();
        applyImmersiveMode();
        try {
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
            
            // Pagamento: Cielo LIO não carrega PayGo no boot (evita crash na Cielo Store sem PayGo instalado).
            initializePaymentManagers();

            // Unified payment callback
            PaymentCallback paymentCallback = new PaymentCallback() {
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
            };
            activePaymentManager.setCallback(paymentCallback);
            
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
        } catch (Throwable t) {
            Log.e(TAG, "Falha no bootstrap do Totem", t);
            showFatalErrorScreen(t.getMessage() == null ? "Erro ao iniciar aplicativo" : t.getMessage());
        }
    }
    
    @Override
    protected void onResume() {
        super.onResume();
        applyKeepScreenAwake();
        applyImmersiveMode();
        try {
            if (statusMonitor != null) {
                statusMonitor.startMonitoring();
                statusMonitor.requestImmediatePoll();
                Log.d(TAG, "Monitor de status iniciado + poll imediato");
            }
            if (supabaseHelper != null && supabaseHelper.isConfigured()) {
                loadMachines();
            } else {
                Log.d(TAG, "onResume sem configuração do totem; mantendo tela de configuração");
            }
        } catch (Throwable t) {
            Log.e(TAG, "Falha no onResume", t);
            showFatalErrorScreen("Falha ao retomar aplicativo");
        }
    }
    
    @Override
    protected void onPause() {
        super.onPause();
        // Não parar o monitor: no fluxo Cielo o app de pagamento cobre a tela (onPause) e o polling
        // parava por minutos — o status offline só atualizava ao voltar. Kiosk: manter consultas.
        Log.d(TAG, "onPause: monitor de ESP segue ativo em segundo plano");
    }

    @Override
    protected void onDestroy() {
        if (adminTapResetRunnable != null) {
            adminTapHandler.removeCallbacks(adminTapResetRunnable);
        }
        if (statusMonitor != null) {
            statusMonitor.stopMonitoring();
        }
        super.onDestroy();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applyImmersiveMode();
        }
    }
    
    /**
     * Mantém o visor ligado enquanto o totem está em primeiro plano (reforço além de
     * android:keepScreenOn). No app de pagamento Cielo/PayGo o timeout é o do sistema/terminal.
     */
    private void applyKeepScreenAwake() {
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    /**
     * Tela cheia imersiva dentro do totem (compatível com Cielo: não bloqueia o app de pagamento).
     */
    private void applyImmersiveMode() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
            return;
        }
        View decorView = getWindow().getDecorView();
        decorView.setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
        );
    }

    private void handleAdminSecretTap() {
        adminTapCount++;
        if (adminTapResetRunnable != null) {
            adminTapHandler.removeCallbacks(adminTapResetRunnable);
        }
        adminTapResetRunnable = () -> adminTapCount = 0;
        adminTapHandler.postDelayed(adminTapResetRunnable, ADMIN_TAP_WINDOW_MS);

        if (adminTapCount >= ADMIN_SECRET_TAPS) {
            adminTapCount = 0;
            if (adminTapResetRunnable != null) {
                adminTapHandler.removeCallbacks(adminTapResetRunnable);
            }
            showAdminPinDialog();
        }
    }

    private void showAdminPinDialog() {
        final EditText pinInput = new EditText(this);
        pinInput.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_VARIATION_PASSWORD);
        pinInput.setHint("PIN administrativo");
        pinInput.setPadding(dp(16), dp(12), dp(16), dp(12));

        new AlertDialog.Builder(this)
            .setTitle("Acesso administrativo")
            .setMessage("Digite o PIN para abrir configurações do totem.")
            .setView(pinInput)
            .setNegativeButton("Cancelar", null)
            .setPositiveButton("Entrar", (dialog, which) -> {
                String pin = pinInput.getText() != null ? pinInput.getText().toString().trim() : "";
                if (pin.isEmpty()) {
                    Toast.makeText(this, "PIN obrigatório", Toast.LENGTH_SHORT).show();
                    return;
                }
                new Thread(() -> {
                    boolean ok = supabaseHelper != null && supabaseHelper.validateAdminPin(pin);
                    runOnUiThread(() -> {
                        if (ok) {
                            Toast.makeText(this, "Acesso liberado", Toast.LENGTH_SHORT).show();
                            openAdminPanel();
                        } else {
                            Toast.makeText(this, "PIN inválido", Toast.LENGTH_SHORT).show();
                        }
                    });
                }).start();
            })
            .show();
    }

    private void updateMachineStatuses(List<MachineStatusMonitor.MachineStatus> statuses) {
        if (machines == null || statuses == null) return;
        
        Log.d(TAG, "Atualizando status de " + statuses.size() + " máquinas");

        // Se o monitor retornou máquinas que não existem na lista local,
        // isso significa que uma nova máquina foi cadastrada — recarregar lista completa.
        java.util.HashSet<String> localIds = new java.util.HashSet<>();
        for (SupabaseHelper.Machine m : machines) {
            localIds.add(m.getId());
        }
        boolean hasNewMachine = false;
        for (MachineStatusMonitor.MachineStatus status : statuses) {
            if (!localIds.contains(status.machineId)) {
                hasNewMachine = true;
                Log.d(TAG, "Nova máquina detectada pelo monitor: " + status.machineName + " (" + status.machineId + ")");
                break;
            }
        }
        // Se a quantidade de máquinas diminuiu (máquina removida), também recarregar.
        boolean machineRemoved = statuses.size() < machines.size();

        if (hasNewMachine || machineRemoved) {
            Log.d(TAG, "Lista de máquinas mudou — recarregando do Supabase...");
            new Thread(() -> {
                try {
                    List<SupabaseHelper.Machine> fresh = supabaseHelper.refreshMachineById(null) != null
                            ? null : null;
                    // refreshMachineById é para uma máquina — usar getAllMachines para lista completa.
                    // getAllMachines já dispara background fetch e notifica via listener.
                    supabaseHelper.getAllMachines();
                } catch (Exception e) {
                    Log.e(TAG, "Erro ao recarregar lista de máquinas", e);
                }
            }).start();
            // Não retornar; ainda aplicar status disponível nas máquinas existentes abaixo.
        }

        java.util.HashSet<String> seen = new java.util.HashSet<>();
        for (MachineStatusMonitor.MachineStatus status : statuses) {
            seen.add(status.machineId);
            for (SupabaseHelper.Machine machine : machines) {
                if (machine.getId().equals(status.machineId)) {
                    machine.setEsp32Online(status.esp32Online);

                    // Sincronizar dados mutáveis (nome, tipo, preço, ciclo) do servidor
                    if (status.machineName != null && !status.machineName.isEmpty()) {
                        machine.setName(status.machineName);
                    }
                    if (status.machineType != null && !status.machineType.isEmpty()) {
                        String mappedType = "washing".equals(status.machineType) || "lavadora".equals(status.machineType) ? "LAVAR"
                                : "drying".equals(status.machineType) || "secadora".equals(status.machineType) ? "SECAR" : "LAVAR";
                        machine.setType(mappedType);
                    }
                    if (status.pricePerCycle > 0) {
                        machine.setPrice(status.pricePerCycle);
                    }
                    if (status.cycleTimeMinutes > 0) {
                        machine.setDuration(status.cycleTimeMinutes);
                    }
                    
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
        // Resposta incompleta ou máquina sumiu do RPC: não manter ESP "online" por cache velho
        for (SupabaseHelper.Machine machine : machines) {
            if (!seen.contains(machine.getId())) {
                machine.setEsp32Online(false);
                machine.setStatus("OFFLINE");
            }
        }
        
        displayMachines();
    }
    
    private void createTotemInterface() {
        rootLayout = new LinearLayout(this);
        rootLayout.setOrientation(LinearLayout.VERTICAL);
        rootLayout.setBackgroundColor(Color.parseColor("#0D1117"));
        rootLayout.setLayoutParams(new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.MATCH_PARENT
        ));

        // Cabeçalho fixo compacto no topo (gesto admin: 7 toques)
        LinearLayout headerBar = new LinearLayout(this);
        headerBar.setOrientation(LinearLayout.HORIZONTAL);
        headerBar.setGravity(android.view.Gravity.CENTER_VERTICAL);
        headerBar.setBackgroundColor(Color.parseColor("#161B22"));
        headerBar.setPadding(dp(12), dp(6), dp(12), dp(6));

        String logoUrl = supabaseHelper.getLaundryLogo();
        if (logoUrl != null && !logoUrl.isEmpty()) {
            ImageView logoImage = new ImageView(this);
            LinearLayout.LayoutParams logoParams = new LinearLayout.LayoutParams(dp(36), dp(36));
            logoParams.setMargins(0, 0, dp(8), 0);
            logoImage.setLayoutParams(logoParams);
            logoImage.setAdjustViewBounds(true);
            logoImage.setScaleType(ImageView.ScaleType.FIT_CENTER);
            headerBar.addView(logoImage);
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

        titleText = new TextView(this);
        String laundryName = supabaseHelper.getLaundryName();
        titleText.setText("🧺 " + laundryName.toUpperCase(Locale.getDefault()));
        titleText.setTextSize(15);
        titleText.setTextColor(Color.WHITE);
        titleText.setSingleLine(true);
        titleText.setEllipsize(android.text.TextUtils.TruncateAt.END);
        titleText.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        titleText.setClickable(true);
        titleText.setFocusable(true);
        titleText.setOnClickListener(v -> handleAdminSecretTap());
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f
        );
        titleText.setLayoutParams(titleParams);
        headerBar.addView(titleText);
        rootLayout.addView(headerBar);

        statusText = new TextView(this);
        statusText.setVisibility(android.view.View.GONE);
        rootLayout.addView(statusText);

        machinesScrollView = new ScrollView(this);
        LinearLayout.LayoutParams scrollParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f
        );
        machinesScrollView.setLayoutParams(scrollParams);
        machinesScrollView.setFillViewport(true);

        machinesContainer = new LinearLayout(this);
        machinesContainer.setOrientation(LinearLayout.VERTICAL);
        machinesContainer.setPadding(dp(12), dp(8), dp(12), dp(12));
        machinesScrollView.addView(machinesContainer);
        rootLayout.addView(machinesScrollView);

        setContentView(rootLayout);
    }
    
    
    private void loadMachines() {
        Log.d(TAG, "Carregando máquinas do Supabase...");
        if (supabaseHelper == null) {
            Log.e(TAG, "SupabaseHelper indisponível no loadMachines");
            showFatalErrorScreen("Configuração do sistema indisponível");
            return;
        }
        if (!supabaseHelper.isConfigured()) {
            Log.d(TAG, "Totem não configurado; cancelando carregamento de máquinas");
            return;
        }
        if (machinesContainer == null) {
            createTotemInterface();
        }
        
        machines = supabaseHelper.getAllMachines();
        displayMachines();
        
        Log.d(TAG, "Interface inicial carregada, aguardando dados reais do Supabase...");
    }
    
    private void displayMachines() {
        if (machinesContainer == null) {
            Log.w(TAG, "machinesContainer nulo, recriando interface");
            createTotemInterface();
        }
        if (machines == null) {
            Log.w(TAG, "Lista de máquinas nula; exibindo lista vazia");
            machines = new ArrayList<>();
        }
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
        
        // Grid responsivo para evitar cortes em telas menores.
        GridLayout machineGrid = new GridLayout(this);
        int screenWidthDp = getResources().getConfiguration().screenWidthDp;
        machineGrid.setColumnCount(screenWidthDp >= 720 ? 3 : 2);
        machineGrid.setUseDefaultMargins(false);
        machineGrid.setPadding(0, 0, 0, dp(24));

        for (SupabaseHelper.Machine machine : machines) {
            Button machineButton = createMachineButton(machine);
            machineGrid.addView(machineButton);
        }
        
        machinesContainer.addView(machineGrid);
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
        
        button.setTextSize(13);
        button.setPadding(dp(10), dp(12), dp(10), dp(12));
        button.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        
        GridLayout.LayoutParams params = new GridLayout.LayoutParams();
        params.width = 0;
        params.height = GridLayout.LayoutParams.WRAP_CONTENT;
        params.columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f);
        params.setMargins(dp(6), dp(6), dp(6), dp(6));
        button.setMinHeight(dp(88));
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
        ScrollView scrollView = new ScrollView(this);
        scrollView.setFillViewport(true);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(dp(20), dp(20), dp(20), dp(20));
        layout.setBackgroundColor(Color.parseColor("#2196F3"));
        
        // Título
        TextView title = new TextView(this);
        title.setText("Confirmar pagamento");
        title.setTextSize(24);
        title.setTextColor(Color.WHITE);
        title.setGravity(android.view.Gravity.CENTER);
        title.setPadding(0, 0, 0, 20);
        layout.addView(title);
        
        // Detalhes da máquina (sem dados técnicos de ESP32)
        TextView details = new TextView(this);
        details.setText(machine.getName() + "\n" +
                       machine.getTypeDisplay() + "\n\n" +
                       "Valor: R$ " + new DecimalFormat("0.00").format(machine.getPrice()) + "\n" +
                       "Tempo do ciclo: " + machine.getDuration() + " min\n\n" +
                       getPaymentInstructionTitle() + "\n" +
                       getPaymentInstructionSubtitle());
        details.setTextSize(16);
        details.setTextColor(Color.WHITE);
        details.setGravity(android.view.Gravity.CENTER);
        details.setPadding(20, 20, 20, 30);
        details.setBackgroundColor(Color.parseColor("#1976D2"));
        layout.addView(details);
        
        // Botões de forma de pagamento (Cielo LIO)
        TextView payLabel = new TextView(this);
        payLabel.setText("Forma de pagamento:");
        payLabel.setTextSize(15);
        payLabel.setTextColor(Color.WHITE);
        payLabel.setGravity(android.view.Gravity.CENTER);
        payLabel.setPadding(0, dp(8), 0, dp(8));
        layout.addView(payLabel);

        LinearLayout payRow = new LinearLayout(this);
        payRow.setOrientation(LinearLayout.VERTICAL);

        Button creditBtn = buildPaymentTypeButton("💳 CRÉDITO", Color.parseColor("#1976D2"),
            () -> processPayment(machine, "credit"));
        Button debitBtn = buildPaymentTypeButton("💳 DÉBITO", Color.parseColor("#1565C0"),
            () -> processPayment(machine, "debit"));
        Button pixBtn = buildPaymentTypeButton("📱 PIX", Color.parseColor("#00897B"),
            () -> processPayment(machine, "pix"));

        payRow.addView(creditBtn);
        payRow.addView(debitBtn);
        if ("cielo".equalsIgnoreCase(activeProvider)) {
            payRow.addView(pixBtn);
        }
        layout.addView(payRow);

        // Botão cancelar
        Button cancelButton = new Button(this);
        cancelButton.setText("❌ CANCELAR");
        cancelButton.setTextSize(16);
        cancelButton.setPadding(dp(16), dp(14), dp(16), dp(14));
        cancelButton.setBackgroundColor(Color.parseColor("#F44336"));
        cancelButton.setTextColor(Color.WHITE);
        LinearLayout.LayoutParams cancelParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        cancelButton.setLayoutParams(cancelParams);
        cancelButton.setOnClickListener(v -> {
            selectedMachine = null;
            currentPendingTransactionId = null;
            createTotemInterface();
            loadMachines();
        });
        layout.addView(cancelButton);

        scrollView.addView(layout);
        setContentView(scrollView);
    }

    private Button buildPaymentTypeButton(String label, int bgColor, Runnable onClick) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextSize(16);
        button.setPadding(dp(16), dp(14), dp(16), dp(14));
        button.setBackgroundColor(bgColor);
        button.setTextColor(Color.WHITE);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        params.setMargins(0, 0, 0, dp(10));
        button.setLayoutParams(params);
        button.setOnClickListener(v -> onClick.run());
        return button;
    }
    
    /**
     * Abre o fluxo de pagamento (Cielo: crédito à vista no deep link; cartão/PIX/débito podem ser escolhidos na tela nativa).
     */
    private void processPayment(SupabaseHelper.Machine machine) {
        processPayment(machine, "credit");
    }

    /**
     * @param paymentTypeForManager tipo enviado ao {@link PaymentManager} (ex.: credit, pix para Cielo LIO).
     */
    private void processPayment(SupabaseHelper.Machine machine, String paymentTypeForManager) {
        new Thread(() -> {
            try {
                if ("cielo".equalsIgnoreCase(activeProvider)) {
                    cieloManager.takeLastDetectedSupabasePaymentMethod();
                }
                final String supabaseMethod = toSupabasePaymentMethod(paymentTypeForManager);
                currentOperationSupabasePaymentMethod = supabaseMethod;

                Log.d(TAG, "=== INICIANDO PROCESSAMENTO DE PAGAMENTO ===");
                Log.d(TAG, "=== VALIDAÇÃO PRÉ-PAGAMENTO ===");
                Log.d(TAG, "Máquina ID: " + machine.getId());
                Log.d(TAG, "Máquina: " + machine.getName());
                Log.d(TAG, "ESP32 ID: " + machine.getEsp32Id());
                Log.d(TAG, "Status Atual: " + machine.getStatus());
                Log.d(TAG, "ESP32 Online (cache): " + machine.isEsp32Online());
                Log.d(TAG, "Valor: R$ " + machine.getPrice());

                // ✅ NOVA VALIDAÇÃO: Verificar disponibilidade em tempo real
                Log.d(TAG, "🔍 Validando disponibilidade da máquina em tempo real...");

                boolean isStillAvailable = validateMachineAvailability(machine);

                Log.d(TAG, "=== RESULTADO DA VALIDAÇÃO ===");
                Log.d(TAG, "Disponível: " + isStillAvailable);

                if (!isStillAvailable) {
                    Log.w(TAG, "⚠️ PAGAMENTO BLOQUEADO - Máquina não disponível");
                    runOnUiThread(() -> {
                        handlePaymentError("Máquina não está mais disponível. Por favor, selecione outra.");
                        new Handler(Looper.getMainLooper()).postDelayed(() -> {
                            createTotemInterface();
                            loadMachines();
                        }, 3000);
                    });
                    return;
                }

                Log.d(TAG, "✅ Máquina disponível - prosseguindo com pagamento");

                // Criar operação no Supabase (fora da UI thread)
                currentOperationId = System.currentTimeMillis();
                String pendingTxId = supabaseHelper.createTransaction(
                    machine.getId(),
                    machine.getTypeDisplay(),
                    machine.getPrice(),
                    "PENDING",
                    "TXN" + currentOperationId,
                    supabaseMethod
                );
                currentPendingTransactionId = pendingTxId;
                if (pendingTxId == null) {
                    Log.w(TAG, "Falha ao criar operação no Supabase; prosseguindo com fluxo local de pagamento");
                }

                if ("cielo".equalsIgnoreCase(activeProvider)) {
                    String cId = supabaseHelper.getCieloClientId();
                    String cToken = supabaseHelper.getCieloAccessToken();
                    String cMerchant = supabaseHelper.getCieloMerchantCode();
                    String cEnv = supabaseHelper.getCieloEnvironment();
                    cieloManager.configure(cId, cToken, cMerchant, cEnv);
                }

                Log.d(TAG, "Operação criada: ID " + currentOperationId);

                final String managerPaymentType = paymentTypeForManager == null || paymentTypeForManager.isEmpty()
                    ? "credit" : paymentTypeForManager;
                runOnUiThread(() -> {
                    showPaymentProcessing(machine);
                    activePaymentManager.processPayment(
                        machine.getPrice(),
                        managerPaymentType,
                        "Top Lavanderia - " + machine.getName(),
                        "TOTEM" + currentOperationId
                    );
                });
            } catch (Exception e) {
                Log.e(TAG, "Erro ao processar pagamento", e);
                runOnUiThread(() -> handlePaymentError("Erro ao processar pagamento: " + e.getMessage()));
            }
        }).start();
    }

    private static String toSupabasePaymentMethod(String paymentTypeForManager) {
        if (paymentTypeForManager == null) {
            return "credit";
        }
        String t = paymentTypeForManager.trim();
        if ("pix".equalsIgnoreCase(t)) {
            return "pix";
        }
        if ("debit".equalsIgnoreCase(t) || "debito".equalsIgnoreCase(t)) {
            return "debit";
        }
        return "credit";
    }

    /**
     * Valida se a máquina ainda está disponível em tempo real
     * Faz consulta direta ao Supabase para garantir dados atualizados
     */
    private boolean validateMachineAvailability(SupabaseHelper.Machine machine) {
        final boolean[] result = {false};
        final Object lock = new Object();
        
        new Thread(() -> {
            try {
                String url = SupabaseConfig.SUPABASE_URL + "/rest/v1/rpc/get_public_machines";
                
                HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
                connection.setRequestMethod("POST");
                SupabaseConfig.applyJsonHeaders(connection);
                connection.setDoOutput(true);
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(5000);

                JSONObject body = new JSONObject();
                body.put("_laundry_id", supabaseHelper.getLaundryId());
                OutputStream os = connection.getOutputStream();
                os.write(body.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
                os.close();
                
                int responseCode = connection.getResponseCode();
                
                if (responseCode == 200) {
                    BufferedReader br = new BufferedReader(new InputStreamReader(connection.getInputStream()));
                    StringBuilder response = new StringBuilder();
                    String line;
                    while ((line = br.readLine()) != null) {
                        response.append(line);
                    }
                    br.close();
                    
                    JSONArray jsonArray = new JSONArray(response.toString());
                    
                    for (int i = 0; i < jsonArray.length(); i++) {
                        JSONObject machineData = jsonArray.getJSONObject(i);
                        if (!machine.getId().equals(machineData.optString("id"))) {
                            continue;
                        }
                        String currentStatus = machineData.getString("status");
                        String esp32Id = machineData.getString("esp32_id");
                        
                        // Verificar se ESP32 está online
                        boolean esp32Online = checkEsp32Status(esp32Id);
                        
                        // Máquina disponível = status "available" + ESP32 online
                        result[0] = "available".equals(currentStatus) && esp32Online;
                        
                        Log.d(TAG, "Status atual: " + currentStatus + ", ESP32 Online: " + esp32Online);
                        break;
                    }
                }
                
                connection.disconnect();
                
            } catch (Exception e) {
                Log.e(TAG, "Erro ao validar disponibilidade", e);
                result[0] = false;
            }
            
            synchronized (lock) {
                lock.notify();
            }
        }).start();
        
        // Aguardar resultado (máximo 5 segundos)
        synchronized (lock) {
            try {
                lock.wait(5000);
            } catch (InterruptedException e) {
                Log.e(TAG, "Timeout na validação", e);
            }
        }
        
        return result[0];
    }
    
    /**
     * Verifica se o ESP32 específico está online
     */
    private boolean checkEsp32Status(String esp32Id) {
        try {
            String url = SupabaseConfig.SUPABASE_URL + "/rest/v1/rpc/get_esp32_heartbeats";
            
            HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setRequestMethod("POST");
            SupabaseConfig.applyJsonHeaders(connection);
            connection.setDoOutput(true);
            connection.setConnectTimeout(3000);
            connection.setReadTimeout(3000);

            JSONObject body = new JSONObject();
            body.put("_laundry_id", supabaseHelper.getLaundryId());
            OutputStream os = connection.getOutputStream();
            os.write(body.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            os.close();
            
            int responseCode = connection.getResponseCode();
            
            if (responseCode == 200) {
                BufferedReader br = new BufferedReader(new InputStreamReader(connection.getInputStream()));
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) {
                    response.append(line);
                }
                br.close();
                
                JSONArray jsonArray = new JSONArray(response.toString());
                
                for (int i = 0; i < jsonArray.length(); i++) {
                    JSONObject esp32Data = jsonArray.getJSONObject(i);
                    if (!esp32Id.equals(esp32Data.optString("esp32_id"))) {
                        continue;
                    }
                    return Esp32TotemPolicy.isEsp32Reachable(esp32Data);
                }
            }
            
            connection.disconnect();
            return false;
            
        } catch (Exception e) {
            Log.e(TAG, "Erro ao verificar ESP32", e);
            return false;
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
                             "🔄 " + getPaymentProcessingText() + "\n" +
                             "Aguarde o processamento do pagamento");
        processingText.setTextSize(16);
        processingText.setGravity(android.view.Gravity.CENTER);
        processingText.setPadding(20, 20, 20, 20);
        processingText.setTextColor(Color.WHITE);
        layout.addView(processingText);
        
        setContentView(layout);
    }
    
    private void handlePaymentSuccess(String authorizationCode, String transactionId) {
        SupabaseHelper.Machine refreshedMachine = null;
        if (selectedMachine != null) {
            refreshedMachine = supabaseHelper.refreshMachineById(selectedMachine.getId());
        }
        final SupabaseHelper.Machine machineSnapshot = refreshedMachine != null ? refreshedMachine : selectedMachine;
        if (machineSnapshot == null) {
            handlePaymentError("Pagamento aprovado, mas a máquina selecionada não está disponível.");
            return;
        }

        if ("cielo".equalsIgnoreCase(activeProvider)) {
            String detected = cieloManager.takeLastDetectedSupabasePaymentMethod();
            if (detected != null && !detected.isEmpty()) {
                currentOperationSupabasePaymentMethod = detected;
                Log.d(TAG, "Forma de pagamento confirmada pela Cielo (Supabase): " + detected);
            }
        }

        new Thread(() -> {
            try {
                Log.d(TAG, "=== PAGAMENTO APROVADO ===");
                Log.d(TAG, "Código: " + authorizationCode);
                Log.d(TAG, "Transação: " + transactionId);

                // ESP32 o mais cedo possível após o callback (o atraso longo costuma ser tela da Cielo antes do deep link).
                Log.d(TAG, "=== ACIONANDO ESP32 ===");
                Log.d(TAG, "Endpoint: /functions/v1/esp32-control");
                Log.d(TAG, "Payload: {esp32_id: " + machineSnapshot.getEsp32Id() + ", relay_pin: " + machineSnapshot.getRelayPin() + "}");
                Log.d(TAG, "Acionando ESP32 para máquina: " + machineSnapshot.getName());

                String methodForComplete = currentOperationSupabasePaymentMethod != null
                    ? currentOperationSupabasePaymentMethod
                    : "credit";

                boolean txCompleted = false;
                if (currentPendingTransactionId != null && !currentPendingTransactionId.isEmpty()) {
                    txCompleted = supabaseHelper.completeTotemTransactionById(
                        currentPendingTransactionId,
                        methodForComplete
                    );
                }
                if (!txCompleted) {
                    txCompleted = supabaseHelper.completeLatestTotemTransaction(
                        machineSnapshot.getId(),
                        methodForComplete
                    );
                }
                if (!txCompleted) {
                    Log.w(TAG, "Não foi possível marcar a transação do totem como concluída");
                }

                String esp32TxId = currentPendingTransactionId != null ? currentPendingTransactionId : transactionId;
                boolean esp32Activated = supabaseHelper.activateEsp32Relay(
                    machineSnapshot.getEsp32Id(),
                    machineSnapshot.getRelayPin(),
                    machineSnapshot.getId(),
                    esp32TxId,
                    machineSnapshot.getDuration()
                );

                if (esp32Activated) {
                    Log.d(TAG, "✅ ESP32 acionado com sucesso - máquina liberada");
                    supabaseHelper.startMachineUsage(machineSnapshot.getId(), machineSnapshot.getDuration());
                    runOnUiThread(() -> {
                        triggerAutomaticReceiptPrint(machineSnapshot, authorizationCode, transactionId);
                        showBriefPaymentSuccessAndReset(machineSnapshot);
                    });
                } else {
                    Log.e(TAG, "❌ Falha ao acionar ESP32");
                    runOnUiThread(() -> handlePaymentError("Pagamento aprovado mas a máquina não pôde ser acionada. Entre em contato com a administração."));
                }
            } catch (Exception e) {
                Log.e(TAG, "Erro ao processar sucesso do pagamento", e);
                runOnUiThread(() -> handlePaymentError("Erro ao finalizar pagamento: " + e.getMessage()));
            }
        }).start();
    }
    
    private void triggerAutomaticReceiptPrint(SupabaseHelper.Machine machine, String authorizationCode, String transactionId) {
        // Comprovante: Cielo/PayGo no terminal; totem não exibe tela de impressão.
        Log.d(TAG, "Pagamento concluído - máquina=" + machine.getName()
            + ", método=" + currentOperationSupabasePaymentMethod
            + ", auth=" + authorizationCode + ", txn=" + transactionId);
    }

    /** Feedback curto ao cliente e retorno automático à tela inicial (sem perguntar sobre comprovante). */
    private void showBriefPaymentSuccessAndReset(SupabaseHelper.Machine machine) {
        ScrollView scrollView = new ScrollView(this);
        scrollView.setFillViewport(true);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(dp(24), dp(32), dp(24), dp(32));
        layout.setBackgroundColor(Color.parseColor("#2E7D32"));
        layout.setGravity(android.view.Gravity.CENTER);

        TextView successText = new TextView(this);
        String machineLabel = machine != null ? machine.getName() : "Máquina";
        successText.setText("Pagamento aprovado\n\n" + machineLabel + " liberada.\nPode iniciar o ciclo.");
        successText.setTextSize(20);
        successText.setTextColor(Color.WHITE);
        successText.setGravity(android.view.Gravity.CENTER);
        successText.setLineSpacing(dp(4), 1f);
        layout.addView(successText);

        scrollView.addView(layout);
        setContentView(scrollView);

        new Handler(Looper.getMainLooper()).postDelayed(this::resetToNewTransaction, POST_PAYMENT_SUCCESS_MS);
    }

    private void resetToNewTransaction() {
        selectedMachine = null;
        currentOperationId = -1;
        currentPendingTransactionId = null;
        currentOperationSupabasePaymentMethod = "credit";
        createTotemInterface();
        loadMachines();
    }
    
    private void handlePaymentError(String error) {
        Log.e(TAG, "=== ERRO NO PAGAMENTO ===");
        Log.e(TAG, "Erro: " + error);

        final String pendingId = currentPendingTransactionId;
        currentPendingTransactionId = null;
        if (pendingId != null && !pendingId.isEmpty()) {
            new Thread(() -> {
                boolean cancelled = supabaseHelper.cancelTotemTransactionById(pendingId);
                Log.d(TAG, "Pending cancelada após erro de pagamento (" + pendingId + "): " + cancelled);
            }).start();
        }

        String displayError = error;
        if ("cielo".equalsIgnoreCase(activeProvider) && error != null) {
            displayError = error + appendCieloCommercialHints(error);
        }

        // Mostrar tela de erro
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 50, 50, 50);
        layout.setBackgroundColor(Color.parseColor("#F44336"));
        
        TextView errorText = new TextView(this);
        errorText.setText("❌ ERRO NO PAGAMENTO\n\n" + displayError + "\n\n" +
                         "Tente novamente ou verifique a conexão de pagamento.");
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

    /**
     * Códigos como -990 (opt-in PIX / elegibilidade do POS) e -4007 (produto não permitido) vêm do
     * estabelecimento/terminal Cielo, não do aplicativo. Orientação para o operador.
     */
    private String appendCieloCommercialHints(String error) {
        if (error == null) {
            return "";
        }
        String e = error.toLowerCase(java.util.Locale.ROOT);
        StringBuilder sb = new StringBuilder();

        if (e.contains("-990")
                || e.contains("optin") || e.contains("opt-in")
                || e.contains("não elegível") || e.contains("nao elegivel")
                || e.contains("não elegivel")) {
            sb.append("\n\n— PIX (-990 / elegibilidade) —\n");
            sb.append("O terminal ou o cadastro do estabelecimento não está elegível ao opt-in Pix na Cielo. ");
            sb.append("Conclua a habilitação em Minha Conta Cielo (Meu cadastro → Autorizações → Pix) e aguarde a liberação. ");
            sb.append("Em caso de multi-EC, confira se o código do estabelecimento (merchant) no totem é o mesmo do terminal. ");
            sb.append("Se o modelo/conta não suportar Pix neste POS, use apenas crédito ou fale com o suporte Cielo (4002-5472).");
        }

        if (e.contains("-4007") || e.contains("4007")
                || e.contains("operação não permitida") || e.contains("operacao nao permitida")) {
            sb.append("\n\n— Débito / produto (-4007) —\n");
            sb.append("A Cielo recusou o produto solicitado (ex.: débito à vista). ");
            sb.append("Verifique no contrato/cadastro se débito está habilitado para este estabelecimento e terminal. ");
            sb.append("Confira também o merchantCode nas configurações do totem. ");
            sb.append("Enquanto o débito não estiver liberado, use \"Crédito à vista\" no totem ou contate o suporte Cielo.");
        }

        if ((e.contains("pix") || (currentOperationSupabasePaymentMethod != null && "pix".equals(currentOperationSupabasePaymentMethod)))
                && (e.contains("inválid") || e.contains("invalid") || e.contains("parâmetro") || e.contains("parametro") || e.contains("json"))) {
            sb.append("\n\n— PIX (parâmetros) —\n");
            sb.append("Confira Pix habilitado no cadastro Cielo e o merchantCode nas configurações do totem.");
        }

        return sb.toString();
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
            String raw = cnpjInput.getText().toString().trim();
            String cnpj = raw.replaceAll("\\D", "");

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

    private void showFatalErrorScreen(String message) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setBackgroundColor(Color.parseColor("#0D1117"));
        layout.setPadding(40, 40, 40, 40);
        layout.setGravity(android.view.Gravity.CENTER);

        TextView title = new TextView(this);
        title.setText("Erro ao iniciar o totem");
        title.setTextSize(22);
        title.setTextColor(Color.WHITE);
        title.setGravity(android.view.Gravity.CENTER);
        title.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        title.setPadding(0, 0, 0, 24);
        layout.addView(title);

        TextView details = new TextView(this);
        details.setText(message + "\n\nVerifique rede/configurações e reinicie o app.");
        details.setTextSize(15);
        details.setTextColor(Color.parseColor("#C9D1D9"));
        details.setGravity(android.view.Gravity.CENTER);
        layout.addView(details);

        setContentView(layout);
    }

    /**
     * Inicializa apenas o provedor necessário. Terminais Cielo Smart não carregam PayGo no boot.
     */
    private void initializePaymentManagers() {
        activeProvider = supabaseHelper.getPaymentProvider();
        if (!"cielo".equalsIgnoreCase(activeProvider) && isCieloSmartTerminal()) {
            Log.d(TAG, "Terminal Cielo detectado: priorizando provedor Cielo LIO");
            activeProvider = "cielo";
        }

        cieloManager = new CieloLioManager(this);

        if ("cielo".equalsIgnoreCase(activeProvider)) {
            String cId = supabaseHelper.getCieloClientId();
            String cToken = supabaseHelper.getCieloAccessToken();
            String cMerchant = supabaseHelper.getCieloMerchantCode();
            String cEnv = supabaseHelper.getCieloEnvironment();
            if (cId != null && !cId.isEmpty()) {
                cieloManager.configure(cId, cToken, cMerchant, cEnv);
            }
            activePaymentManager = cieloManager;
            payGoManager = null;
            Log.d(TAG, "Provedor de pagamento: Cielo LIO (PayGo não carregado)");
        } else {
            payGoManager = new RealPayGoManager(this);
            activePaymentManager = payGoManager;
            Log.d(TAG, "Provedor de pagamento: PayGo");
        }
    }

    private boolean isCieloSmartTerminal() {
        String model = Build.MODEL == null ? "" : Build.MODEL.toUpperCase(Locale.US);
        String manufacturer = Build.MANUFACTURER == null ? "" : Build.MANUFACTURER.toUpperCase(Locale.US);
        return model.contains("DX8000")
                || model.contains("L300")
                || model.contains("L400")
                || manufacturer.contains("CIELO");
    }

    private String getPaymentInstructionTitle() {
        return "cielo".equalsIgnoreCase(activeProvider)
                ? "PAGAMENTO SERÁ PROCESSADO NA CIELO"
                : "PAGAMENTO SERÁ PROCESSADO NA PPC930";
    }

    private String getPaymentInstructionSubtitle() {
        return "cielo".equalsIgnoreCase(activeProvider)
                ? "Siga as instruções na maquininha Cielo"
                : "Insira seu cartão quando solicitado";
    }

    private String getPaymentProcessingText() {
        return "cielo".equalsIgnoreCase(activeProvider)
                ? "COMUNICAÇÃO COM CIELO DX8000..."
                : "COMUNICAÇÃO COM PPC930...";
    }
    
    private void updateConnectivityStatus() {
        if (statusText != null) {
            if (supabaseHelper.isOnline()) {
                int machineCount = machines == null ? 0 : machines.size();
                statusText.setText("✅ " + machineCount + " máquinas carregadas");
                statusText.setTextColor(Color.parseColor("#4CAF50"));
            } else {
                statusText.setText("🔄 Carregando máquinas...");
                statusText.setTextColor(Color.parseColor("#FF9800"));
            }
        }
    }

    private int dp(int value) {
        float density = getResources().getDisplayMetrics().density;
        return Math.round(value * density);
    }
}
