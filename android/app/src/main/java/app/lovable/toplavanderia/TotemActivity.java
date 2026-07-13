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
import android.view.MotionEvent;
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
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
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
    /** Extra ao retornar do app Cielo — evita flash da tela de escolha de pagamento. */
    public static final String EXTRA_CIELO_PAYMENT_RETURN = "cielo_payment_return";
    /** Tela de sucesso após pagamento antes de voltar à seleção de máquinas. */
    private static final long POST_PAYMENT_SUCCESS_MS = 1000L;
    /** Sem interação → volta à HOME (todas as telas do totem, inclusive Cielo em segundo plano). */
    private static final long SCREEN_IDLE_TIMEOUT_MS = 60_000L;
    /** Aguarda confirmação do relé ESP32 após pagamento Cielo (poll ~10s + margem). */
    private static final long ESP32_CONFIRM_TIMEOUT_MS = 45_000L;
    private static final long IDLE_WATCHDOG_TICK_MS = 1_000L;
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
    /** Máquina do pagamento em curso — sobrevive ao retorno da Cielo (selectedMachine pode ser limpo cedo). */
    private SupabaseHelper.Machine paymentContextMachine;
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
    private final Handler idleHandler = new Handler(Looper.getMainLooper());
    private Runnable idleWatchdogRunnable;
    private long lastUserInteractionMs = System.currentTimeMillis();
    private Runnable adminTapResetRunnable;
    private Runnable pendingSuccessResetRunnable;
    /** Evita dois pedidos Cielo com a mesma referência (toque duplo / threads paralelas). */
    private final AtomicBoolean paymentLaunchInProgress = new AtomicBoolean(false);
    /** Tela azul "Abrindo pagamento" — ao retomar após Cielo, ir direto à HOME. */
    private volatile boolean cieloLaunchUiActive;
    /** Mantém a UI estável enquanto o app Cielo processa (evita flash da grade ao voltar). */
    private volatile boolean awaitingPaymentCallback;
    /** Bloqueia idle timeout durante verificação ESP32 / estorno Cielo pós-pagamento. */
    private volatile boolean postPaymentHardwarePending;
    /** Ignora erros tardios da Cielo após sucesso já exibido. */
    private volatile long lastSucceededOperationId = -1;
    /** Máquina paga recentemente — exibir OCUPADA na grade antes do poll do Supabase. */
    private String optimisticOccupiedMachineId;
    private long optimisticOccupiedAtMs;
    private static final long OPTIMISTIC_OCCUPIED_MAX_MS = 8 * 60 * 1000L;

    private enum TotemScreen { HOME, LAVAR, SECAR, MASSAGEM, CAFE }

    private TotemScreen currentScreen = TotemScreen.HOME;
    private List<SupabaseHelper.CoffeeProduct> coffeeProducts = new ArrayList<>();
    private boolean coffeeProductsLoadAttempted = false;
    private static final long COFFEE_MENU_REFRESH_MIN_INTERVAL_MS = 15_000L;
    private final AtomicBoolean coffeeRefreshInFlight = new AtomicBoolean(false);
    private long lastCoffeeProductsRefreshAtMs = 0L;
    private SupabaseHelper.CoffeeProduct selectedCoffeeProduct;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        CieloSslWorkaround.ensureInitialized();
        applyKeepScreenAwake();
        DeviceClockGuard.checkAsync(this);
        // Imersivo só após setContentView (L400/Cielo: DecorView null em onCreate quebra getInsetsController).
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
                        if (shouldBlockTotemUiRefresh()) {
                            Log.d(TAG, "UI bloqueada durante pagamento Cielo — grade não redesenhada");
                            return;
                        }
                        applyOptimisticMachineStatuses();
                        refreshCoffeeProductsAsync();
                        displayCurrentScreen();
                    });
                }
            });
            
            // Pagamento: Cielo LIO não carrega PayGo no boot (evita crash na Cielo Store sem PayGo instalado).
            supabaseHelper.prefetchSystemSettings();
            initializePaymentManagers();

            // Unified payment callback
            PaymentCallback paymentCallback = new PaymentCallback() {
                @Override
                public void onPaymentSuccess(String authorizationCode, String transactionId) {
                    final long operationId = resolvePaymentOperationId();
                    new Thread(() -> handlePaymentSuccess(authorizationCode, transactionId, operationId)).start();
                }
                @Override
                public void onPaymentError(String error) {
                    final long operationId = currentOperationId;
                    runOnUiThread(() -> handlePaymentError(error, operationId));
                }
                @Override
                public void onPaymentProcessing(String message) {
                    // Sem tela amarela: Cielo abre em tela cheia; status no rodapé só na grade principal.
                    if (!"cielo".equalsIgnoreCase(activeProvider)) {
                        runOnUiThread(() -> updateStatus(message));
                    }
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
            ensureIdleWatchdogRunning();
            
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
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (intent != null && intent.getBooleanExtra(EXTRA_CIELO_PAYMENT_RETURN, false)) {
            if (paymentContextMachine == null && selectedMachine != null) {
                paymentContextMachine = selectedMachine;
            }
            intent.removeExtra(EXTRA_CIELO_PAYMENT_RETURN);
            if (!postPaymentHardwarePending) {
                restoreHomeScreen();
            }
        }
    }

    /** Evita limpar selectedMachine entre pagamentos consecutivos no fluxo Cielo. */
    private boolean isCieloPaymentInProgress() {
        return awaitingPaymentCallback || paymentLaunchInProgress.get() || currentOperationId > 0;
    }

    @Override
    protected void onResume() {
        super.onResume();
        applyKeepScreenAwake();
        applyImmersiveMode();
        try {
            // Tarja TYPE_ACCESSIBILITY_OVERLAY bloqueia toques na home se ficar presa.
            // Fora de pagamento Cielo ativo: limpa sessão + overlay imediatamente.
            if ("cielo".equalsIgnoreCase(activeProvider) && !isCieloPaymentInProgress()) {
                try {
                    CieloPaymentSessionHelper.forceClearStuckUi(this);
                } catch (Throwable t) {
                    Log.w(TAG, "Falha ao limpar tarja presa no onResume", t);
                }
            }
            if ("cielo".equalsIgnoreCase(activeProvider)) {
                Intent resumeIntent = getIntent();
                if (resumeIntent != null && resumeIntent.getBooleanExtra(EXTRA_CIELO_PAYMENT_RETURN, false)) {
                    resumeIntent.removeExtra(EXTRA_CIELO_PAYMENT_RETURN);
                    if (!postPaymentHardwarePending) {
                        restoreHomeScreen();
                    }
                }
            }
            if (statusMonitor != null) {
                statusMonitor.startMonitoring();
                statusMonitor.requestImmediatePoll();
                Log.d(TAG, "Monitor de status iniciado + poll imediato");
            }
            if (supabaseHelper != null && supabaseHelper.isConfigured()) {
                if ("cielo".equalsIgnoreCase(activeProvider)
                        && lastSucceededOperationId > 0
                        && !isMachineGridVisible()
                        && !isCieloPaymentInProgress()) {
                    restoreHomeScreen();
                }
                loadMachines();
            } else {
                Log.d(TAG, "onResume sem configuração do totem; mantendo tela de configuração");
            }
            scheduleIdleTimeout();
        } catch (Throwable t) {
            Log.e(TAG, "Falha no onResume", t);
            showFatalErrorScreen("Falha ao retomar aplicativo");
        }
    }

    @Override
    public boolean dispatchTouchEvent(MotionEvent ev) {
        if (ev != null && ev.getAction() == MotionEvent.ACTION_DOWN) {
            bumpUserInteraction();
        }
        return super.dispatchTouchEvent(ev);
    }
    
    @Override
    public void onUserInteraction() {
        super.onUserInteraction();
        bumpUserInteraction();
    }
    @Override
    protected void onPause() {
        super.onPause();
        // Não parar o monitor: no fluxo Cielo o app de pagamento cobre a tela (onPause) e o polling
        // parava por minutos — o status offline só atualizava ao voltar. Kiosk: manter consultas.
        Log.d(TAG, "onPause: monitor de ESP segue ativo em segundo plano");
        ensureIdleWatchdogRunning();
    }

    @Override
    protected void onDestroy() {
        cancelIdleTimeout();
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

    /** Oculta botões de navegação do terminal; reaplica se o usuário deslizar na borda. */
    private void applyImmersiveMode() {
        ImmersiveModeHelper.enable(this);
    }

    private void setTotemContentView(View view) {
        setContentView(view);
        applyImmersiveMode();
        ensureIdleWatchdogRunning();
    }

    /** Evita flash da grade/HOME sobre a tela azul ou durante callback Cielo. */
    private boolean shouldBlockTotemUiRefresh() {
        return cieloLaunchUiActive
            || paymentLaunchInProgress.get()
            || awaitingPaymentCallback;
    }

    /** Garante que a grade de máquinas está na tela (não a confirmação de pagamento). */
    private boolean isMachineGridVisible() {
        return rootLayout != null && rootLayout.getParent() != null;
    }

    private void restoreMachineGrid() {
        if (!isMachineGridVisible()) {
            createTotemInterface();
        }
        applyOptimisticMachineStatuses();
        displayCurrentScreen();
    }

    /** Após pagamento aprovado: tela inicial com Lavar/Secar/Massagem/Café. */
    private void restoreHomeScreen() {
        cieloLaunchUiActive = false;
        currentScreen = TotemScreen.HOME;
        selectedMachine = null;
        selectedCoffeeProduct = null;
        restoreMachineGrid();
        cancelIdleTimeout();
    }

    /** Tela inicial do totem (grade Lavar/Secar/Massagem/Café), sem fluxo de pagamento. */
    private boolean isAtHomeIdle() {
        if (supabaseHelper == null || !supabaseHelper.isConfigured()) {
            return true;
        }
        return currentScreen == TotemScreen.HOME
            && selectedMachine == null
            && selectedCoffeeProduct == null
            && !awaitingPaymentCallback
            && !paymentLaunchInProgress.get()
            && currentOperationId <= 0
            && isMachineGridVisible();
    }

    private boolean shouldEnforceIdleTimeout() {
        if (awaitingPaymentCallback
                || paymentLaunchInProgress.get()
                || postPaymentHardwarePending
                || (activePaymentManager != null && activePaymentManager.isProcessing())
                || CieloPaymentSessionHelper.isPaymentWindowOpen(this)) {
            return false;
        }
        return supabaseHelper != null
            && supabaseHelper.isConfigured()
            && !isAtHomeIdle();
    }

    private void bumpUserInteraction() {
        lastUserInteractionMs = System.currentTimeMillis();
        ensureIdleWatchdogRunning();
    }

    private void ensureIdleWatchdogRunning() {
        if (idleWatchdogRunnable == null) {
            idleWatchdogRunnable = this::tickIdleWatchdog;
        }
        idleHandler.removeCallbacks(idleWatchdogRunnable);
        idleHandler.postDelayed(idleWatchdogRunnable, IDLE_WATCHDOG_TICK_MS);
    }

    private void tickIdleWatchdog() {
        if (shouldEnforceIdleTimeout()) {
            long idleMs = System.currentTimeMillis() - lastUserInteractionMs;
            if (idleMs >= SCREEN_IDLE_TIMEOUT_MS) {
                handleScreenIdleTimeout();
                return;
            }
        }
        ensureIdleWatchdogRunning();
    }

    /** Compat: inicia/reinicia o watchdog (não zera o relógio de inatividade). */
    private void scheduleIdleTimeout() {
        ensureIdleWatchdogRunning();
    }

    private void cancelIdleTimeout() {
        if (idleWatchdogRunnable != null) {
            idleHandler.removeCallbacks(idleWatchdogRunnable);
        }
    }

    private void handleScreenIdleTimeout() {
        Log.i(TAG, "Inatividade de 60s — retornando à tela inicial");
        abortSessionForIdleTimeout();
    }

    private void abortSessionForIdleTimeout() {
        if (awaitingPaymentCallback
                || paymentLaunchInProgress.get()
                || postPaymentHardwarePending
                || (activePaymentManager != null && activePaymentManager.isProcessing())
                || CieloPaymentSessionHelper.isPaymentWindowOpen(this)) {
            Log.d(TAG, "Idle timeout adiado — pagamento Cielo em andamento");
            bumpUserInteraction();
            return;
        }
        if (supabaseHelper == null || !supabaseHelper.isConfigured()) {
            cancelIdleTimeout();
            return;
        }
        final String pendingId = currentPendingTransactionId;
        awaitingPaymentCallback = false;
        paymentLaunchInProgress.set(false);
        currentOperationId = -1;
        currentPendingTransactionId = null;
        paymentContextMachine = null;
        selectedMachine = null;
        selectedCoffeeProduct = null;
        if (pendingId != null && !pendingId.isEmpty()) {
            new Thread(() -> {
                boolean cancelled = supabaseHelper.cancelTotemTransactionById(pendingId);
                Log.d(TAG, "Transação cancelada por inatividade (" + pendingId + "): " + cancelled);
            }).start();
        }
        restoreHomeScreen();
        if (!hasWindowFocus()) {
            Intent intent = new Intent(this, TotemActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            startActivity(intent);
        }
    }

    private void refreshCoffeeProductsAsync() {
        refreshCoffeeProductsAsync(false);
    }

    private void refreshCoffeeProductsAsync(boolean force) {
        if (supabaseHelper == null || !supabaseHelper.isConfigured()) {
            return;
        }
        long now = System.currentTimeMillis();
        if (!force
                && lastCoffeeProductsRefreshAtMs > 0
                && now - lastCoffeeProductsRefreshAtMs < COFFEE_MENU_REFRESH_MIN_INTERVAL_MS) {
            return;
        }
        if (!coffeeRefreshInFlight.compareAndSet(false, true)) {
            return;
        }
        new Thread(() -> {
            List<SupabaseHelper.CoffeeProduct> loaded = supabaseHelper.fetchCoffeeProducts();
            runOnUiThread(() -> {
                coffeeProducts = loaded != null ? loaded : new ArrayList<>();
                coffeeProductsLoadAttempted = true;
                lastCoffeeProductsRefreshAtMs = System.currentTimeMillis();
                coffeeRefreshInFlight.set(false);
                if (!shouldBlockTotemUiRefresh()
                        && (currentScreen == TotemScreen.HOME || currentScreen == TotemScreen.CAFE)) {
                    displayCurrentScreen();
                }
            });
        }).start();
    }

    private void displayCurrentScreen() {
        if (shouldBlockTotemUiRefresh()) {
            Log.d(TAG, "displayCurrentScreen ignorado — fluxo Cielo ativo");
            return;
        }
        switch (currentScreen) {
            case HOME:
                displayHomeScreen();
                break;
            case CAFE:
                displayCoffeeMenu();
                break;
            default:
                displayCategoryMachines(currentScreen);
                break;
        }
        ensureIdleWatchdogRunning();
    }


    private boolean hasValidEsp32Id(String esp32Id) {
        if (esp32Id == null) {
            return false;
        }
        String trimmed = esp32Id.trim();
        return !trimmed.isEmpty() && !"main".equalsIgnoreCase(trimmed);
    }

    /** Exibe categoria na HOME só se houver equipamento cadastrado com ESP32 vinculado. */
    private boolean hasRegisteredEsp32ForType(String type) {
        if (machines == null) return false;
        for (SupabaseHelper.Machine m : machines) {
            if (!type.equals(m.getType())) continue;
            if (hasValidEsp32Id(m.getEsp32Id())) {
                return true;
            }
        }
        return false;
    }

    private SupabaseHelper.Machine findRegisteredMachineByType(String type) {
        if (machines == null) {
            return null;
        }
        for (SupabaseHelper.Machine m : machines) {
            if (type.equals(m.getType()) && hasValidEsp32Id(m.getEsp32Id())) {
                return m;
            }
        }
        return null;
    }

    private boolean isCoffeeHomeAvailable() {
        return hasRegisteredEsp32ForType("CAFE");
    }

    private boolean isCoffeeAvailable() {
        SupabaseHelper.Machine coffeeMachine = findRegisteredMachineByType("CAFE");
        if (coffeeMachine == null) {
            return false;
        }
        return coffeeMachine.isEsp32Online();
    }

    private void displayHomeScreen() {
        if (machinesContainer == null) {
            createTotemInterface();
        }
        machinesContainer.removeAllViews();

        TextView hint = new TextView(this);
        hint.setText("Escolha o serviço");
        hint.setTextSize(22);
        hint.setTextColor(Color.parseColor("#58A6FF"));
        hint.setGravity(android.view.Gravity.CENTER);
        hint.setPadding(0, dp(24), 0, dp(16));
        hint.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        machinesContainer.addView(hint);

        GridLayout grid = new GridLayout(this);
        grid.setColumnCount(2);
        grid.setUseDefaultMargins(false);
        grid.setPadding(dp(8), 0, dp(8), dp(24));

        if (hasRegisteredEsp32ForType("LAVAR")) {
            grid.addView(buildHomeCategoryButton("🧺 LAVAR", Color.parseColor("#1F6FEB"), () -> openCategory(TotemScreen.LAVAR)));
        }
        if (hasRegisteredEsp32ForType("SECAR")) {
            grid.addView(buildHomeCategoryButton("🌪️ SECAR", Color.parseColor("#238636"), () -> openCategory(TotemScreen.SECAR)));
        }
        if (hasRegisteredEsp32ForType("MASSAGEM")) {
            grid.addView(buildHomeCategoryButton("💺 MASSAGEM", Color.parseColor("#8957E5"), () -> openCategory(TotemScreen.MASSAGEM)));
        }
        if (isCoffeeHomeAvailable()) {
            grid.addView(buildHomeCategoryButton("☕ CAFÉ", Color.parseColor("#9E6A03"), () -> openCategory(TotemScreen.CAFE)));
        }

        if (grid.getChildCount() == 0) {
            TextView loading = new TextView(this);
            loading.setText("⏳ Carregando serviços…");
            loading.setTextSize(18);
            loading.setTextColor(Color.parseColor("#8B949E"));
            loading.setGravity(android.view.Gravity.CENTER);
            loading.setPadding(dp(16), dp(48), dp(16), dp(16));
            machinesContainer.addView(loading);
        } else {
            machinesContainer.addView(grid);
        }
    }

    private Button buildHomeCategoryButton(String label, int bgColor, Runnable onClick) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextSize(18);
        button.setBackgroundColor(bgColor);
        button.setTextColor(Color.WHITE);
        button.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        button.setMinHeight(dp(120));
        GridLayout.LayoutParams params = new GridLayout.LayoutParams();
        params.width = 0;
        params.height = GridLayout.LayoutParams.WRAP_CONTENT;
        params.columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f);
        params.setMargins(dp(8), dp(8), dp(8), dp(8));
        button.setLayoutParams(params);
        button.setOnClickListener(v -> onClick.run());
        return button;
    }

    private void openCategory(TotemScreen screen) {
        currentScreen = screen;
        selectedCoffeeProduct = null;
        displayCurrentScreen();
    }

    private void goBackToHome() {
        currentScreen = TotemScreen.HOME;
        selectedMachine = null;
        selectedCoffeeProduct = null;
        displayCurrentScreen();
        if (isAtHomeIdle()) {
            cancelIdleTimeout();
        }
    }

    private void addBackToHomeButton() {
        Button back = new Button(this);
        back.setText("← Voltar");
        back.setTextSize(14);
        back.setBackgroundColor(Color.parseColor("#21262D"));
        back.setTextColor(Color.WHITE);
        back.setPadding(dp(12), dp(8), dp(12), dp(8));
        back.setOnClickListener(v -> goBackToHome());
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        params.setMargins(0, 0, 0, dp(12));
        back.setLayoutParams(params);
        machinesContainer.addView(back);
    }

    private void displayCategoryMachines(TotemScreen screen) {
        applyOptimisticMachineStatuses();
        if (machinesContainer == null) {
            createTotemInterface();
        }
        machinesContainer.removeAllViews();
        addBackToHomeButton();

        String filterType;
        String title;
        switch (screen) {
            case LAVAR:
                filterType = "LAVAR";
                title = "🧺 LAVADORAS";
                break;
            case SECAR:
                filterType = "SECAR";
                title = "🌪️ SECADORAS";
                break;
            case MASSAGEM:
                filterType = "MASSAGEM";
                title = "💺 POLTRONAS DE MASSAGEM";
                break;
            default:
                filterType = "LAVAR";
                title = "🧺 LAVADORAS";
        }

        List<SupabaseHelper.Machine> filtered = new ArrayList<>();
        if (machines != null) {
            for (SupabaseHelper.Machine machine : machines) {
                if (filterType.equals(machine.getType())) {
                    filtered.add(machine);
                }
            }
        }

        if (!filtered.isEmpty()) {
            createMachineRow(title, filtered);
        } else {
            TextView empty = new TextView(this);
            empty.setText("Nenhum equipamento cadastrado nesta categoria.");
            empty.setTextSize(16);
            empty.setTextColor(Color.parseColor("#8B949E"));
            empty.setGravity(android.view.Gravity.CENTER);
            empty.setPadding(dp(16), dp(32), dp(16), dp(16));
            machinesContainer.addView(empty);
        }
    }

    private void displayCoffeeMenu() {
        // Revalida preços/itens ao entrar no cardápio; evita ficar com valores antigos em sessão longa.
        refreshCoffeeProductsAsync(false);
        if (machinesContainer == null) {
            createTotemInterface();
        }
        machinesContainer.removeAllViews();
        addBackToHomeButton();

        TextView title = new TextView(this);
        title.setText("☕ CARDÁPIO DE CAFÉ");
        title.setTextSize(20);
        title.setTextColor(Color.parseColor("#58A6FF"));
        title.setGravity(android.view.Gravity.CENTER);
        title.setPadding(0, dp(8), 0, dp(16));
        title.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        machinesContainer.addView(title);

        if (coffeeProducts == null || coffeeProducts.isEmpty()) {
            TextView empty = new TextView(this);
            if (!coffeeProductsLoadAttempted) {
                empty.setText("⏳ Carregando cardápio…");
            } else {
                empty.setText("Nenhum produto no cardápio.\nCadastre itens em Admin → Cardápio Café.");
            }
            empty.setTextSize(16);
            empty.setTextColor(Color.parseColor("#8B949E"));
            empty.setGravity(android.view.Gravity.CENTER);
            empty.setPadding(dp(16), dp(32), dp(16), dp(16));
            machinesContainer.addView(empty);
            if (!coffeeProductsLoadAttempted) {
                refreshCoffeeProductsAsync();
            }
            return;
        }

        boolean online = isCoffeeAvailable();
        GridLayout grid = new GridLayout(this);
        grid.setColumnCount(getResources().getConfiguration().screenWidthDp >= 720 ? 2 : 1);
        grid.setUseDefaultMargins(false);

        DecimalFormat priceFmt = new DecimalFormat("0.00");
        for (SupabaseHelper.CoffeeProduct product : coffeeProducts) {
            Button btn = new Button(this);
            btn.setText(product.getName() + "\nR$ " + priceFmt.format(product.getPrice()));
            btn.setTextSize(15);
            btn.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
            btn.setPadding(dp(12), dp(16), dp(12), dp(16));
            GridLayout.LayoutParams params = new GridLayout.LayoutParams();
            params.width = 0;
            params.height = GridLayout.LayoutParams.WRAP_CONTENT;
            params.columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f);
            params.setMargins(dp(6), dp(6), dp(6), dp(6));
            btn.setLayoutParams(params);

            if (online) {
                btn.setBackgroundColor(Color.parseColor("#9E6A03"));
                btn.setTextColor(Color.WHITE);
                btn.setEnabled(true);
                btn.setOnClickListener(v -> selectCoffeeProduct(product));
            } else {
                btn.setBackgroundColor(Color.parseColor("#21262D"));
                btn.setTextColor(Color.parseColor("#7D8590"));
                btn.setEnabled(false);
            }
            grid.addView(btn);
        }
        machinesContainer.addView(grid);

        if (!online) {
            TextView offline = new TextView(this);
            offline.setText("🔴 Máquina de café offline — aguarde ou tente novamente.");
            offline.setTextColor(Color.parseColor("#F85149"));
            offline.setGravity(android.view.Gravity.CENTER);
            offline.setPadding(dp(12), dp(16), dp(12), dp(8));
            machinesContainer.addView(offline);
        }
    }

    private void selectCoffeeProduct(SupabaseHelper.CoffeeProduct product) {
        selectedCoffeeProduct = product;
        SupabaseHelper.Machine coffeeMachine = supabaseHelper.findMachineById(product.getMachineId());
        if (coffeeMachine == null) {
            coffeeMachine = new SupabaseHelper.Machine();
            coffeeMachine.setId(product.getMachineId());
            coffeeMachine.setName("Máquina de Café");
            coffeeMachine.setType("CAFE");
            coffeeMachine.setPrice(product.getPrice());
            coffeeMachine.setDuration(0);
            coffeeMachine.setEsp32Online(true);
        } else {
            coffeeMachine.setPrice(product.getPrice());
        }
        selectedMachine = coffeeMachine;
        showCoffeePaymentScreen(product, coffeeMachine);
    }

    private void showCoffeePaymentScreen(SupabaseHelper.CoffeeProduct product, SupabaseHelper.Machine machine) {
        ScrollView scrollView = new ScrollView(this);
        scrollView.setFillViewport(true);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(dp(20), dp(20), dp(20), dp(20));
        layout.setBackgroundColor(Color.parseColor("#9E6A03"));

        TextView title = new TextView(this);
        title.setText("Pagamento — " + product.getName());
        title.setTextSize(24);
        title.setTextColor(Color.WHITE);
        title.setGravity(android.view.Gravity.CENTER);
        layout.addView(title);

        TextView details = new TextView(this);
        details.setText("Valor: R$ " + new DecimalFormat("0.00").format(product.getPrice()) + "\n\n"
            + getPaymentInstructionTitle() + "\n" + getPaymentInstructionSubtitle());
        details.setTextSize(16);
        details.setTextColor(Color.WHITE);
        details.setGravity(android.view.Gravity.CENTER);
        details.setPadding(20, 20, 20, 30);
        layout.addView(details);

        Button creditBtn = buildPaymentTypeButton("💳 CRÉDITO À VISTA", Color.parseColor("#6E4C00"),
            () -> startCoffeePaymentFlow(product, machine, "credit"));
        layout.addView(creditBtn);
        Button debitBtn = buildPaymentTypeButton("💳 DÉBITO À VISTA", Color.parseColor("#5D3F00"),
            () -> startCoffeePaymentFlow(product, machine, "debit"));
        layout.addView(debitBtn);
        if ("cielo".equalsIgnoreCase(activeProvider)) {
            layout.addView(buildPaymentTypeButton("📱 PIX", Color.parseColor("#4A3900"),
                () -> startCoffeePaymentFlow(product, machine, "pix")));
        }

        Button backBtn = new Button(this);
        backBtn.setText("← Voltar ao cardápio");
        backBtn.setBackgroundColor(Color.parseColor("#21262D"));
        backBtn.setTextColor(Color.WHITE);
        backBtn.setOnClickListener(v -> openCategory(TotemScreen.CAFE));
        layout.addView(backBtn);

        scrollView.addView(layout);
        setTotemContentView(scrollView);
    }

    private void startCoffeePaymentFlow(SupabaseHelper.CoffeeProduct product, SupabaseHelper.Machine machine, String paymentType) {
        selectedCoffeeProduct = product;
        selectedMachine = machine;
        startPaymentFlow(machine, paymentType);
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
        int matchedCount = 0;
        for (MachineStatusMonitor.MachineStatus status : statuses) {
            seen.add(status.machineId);
            for (SupabaseHelper.Machine machine : machines) {
                if (machine.getId().equals(status.machineId)) {
                    matchedCount++;
                    machine.setEsp32Online(status.esp32Online);

                    // Sincronizar dados mutáveis (nome, tipo, preço, ciclo) do servidor
                    if (status.machineName != null && !status.machineName.isEmpty()) {
                        machine.setName(status.machineName);
                    }
                    if (status.machineType != null && !status.machineType.isEmpty()) {
                        String mappedType = "washing".equals(status.machineType) || "lavadora".equals(status.machineType) ? "LAVAR"
                                : "drying".equals(status.machineType) || "secadora".equals(status.machineType) ? "SECAR"
                                : "massage".equals(status.machineType) ? "MASSAGEM"
                                : "coffee".equals(status.machineType) ? "CAFE" : "LAVAR";
                        machine.setType(mappedType);
                    }
                    if (status.pricePerCycle > 0) {
                        machine.setPrice(status.pricePerCycle);
                    }
                    if (status.cycleTimeMinutes > 0) {
                        machine.setDuration(status.cycleTimeMinutes);
                    }
                    
                    if (status.isAvailable()) {
                        if (isOptimisticallyOccupied(machine.getId())) {
                            machine.setStatus("OCUPADA");
                        } else {
                            machine.setStatus("LIVRE");
                        }
                    } else if (status.isRunning()) {
                        machine.setStatus("OCUPADA");
                        clearOptimisticOccupiedIfConfirmed(machine.getId());
                    } else if (status.isMaintenance()) {
                        machine.setStatus("MANUTENCAO");
                    } else {
                        machine.setStatus("OFFLINE");
                    }
                    
                    break;
                }
            }
        }
        // Só marcar offline se houve match (evita lista placeholder "1","2" vs UUIDs do RPC)
        if (matchedCount > 0) {
            for (SupabaseHelper.Machine machine : machines) {
                if (!seen.contains(machine.getId())) {
                    machine.setEsp32Online(false);
                    machine.setStatus("OFFLINE");
                }
            }
        } else if (!machines.isEmpty()) {
            Log.w(TAG, "Monitor sem match com lista local — aguardando fetch de máquinas");
        }

        if (shouldBlockTotemUiRefresh()) {
            return;
        }
        displayCurrentScreen();
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
                    HttpURLConnection connection = SupabaseConfig.openConnection(url);
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

        setTotemContentView(rootLayout);
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
        applyOptimisticMachineStatuses();
        refreshCoffeeProductsAsync();
        displayCurrentScreen();
        
        Log.d(TAG, "Interface inicial carregada, aguardando dados reais do Supabase...");
    }

    private void markMachineOptimisticallyOccupied(String machineId) {
        if (machineId == null || machineId.isEmpty()) {
            return;
        }
        optimisticOccupiedMachineId = machineId;
        optimisticOccupiedAtMs = System.currentTimeMillis();
        if (supabaseHelper != null) {
            supabaseHelper.patchCachedMachineStatus(machineId, "OCUPADA", true);
        }
        applyOptimisticMachineStatuses();
        Log.d(TAG, "Status otimista OCUPADA aplicado para máquina " + machineId);
    }

    private void applyOptimisticMachineStatuses() {
        if (optimisticOccupiedMachineId == null || machines == null) {
            return;
        }
        if (System.currentTimeMillis() - optimisticOccupiedAtMs > OPTIMISTIC_OCCUPIED_MAX_MS) {
            optimisticOccupiedMachineId = null;
            return;
        }
        for (SupabaseHelper.Machine machine : machines) {
            if (optimisticOccupiedMachineId.equals(machine.getId())) {
                machine.setStatus("OCUPADA");
                if (machine.getEsp32Id() != null && !machine.getEsp32Id().isEmpty()) {
                    machine.setEsp32Online(true);
                }
                break;
            }
        }
    }

    private void clearOptimisticOccupiedIfConfirmed(String machineId) {
        if (optimisticOccupiedMachineId != null && optimisticOccupiedMachineId.equals(machineId)) {
            optimisticOccupiedMachineId = null;
            Log.d(TAG, "Status OCUPADA confirmado pelo servidor para " + machineId);
        }
    }

    private void clearOptimisticOccupied() {
        optimisticOccupiedMachineId = null;
        optimisticOccupiedAtMs = 0L;
    }

    private void showPostPaymentVerifyingScreen(SupabaseHelper.Machine machine) {
        cancelPendingSuccessScreen();
        ScrollView scrollView = new ScrollView(this);
        scrollView.setFillViewport(true);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(dp(24), dp(32), dp(24), dp(32));
        layout.setBackgroundColor(Color.parseColor("#1565C0"));
        layout.setGravity(android.view.Gravity.CENTER);

        TextView statusText = new TextView(this);
        String machineLabel = machine != null ? machine.getName() : "Máquina";
        statusText.setText("Pagamento aprovado\n\nLiberando " + machineLabel + "...\nAguarde.");
        statusText.setTextSize(20);
        statusText.setTextColor(Color.WHITE);
        statusText.setGravity(android.view.Gravity.CENTER);
        statusText.setLineSpacing(dp(4), 1f);
        layout.addView(statusText);

        scrollView.addView(layout);
        setTotemContentView(scrollView);
    }

    private void showEsp32FailureScreen(String message) {
        cancelPendingSuccessScreen();
        ScrollView scrollView = new ScrollView(this);
        scrollView.setFillViewport(true);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(dp(24), dp(32), dp(24), dp(32));
        layout.setBackgroundColor(Color.parseColor("#C62828"));
        layout.setGravity(android.view.Gravity.CENTER);

        TextView errorText = new TextView(this);
        errorText.setText(message);
        errorText.setTextSize(18);
        errorText.setTextColor(Color.WHITE);
        errorText.setGravity(android.view.Gravity.CENTER);
        errorText.setLineSpacing(dp(4), 1f);
        layout.addView(errorText);

        scrollView.addView(layout);
        setTotemContentView(scrollView);
    }

    private void handleEsp32FailureWithRefund(
            SupabaseHelper.Machine machineSnapshot,
            String pendingTxIdFinal,
            long operationId,
            boolean canAutoRefund
    ) {
        final String machineId = machineSnapshot.getId();
        boolean reversed = false;
        if (canAutoRefund && cieloManager != null && cieloManager.hasApprovedPaymentSnapshot()) {
            Log.w(TAG, "ESP32 não confirmou — iniciando estorno automático Cielo");
            reversed = cieloManager.requestAutomaticReversal();
        } else if (canAutoRefund) {
            Log.e(TAG, "ESP32 não confirmou — estorno automático indisponível (sem snapshot Cielo)");
        }

        if (pendingTxIdFinal != null && !pendingTxIdFinal.isEmpty()) {
            boolean cancelled = supabaseHelper.cancelTotemTransactionById(pendingTxIdFinal);
            Log.d(TAG, "Transação totem cancelada após falha ESP32: " + cancelled);
        }
        supabaseHelper.updateMachineStatus(machineId, "LIVRE");
        supabaseHelper.patchCachedMachineStatus(machineId, "LIVRE", false);
        clearOptimisticOccupied();

        final String userMessage = reversed
            ? "Não foi possível liberar a máquina.\n\nPagamento estornado automaticamente.\nTente novamente ou escolha outra máquina."
            : (canAutoRefund
                ? "Não foi possível liberar a máquina.\n\nEstorno solicitado — confira o comprovante no terminal.\nSe o valor não voltar, fale com o atendimento."
                : "Não foi possível liberar a máquina.\n\nFale com o atendimento para estorno do pagamento.");

        postPaymentHardwarePending = false;
        runOnUiThread(() -> {
            showEsp32FailureScreen(userMessage);
            adminTapHandler.postDelayed(() -> {
                if (operationId == lastSucceededOperationId || operationId == currentOperationId) {
                    finishCieloPaymentSession(operationId, false);
                }
            }, 5000L);
        });
        if ("cielo".equalsIgnoreCase(activeProvider)) {
            cieloManager.onTotemCheckoutFinished();
        }
    }
    
    private void displayMachines() {
        displayCurrentScreen();
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

        int bgColor = Color.parseColor("#2196F3");
        int panelColor = Color.parseColor("#1976D2");
        String header = "Confirmar pagamento";
        if ("MASSAGEM".equals(machine.getType())) {
            bgColor = Color.parseColor("#8957E5");
            panelColor = Color.parseColor("#6F42C1");
            header = "Pagamento — Poltrona de massagem";
        } else if ("SECAR".equals(machine.getType())) {
            bgColor = Color.parseColor("#238636");
            panelColor = Color.parseColor("#1A7F37");
        } else if ("LAVAR".equals(machine.getType())) {
            bgColor = Color.parseColor("#1F6FEB");
            panelColor = Color.parseColor("#1158C7");
        }
        layout.setBackgroundColor(bgColor);
        
        // Título
        TextView title = new TextView(this);
        title.setText(header);
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
        details.setBackgroundColor(panelColor);
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

        int btnPrimary = panelColor;
        int btnSecondary = bgColor;
        Button creditBtn = buildPaymentTypeButton("💳 CRÉDITO À VISTA", btnPrimary,
            () -> startPaymentFlow(machine, "credit"));
        Button debitBtn = buildPaymentTypeButton("💳 DÉBITO À VISTA", btnSecondary,
            () -> startPaymentFlow(machine, "debit"));
        Button pixBtn = buildPaymentTypeButton("📱 PIX", Color.parseColor("#00897B"),
            () -> startPaymentFlow(machine, "pix"));

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
        setTotemContentView(scrollView);
    }

    /** Tarja e "Não imprimir" exigem o assistente Cielo (não usa "Exibir sobre apps"). */
    private void warnCieloPrerequisitesIfNeeded() {
        if (CieloReceiptAccessibilityHelper.isServiceEnabled(this)) {
            return;
        }
        new AlertDialog.Builder(this)
            .setTitle("Assistente Cielo necessário")
            .setMessage(
                "Para cobrir QR Code/digitar cartão e tocar em \"Não imprimir\", "
                    + "ative o serviço:\n\n"
                    + "Top Lavanderia — assistente Cielo\n\n"
                    + "(Configurações → Acessibilidade)")
            .setNegativeButton("Depois", null)
            .setPositiveButton("Abrir configurações", (d, w) ->
                startActivity(CieloReceiptAccessibilityHelper.buildSettingsIntent()))
            .show();
    }

    /** Substitui a tela de forma de pagamento — feedback imediato e sem flash ao voltar da Cielo. */
    private void showCieloLaunchingScreen(SupabaseHelper.Machine machine, String paymentType) {
        cieloLaunchUiActive = true;
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(android.view.Gravity.CENTER);
        layout.setPadding(dp(32), dp(32), dp(32), dp(32));
        layout.setBackgroundColor(Color.parseColor("#1565C0"));

        TextView title = new TextView(this);
        title.setText("Abrindo pagamento...");
        title.setTextSize(22);
        title.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        title.setTextColor(Color.WHITE);
        title.setGravity(android.view.Gravity.CENTER);
        title.setPadding(0, 0, 0, dp(16));
        layout.addView(title);

        TextView details = new TextView(this);
        String machineName = machine != null ? machine.getName() : "";
        String price = machine != null
            ? "R$ " + new DecimalFormat("0.00").format(machine.getPrice())
            : "";
        details.setText(machineName + "\n" + formatPaymentTypeLabel(paymentType)
            + (price.isEmpty() ? "" : "\n" + price)
            + "\n\nAguarde — não toque novamente");
        details.setTextSize(16);
        details.setTextColor(Color.WHITE);
        details.setGravity(android.view.Gravity.CENTER);
        layout.addView(details);

        setTotemContentView(layout);
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
        button.setOnClickListener(v -> {
            v.setEnabled(false);
            onClick.run();
        });
        return button;
    }
    
    /** Feedback imediato na UI; trabalho pesado roda em background. */
    private void startPaymentFlow(SupabaseHelper.Machine machine, String paymentType) {
        if ("cielo".equalsIgnoreCase(activeProvider)) {
            if (!paymentLaunchInProgress.compareAndSet(false, true)) {
                Log.d(TAG, "Pagamento Cielo já em abertura — toque ignorado");
                return;
            }
            paymentContextMachine = machine;
            currentOperationSupabasePaymentMethod = toSupabasePaymentMethod(paymentType);
            warnCieloPrerequisitesIfNeeded();
            showCieloLaunchingScreen(machine, paymentType);
            processPayment(machine, paymentType);
            return;
        }
        showPaymentProcessing(machine, paymentType);
        processPayment(machine, paymentType);
    }

    /**
     * Abre o fluxo de pagamento (Cielo: crédito à vista no deep link; cartão/PIX/débito podem ser escolhidos na tela nativa).
     */
    private void processPayment(SupabaseHelper.Machine machine) {
        startPaymentFlow(machine, "credit");
    }

    /**
     * @param paymentTypeForManager tipo enviado ao {@link PaymentManager} (ex.: credit, pix para Cielo LIO).
     */
    private void processPayment(SupabaseHelper.Machine machine, String paymentTypeForManager) {
        new Thread(() -> {
            try {
                if ("cielo".equalsIgnoreCase(activeProvider)) {
                    cieloManager.releaseStaleProcessingIfNeeded();
                }
                if (activePaymentManager != null && activePaymentManager.isProcessing()) {
                    if ("cielo".equalsIgnoreCase(activeProvider)) {
                        paymentLaunchInProgress.set(false);
                    }
                    runOnUiThread(() -> handlePaymentError("Aguarde: pagamento anterior ainda em processamento na maquininha."));
                    return;
                }
                final boolean cieloFlow = "cielo".equalsIgnoreCase(activeProvider);
                if (!cieloFlow) {
                    if (!paymentLaunchInProgress.compareAndSet(false, true)) {
                        runOnUiThread(() -> handlePaymentError("Pagamento já está sendo iniciado. Aguarde."));
                        return;
                    }
                } else if (!paymentLaunchInProgress.get()) {
                    if (!paymentLaunchInProgress.compareAndSet(false, true)) {
                        runOnUiThread(() -> handlePaymentError("Pagamento já está sendo iniciado. Aguarde."));
                        return;
                    }
                    runOnUiThread(() -> showCieloLaunchingScreen(machine, paymentTypeForManager));
                }

                if ("cielo".equalsIgnoreCase(activeProvider)) {
                    cieloManager.takeLastDetectedSupabasePaymentMethod();
                }
                final String supabaseMethod = toSupabasePaymentMethod(paymentTypeForManager);
                currentOperationSupabasePaymentMethod = supabaseMethod;

                Log.d(TAG, "=== INICIANDO PAGAMENTO === " + machine.getName() + " tipo=" + paymentTypeForManager);

                if (selectedCoffeeProduct != null) {
                    if (!isCoffeeAvailable()) {
                        paymentLaunchInProgress.set(false);
                        runOnUiThread(() -> handlePaymentError("Máquina de café indisponível no momento."));
                        return;
                    }
                } else if (!validateMachineAvailabilityFast(machine)) {
                    Log.w(TAG, "PAGAMENTO BLOQUEADO - Máquina não disponível");
                    paymentLaunchInProgress.set(false);
                    runOnUiThread(() -> {
                        handlePaymentError("Máquina não está mais disponível. Por favor, selecione outra.");
                        new Handler(Looper.getMainLooper()).postDelayed(() -> {
                            createTotemInterface();
                            loadMachines();
                        }, 3000);
                    });
                    return;
                }

                currentOperationId = System.nanoTime();
                final String cieloReference = UUID.randomUUID().toString();
                final SupabaseHelper.CoffeeProduct coffeeProductSnapshot = selectedCoffeeProduct;
                String pendingTxId;
                if (coffeeProductSnapshot != null) {
                    pendingTxId = supabaseHelper.createCoffeeTransaction(
                        coffeeProductSnapshot.getId(),
                        supabaseMethod
                    );
                } else {
                    pendingTxId = supabaseHelper.createTransaction(
                        machine.getId(),
                        machine.getTypeDisplay(),
                        machine.getPrice(),
                        "PENDING",
                        "TXN" + currentOperationId,
                        supabaseMethod
                    );
                }
                currentPendingTransactionId = pendingTxId;
                if ("cielo".equalsIgnoreCase(activeProvider)) {
                    cieloManager.bindTotemCheckout(
                        currentOperationId,
                        machine.getId(),
                        pendingTxId
                    );
                }
                if (pendingTxId == null) {
                    Log.w(TAG, "Falha ao criar operação no Supabase; prosseguindo com fluxo local");
                }

                if ("cielo".equalsIgnoreCase(activeProvider)) {
                    ensureCieloConfigured();
                    String configErr = cieloManager.getConfigurationError();
                    if (configErr != null) {
                        Log.e(TAG, "Pagamento bloqueado — config Cielo: " + configErr);
                        paymentLaunchInProgress.set(false);
                        runOnUiThread(() -> handlePaymentError(configErr));
                        return;
                    }
                }

                if (activePaymentManager != null && !activePaymentManager.isInitialized()) {
                    paymentLaunchInProgress.set(false);
                    runOnUiThread(() -> handlePaymentError(
                        "Pagamento não configurado. Verifique credenciais Cielo no painel admin.",
                        currentOperationId));
                    return;
                }

                cancelPendingSuccessScreen();
                awaitingPaymentCallback = true;
                paymentContextMachine = machine;
                final String managerPaymentType = paymentTypeForManager == null || paymentTypeForManager.isEmpty()
                    ? "credit" : paymentTypeForManager;
                final String paymentLabel = coffeeProductSnapshot != null
                    ? coffeeProductSnapshot.getName()
                    : machine.getName();
                activePaymentManager.processPayment(
                    machine.getPrice(),
                    managerPaymentType,
                    "Top Lavanderia - " + paymentLabel,
                    cieloReference
                );
                if (!"cielo".equalsIgnoreCase(activeProvider)) {
                    runOnUiThread(() -> showPaymentProcessing(machine, managerPaymentType));
                }
            } catch (Exception e) {
                awaitingPaymentCallback = false;
                paymentLaunchInProgress.set(false);
                Log.e(TAG, "Erro ao processar pagamento", e);
                final long op = currentOperationId;
                runOnUiThread(() -> handlePaymentError("Erro ao processar pagamento: " + e.getMessage(), op));
            }
        }).start();
    }

    /** Confia no status da grade (evita 5–10s de rede no clique do botão). */
    private boolean validateMachineAvailabilityFast(SupabaseHelper.Machine machine) {
        if (machine == null) {
            return false;
        }
        if (isOptimisticallyOccupied(machine.getId())) {
            return false;
        }
        return machine.isAvailable();
    }

    private static String formatPaymentTypeLabel(String paymentType) {
        if (paymentType == null) {
            return "Crédito";
        }
        String t = paymentType.trim().toLowerCase(Locale.ROOT);
        if ("debit".equals(t) || "debito".equals(t)) {
            return "Débito";
        }
        if ("pix".equals(t)) {
            return "PIX";
        }
        return "Crédito";
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
                
                HttpURLConnection connection = SupabaseConfig.openConnection(url);
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
            
            HttpURLConnection connection = SupabaseConfig.openConnection(url);
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
        showPaymentProcessing(machine, currentOperationSupabasePaymentMethod);
    }

    private void showPaymentProcessing(SupabaseHelper.Machine machine, String paymentType) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 50, 50, 50);
        layout.setBackgroundColor(Color.parseColor("#FF9800"));
        
        TextView processingText = new TextView(this);
        processingText.setText("💳 PROCESSANDO PAGAMENTO\n\n" +
                             "Máquina: " + machine.getName() + "\n" +
                             "Forma: " + formatPaymentTypeLabel(paymentType) + "\n" +
                             "Valor: R$ " + new DecimalFormat("0.00").format(machine.getPrice()) + "\n" +
                             "Operação: " + currentOperationId + "\n\n" +
                             "🔄 " + getPaymentProcessingText() + "\n" +
                             getCieloPaymentHint(paymentType) +
                             "Aguarde o processamento do pagamento");
        processingText.setTextSize(16);
        processingText.setGravity(android.view.Gravity.CENTER);
        processingText.setPadding(20, 20, 20, 20);
        processingText.setTextColor(Color.WHITE);
        layout.addView(processingText);
        
        setTotemContentView(layout);
    }
    
    private boolean isCurrentPaymentOperation(long operationId) {
        return acceptsPaymentOperation(operationId);
    }

    private boolean acceptsPaymentOperation(long operationId) {
        if (operationId <= 0) {
            return false;
        }
        if (operationId == currentOperationId) {
            return true;
        }
        return "cielo".equalsIgnoreCase(activeProvider) && cieloManager.matchesBoundOperation(operationId);
    }

    private long resolvePaymentOperationId() {
        if (currentOperationId > 0) {
            return currentOperationId;
        }
        if ("cielo".equalsIgnoreCase(activeProvider)) {
            return cieloManager.getBoundTotemOperationId();
        }
        return currentOperationId;
    }

    private SupabaseHelper.Machine findMachineById(String machineId) {
        if (machineId == null || machineId.isEmpty() || machines == null) {
            return null;
        }
        for (SupabaseHelper.Machine machine : machines) {
            if (machineId.equals(machine.getId())) {
                return machine;
            }
        }
        return null;
    }

    private void cancelPendingSuccessScreen() {
        if (pendingSuccessResetRunnable != null) {
            adminTapHandler.removeCallbacks(pendingSuccessResetRunnable);
            pendingSuccessResetRunnable = null;
        }
    }

    private void handlePaymentSuccess(String authorizationCode, String transactionId, long operationId) {
        if (!isCurrentPaymentOperation(operationId)) {
            Log.w(TAG, "Ignorando sucesso obsoleto (op=" + operationId + ", atual=" + currentOperationId + ")");
            return;
        }

        SupabaseHelper.Machine machineForRefresh = selectedMachine != null
            ? selectedMachine
            : paymentContextMachine;
        if (machineForRefresh == null && "cielo".equalsIgnoreCase(activeProvider)) {
            machineForRefresh = findMachineById(cieloManager.getBoundMachineId());
        }
        SupabaseHelper.Machine resolvedMachine = machineForRefresh;
        // Sempre revalida preço/tempo do servidor (também no Cielo) para não usar cache curto.
        if (machineForRefresh != null && supabaseHelper != null) {
            SupabaseHelper.Machine refreshedMachine = supabaseHelper.refreshMachineById(machineForRefresh.getId());
            if (refreshedMachine != null) {
                resolvedMachine = refreshedMachine;
            }
        }
        final SupabaseHelper.Machine machineSnapshot = resolvedMachine;
        if (machineSnapshot == null) {
            runOnUiThread(() -> handlePaymentError("Pagamento aprovado, mas a máquina selecionada não está disponível."));
            return;
        }

        if ("cielo".equalsIgnoreCase(activeProvider)) {
            String detected = cieloManager.takeLastDetectedSupabasePaymentMethod();
            if (detected != null && !detected.isEmpty()) {
                currentOperationSupabasePaymentMethod = detected;
                Log.d(TAG, "Forma de pagamento confirmada pela Cielo (Supabase): " + detected);
            }
        }

        awaitingPaymentCallback = false;
        paymentLaunchInProgress.set(false);
        lastSucceededOperationId = operationId;

        final String machineId = machineSnapshot.getId();
        String pendingTxId = currentPendingTransactionId;
        if ((pendingTxId == null || pendingTxId.isEmpty()) && "cielo".equalsIgnoreCase(activeProvider)) {
            pendingTxId = cieloManager.getBoundPendingTxId();
        }
        final String pendingTxIdFinal = pendingTxId;
        final int durationMinutes = machineSnapshot.getDuration() > 0
            ? machineSnapshot.getDuration()
            : 40;
        final String esp32Id = machineSnapshot.getEsp32Id();
        final int relayPin = machineSnapshot.getRelayPin();
        final String methodForComplete = currentOperationSupabasePaymentMethod != null
            ? currentOperationSupabasePaymentMethod
            : "credit";
        final SupabaseHelper.CoffeeProduct coffeeSnapshot = selectedCoffeeProduct;
        // Machine type cobre retorno Cielo quando selectedCoffeeProduct já foi limpo.
        final boolean isCoffeePayment = coffeeSnapshot != null
            || "CAFE".equals(machineSnapshot.getType());
        final boolean cieloFastPath = "cielo".equalsIgnoreCase(activeProvider);
        if (cieloFastPath && !isCoffeePayment) {
            postPaymentHardwarePending = true;
            bumpUserInteraction();
        }

        if (!isCoffeePayment && supabaseHelper != null && !cieloFastPath) {
            supabaseHelper.patchCachedMachineStatus(machineId, "OCUPADA", true);
        }

        runOnUiThread(() -> {
            if (!isCurrentPaymentOperation(operationId) && operationId != lastSucceededOperationId) {
                return;
            }
            triggerAutomaticReceiptPrint(machineSnapshot, authorizationCode, transactionId);
            if (cieloFastPath) {
                if (!isCoffeePayment) {
                    showPostPaymentVerifyingScreen(machineSnapshot);
                } else {
                    // Mantém tela de liberação enquanto o crédito é enfileirado.
                    showPostPaymentVerifyingScreen(machineSnapshot);
                }
            } else {
                if (!isCoffeePayment) {
                    markMachineOptimisticallyOccupied(machineId);
                }
                showBriefPaymentSuccessAndReset(machineSnapshot, operationId);
            }
        });

        try {
            Log.d(TAG, "=== PAGAMENTO APROVADO ===");
            Log.d(TAG, "Código: " + authorizationCode);
            Log.d(TAG, "Transação: " + transactionId);

            if (cieloFastPath && isCoffeePayment) {
                Log.d(TAG, "=== CIELO: enfileirando crédito café (antes de concluir TX) ===");
                boolean creditQueued = false;
                if (pendingTxIdFinal != null && !pendingTxIdFinal.isEmpty()) {
                    creditQueued = supabaseHelper.enqueueCoffeeCredit(pendingTxIdFinal);
                }
                if (!creditQueued) {
                    Log.e(TAG, "❌ Crédito café não enfileirado — estorno automático se possível");
                    handleEsp32FailureWithRefund(
                        machineSnapshot, pendingTxIdFinal, operationId, true
                    );
                    return;
                }

                boolean txCompleted = supabaseHelper.completeTotemTransactionById(
                    pendingTxIdFinal, methodForComplete
                );
                if (!txCompleted) {
                    Log.w(TAG, "Crédito enfileirado, mas falhou ao marcar TX café como concluída");
                }

                runOnUiThread(() -> {
                    selectedMachine = null;
                    selectedCoffeeProduct = null;
                    finishCieloPaymentSession(operationId, true);
                });
                cieloManager.onTotemCheckoutFinished();
                return;
            }

            if (cieloFastPath && !isCoffeePayment) {
                String esp32TxId = pendingTxIdFinal != null && !pendingTxIdFinal.isEmpty()
                    ? pendingTxIdFinal : transactionId;
                Log.d(TAG, "=== CIELO: enfileirando ESP32 + aguardando confirmação ===");
                boolean queued = supabaseHelper.queueEsp32RelayOn(
                    esp32Id, relayPin, machineId, esp32TxId, durationMinutes
                );
                if (!queued) {
                    handleEsp32FailureWithRefund(
                        machineSnapshot, pendingTxIdFinal, operationId, true
                    );
                    return;
                }
                boolean relayConfirmed = supabaseHelper.waitForEsp32RelayOn(
                    esp32Id, relayPin, machineId, ESP32_CONFIRM_TIMEOUT_MS
                );
                if (!relayConfirmed) {
                    handleEsp32FailureWithRefund(
                        machineSnapshot, pendingTxIdFinal, operationId, true
                    );
                    return;
                }

                supabaseHelper.onEsp32RelayConfirmed(esp32Id, relayPin, machineId, durationMinutes);
                boolean usageStarted = supabaseHelper.startMachineUsage(machineId, durationMinutes);
                Log.d(TAG, "Status OCUPADA no servidor: " + usageStarted);

                boolean txCompleted = false;
                if (pendingTxIdFinal != null && !pendingTxIdFinal.isEmpty()) {
                    txCompleted = supabaseHelper.completeTotemTransactionById(
                        pendingTxIdFinal, methodForComplete
                    );
                }
                if (!txCompleted) {
                    txCompleted = supabaseHelper.completeLatestTotemTransaction(
                        machineId, methodForComplete
                    );
                }
                if (!txCompleted) {
                    Log.w(TAG, "Não foi possível marcar a transação do totem como concluída");
                }

                runOnUiThread(() -> {
                    markMachineOptimisticallyOccupied(machineId);
                    selectedMachine = null;
                    selectedCoffeeProduct = null;
                    finishCieloPaymentSession(operationId, true);
                });
                cieloManager.onTotemCheckoutFinished();
                return;
            }

            boolean hardwareOk = false;

            // Café: enfileirar crédito ENQUANTO a TX ainda está pending (RPC exige status pending).
            if (isCoffeePayment) {
                Log.d(TAG, "=== ENFILEIRANDO CRÉDITO CAFÉ ===");
                hardwareOk = pendingTxIdFinal != null
                    && !pendingTxIdFinal.isEmpty()
                    && supabaseHelper.enqueueCoffeeCredit(pendingTxIdFinal);
                if (hardwareOk) {
                    Log.d(TAG, "✅ Crédito café enfileirado para ESP32");
                } else {
                    Log.e(TAG, "❌ Falha ao enfileirar crédito café (pagamento já aprovado)");
                }
            }

            boolean txCompleted = false;
            if (pendingTxIdFinal != null && !pendingTxIdFinal.isEmpty()) {
                txCompleted = supabaseHelper.completeTotemTransactionById(
                    pendingTxIdFinal,
                    methodForComplete
                );
            }
            if (!txCompleted && !isCoffeePayment) {
                txCompleted = supabaseHelper.completeLatestTotemTransaction(
                    machineId,
                    methodForComplete
                );
            }
            if (!txCompleted) {
                Log.w(TAG, "Não foi possível marcar a transação do totem como concluída");
            }

            if (!isCoffeePayment) {
                Log.d(TAG, "=== ACIONANDO ESP32 ===");
                String esp32TxId = pendingTxIdFinal != null && !pendingTxIdFinal.isEmpty()
                    ? pendingTxIdFinal : transactionId;
                hardwareOk = supabaseHelper.activateEsp32Relay(
                    esp32Id,
                    relayPin,
                    machineId,
                    esp32TxId,
                    durationMinutes
                );
                if (hardwareOk) {
                    Log.d(TAG, "✅ ESP32 acionado com sucesso - máquina liberada por " + durationMinutes + " min");
                    supabaseHelper.patchCachedMachineStatus(machineId, "OCUPADA", true);
                    supabaseHelper.startMachineUsage(machineId, durationMinutes);
                } else {
                    Log.e(TAG, "❌ Falha ao acionar ESP32");
                }
            }

            if ("cielo".equalsIgnoreCase(activeProvider)) {
                final boolean activated = hardwareOk;
                runOnUiThread(() -> finishCieloPaymentSession(operationId, activated));
                cieloManager.onTotemCheckoutFinished();
            }
        } catch (Exception e) {
            Log.e(TAG, "Erro ao finalizar pós-pagamento (ESP32/Supabase)", e);
            if (cieloFastPath) {
                handleEsp32FailureWithRefund(
                    machineSnapshot, pendingTxIdFinal, operationId, true
                );
            } else if ("cielo".equalsIgnoreCase(activeProvider)) {
                runOnUiThread(() -> finishCieloPaymentSession(operationId, false));
            }
        }
    }
    
    private void triggerAutomaticReceiptPrint(SupabaseHelper.Machine machine, String authorizationCode, String transactionId) {
        // Comprovante: Cielo/PayGo no terminal; totem não exibe tela de impressão.
        Log.d(TAG, "Pagamento concluído - máquina=" + machine.getName()
            + ", método=" + currentOperationSupabasePaymentMethod
            + ", auth=" + authorizationCode + ", txn=" + transactionId);
    }

    /** Feedback curto ao cliente e retorno automático à tela inicial (sem perguntar sobre comprovante). */
    private void showBriefPaymentSuccessAndReset(SupabaseHelper.Machine machine, long operationId) {
        if (!isCurrentPaymentOperation(operationId)) {
            return;
        }
        cancelPendingSuccessScreen();
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
        setTotemContentView(scrollView);

        if (pendingSuccessResetRunnable != null) {
            adminTapHandler.removeCallbacks(pendingSuccessResetRunnable);
        }
        final long resetForOperation = operationId;
        pendingSuccessResetRunnable = () -> {
            if (isCurrentPaymentOperation(resetForOperation)) {
                resetToNewTransaction();
            }
        };
        adminTapHandler.postDelayed(pendingSuccessResetRunnable, POST_PAYMENT_SUCCESS_MS);
    }

    private boolean isOptimisticallyOccupied(String machineId) {
        if (optimisticOccupiedMachineId == null || machineId == null) {
            return false;
        }
        if (System.currentTimeMillis() - optimisticOccupiedAtMs > OPTIMISTIC_OCCUPIED_MAX_MS) {
            return false;
        }
        return optimisticOccupiedMachineId.equals(machineId);
    }

    private void finishCieloPaymentSession(long operationId, boolean esp32Activated) {
        if (operationId != currentOperationId && operationId != lastSucceededOperationId) {
            return;
        }
        postPaymentHardwarePending = false;
        currentOperationId = -1;
        currentPendingTransactionId = null;
        selectedMachine = null;
        selectedCoffeeProduct = null;
        paymentContextMachine = null;
        paymentLaunchInProgress.set(false);
        awaitingPaymentCallback = false;
        restoreHomeScreen();
        if (esp32Activated && statusMonitor != null) {
            // Poll após ESP32 ligado — evita marcar LIVRE antes do relé responder.
            statusMonitor.requestImmediatePoll();
        }
        Log.d(TAG, "Sessão Cielo encerrada (ESP32=" + esp32Activated + ")");
    }

    private void resetToNewTransaction() {
        cancelPendingSuccessScreen();
        selectedMachine = null;
        selectedCoffeeProduct = null;
        paymentContextMachine = null;
        currentScreen = TotemScreen.HOME;
        currentOperationId = -1;
        lastSucceededOperationId = -1;
        awaitingPaymentCallback = false;
        currentPendingTransactionId = null;
        currentOperationSupabasePaymentMethod = "credit";
        paymentLaunchInProgress.set(false);
        createTotemInterface();
        loadMachines();
        if (statusMonitor != null) {
            statusMonitor.requestImmediatePoll();
        }
    }
    
    private void handlePaymentError(String error) {
        handlePaymentError(error, currentOperationId);
    }

    private void handlePaymentError(String error, long operationId) {
        if (operationId > 0 && operationId != currentOperationId) {
            Log.w(TAG, "Ignorando erro obsoleto (op=" + operationId + ", atual=" + currentOperationId + "): " + error);
            return;
        }
        if (operationId > 0 && operationId == lastSucceededOperationId) {
            Log.w(TAG, "Ignorando erro após sucesso (op=" + operationId + "): " + error);
            return;
        }

        if ("cielo".equalsIgnoreCase(activeProvider)) {
            cieloManager.onTotemCheckoutFinished();
        }
        awaitingPaymentCallback = false;
        paymentLaunchInProgress.set(false);
        cieloLaunchUiActive = false;
        paymentContextMachine = null;
        selectedMachine = null;
        selectedCoffeeProduct = null;
        currentOperationId = -1;
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
        
        setTotemContentView(layout);
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

        if (e.contains("4061") || e.contains("falha de conex") || e.contains("contactar a cielo")) {
            sb.append("\n\n— Conexão Cielo (-4061) —\n");
            sb.append("A maquininha não conseguiu falar com os servidores de pagamento da Cielo. ");
            sb.append("Confira internet (Wi-Fi) e corrija Data e hora automática nas configurações do Android. ");
            sb.append("Relógio desajustado costuma causar este erro após atualização do app.");
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
        
        setTotemContentView(layout);
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

        setTotemContentView(layout);
    }

    /** Configura Cielo (recarrega credenciais do painel a cada pagamento). */
    private void ensureCieloConfigured() {
        if (cieloManager == null) {
            cieloManager = new CieloLioManager(this);
        }
        supabaseHelper.clearSettingsCache();
        String cId = supabaseHelper.getCieloClientId();
        String cToken = supabaseHelper.getCieloAccessToken();
        String cMerchant = supabaseHelper.getCieloMerchantCode();
        String cEnv = supabaseHelper.getCieloEnvironment();
        cieloManager.configure(cId, cToken, cMerchant, cEnv);
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

    private String getCieloPaymentHint(String paymentType) {
        if (!"cielo".equalsIgnoreCase(activeProvider)) {
            return "";
        }
        if (paymentType != null && "pix".equalsIgnoreCase(paymentType.trim())) {
            return "Na Cielo, siga as instruções do PIX.\n\n";
        }
        return "Na Cielo: aproxime, insira ou passe o cartão.\n"
            + "Ignore \"Gerar QR Code\" e \"Digitar Cartão\".\n\n";
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
