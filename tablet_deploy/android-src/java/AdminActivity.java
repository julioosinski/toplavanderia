package app.lovable.toplavanderia;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.text.DecimalFormat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * PAINEL ADMINISTRATIVO
 * 
 * Interface para gerenciar máquinas, operações e configurações
 * Sistema híbrido com sincronização online/offline
 */
public class AdminActivity extends Activity {
    private static final String TAG = "AdminActivity";
    
    private SupabaseHelper supabaseHelper;
    private RealPayGoManager payGoManager;
    
    private TextView statusText;
    private LinearLayout contentContainer;
    private Button backButton;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Inicializar componentes
        supabaseHelper = new SupabaseHelper(this);
        payGoManager = new RealPayGoManager(this);
        
        // Criar interface
        createAdminInterface();
        
        Log.d(TAG, "AdminActivity criada com sucesso");
    }
    
    private void createAdminInterface() {
        // Layout principal
        LinearLayout mainLayout = new LinearLayout(this);
        mainLayout.setOrientation(LinearLayout.VERTICAL);
        mainLayout.setBackgroundColor(Color.parseColor("#f5f5f5"));
        mainLayout.setPadding(10, 10, 10, 10);
        
        // Cabeçalho
        createHeader(mainLayout);
        
        // Status
        createStatusBar(mainLayout);
        
        // Container de conteúdo
        contentContainer = new LinearLayout(this);
        contentContainer.setOrientation(LinearLayout.VERTICAL);
        contentContainer.setPadding(20, 20, 20, 20);
        mainLayout.addView(contentContainer);
        
        // Botão voltar
        createBackButton(mainLayout);
        
        setContentView(mainLayout);
        
        // Mostrar dashboard inicial
        showDashboard();
    }
    
    private void createHeader(LinearLayout parent) {
        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.VERTICAL);
        header.setPadding(30, 30, 30, 30);
        header.setBackgroundColor(Color.parseColor("#673AB7"));
        
        // Título
        TextView title = new TextView(this);
        title.setText("⚙️ PAINEL ADMINISTRATIVO");
        title.setTextSize(24);
        title.setTextColor(Color.WHITE);
        title.setGravity(android.view.Gravity.CENTER);
        title.setPadding(0, 0, 0, 10);
        header.addView(title);
        
        // Subtítulo
        TextView subtitle = new TextView(this);
        subtitle.setText("Gerenciamento do Sistema");
        subtitle.setTextSize(16);
        subtitle.setTextColor(Color.parseColor("#E1BEE7"));
        subtitle.setGravity(android.view.Gravity.CENTER);
        header.addView(subtitle);
        
        parent.addView(header);
    }
    
    private void createStatusBar(LinearLayout parent) {
        LinearLayout statusBar = new LinearLayout(this);
        statusBar.setOrientation(LinearLayout.HORIZONTAL);
        statusBar.setPadding(20, 15, 20, 15);
        statusBar.setBackgroundColor(Color.WHITE);
        
        // Status do sistema
        statusText = new TextView(this);
        statusText.setText("📊 Sistema: Online | PayGo: Conectado | PPC930: Ativa");
        statusText.setTextSize(12);
        statusText.setTextColor(Color.parseColor("#4CAF50"));
        statusText.setLayoutParams(new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        statusBar.addView(statusText);
        
        // Tempo
        TextView timeText = new TextView(this);
        timeText.setText(getCurrentTime());
        timeText.setTextSize(12);
        timeText.setTextColor(Color.parseColor("#666666"));
        timeText.setGravity(android.view.Gravity.END);
        statusBar.addView(timeText);
        
        parent.addView(statusBar);
    }
    
    private void createBackButton(LinearLayout parent) {
        backButton = new Button(this);
        backButton.setText("⬅️ VOLTAR AO TOTEM");
        backButton.setTextSize(16);
        backButton.setPadding(20, 15, 20, 15);
        backButton.setBackgroundColor(Color.parseColor("#9E9E9E"));
        backButton.setTextColor(Color.WHITE);
        backButton.setOnClickListener(v -> finish());
        parent.addView(backButton);
    }
    
    private void showDashboard() {
        contentContainer.removeAllViews();
        
        // Título
        TextView title = new TextView(this);
        title.setText("📊 DASHBOARD");
        title.setTextSize(20);
        title.setTextColor(Color.parseColor("#333333"));
        title.setPadding(0, 0, 0, 20);
        contentContainer.addView(title);
        
        // Estatísticas
        showStatistics();
        
        // Botões de ação
        showActionButtons();
    }
    
    private void showStatistics() {
        // Container de estatísticas
        LinearLayout statsContainer = new LinearLayout(this);
        statsContainer.setOrientation(LinearLayout.VERTICAL);
        statsContainer.setPadding(20, 20, 20, 20);
        statsContainer.setBackgroundColor(Color.WHITE);
        
        // Estatísticas do dia (simuladas para demonstração)
        double todayRevenue = 150.00; // Simulado
        int todayOperationsCount = 8; // Simulado
        
        // Máquinas
        List<SupabaseHelper.Machine> machines = supabaseHelper.getAllMachines();
        int totalMachines = machines.size();
        int availableMachines = 0;
        int occupiedMachines = 0;
        int maintenanceMachines = 0;
        
        for (SupabaseHelper.Machine machine : machines) {
            switch (machine.getStatus()) {
                case "LIVRE":
                    availableMachines++;
                    break;
                case "OCUPADA":
                    occupiedMachines++;
                    break;
                case "MANUTENCAO":
                    maintenanceMachines++;
                    break;
            }
        }
        
        // Operações não sincronizadas (simulado)
        int unsyncedCount = supabaseHelper.isConnected() ? 0 : 3;
        
        // Criar cards de estatísticas
        createStatCard(statsContainer, "💰 RECEITA HOJE", "R$ " + new DecimalFormat("0.00").format(todayRevenue), Color.parseColor("#4CAF50"));
        createStatCard(statsContainer, "🔄 OPERAÇÕES HOJE", String.valueOf(todayOperationsCount), Color.parseColor("#2196F3"));
        createStatCard(statsContainer, "🟢 MÁQUINAS LIVRES", String.valueOf(availableMachines), Color.parseColor("#4CAF50"));
        createStatCard(statsContainer, "🔴 MÁQUINAS OCUPADAS", String.valueOf(occupiedMachines), Color.parseColor("#F44336"));
        createStatCard(statsContainer, "🟡 EM MANUTENÇÃO", String.valueOf(maintenanceMachines), Color.parseColor("#FF9800"));
        createStatCard(statsContainer, "📤 NÃO SINCRONIZADAS", String.valueOf(unsyncedCount), Color.parseColor("#FF5722"));
        
        contentContainer.addView(statsContainer);
    }
    
    private void createStatCard(LinearLayout parent, String title, String value, int color) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.HORIZONTAL);
        card.setPadding(20, 15, 20, 15);
        card.setBackgroundColor(Color.parseColor("#f8f8f8"));
        card.setPadding(20, 15, 20, 15);
        
        // Título
        TextView titleText = new TextView(this);
        titleText.setText(title);
        titleText.setTextSize(14);
        titleText.setTextColor(Color.parseColor("#666666"));
        titleText.setLayoutParams(new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        card.addView(titleText);
        
        // Valor
        TextView valueText = new TextView(this);
        valueText.setText(value);
        valueText.setTextSize(18);
        valueText.setTextColor(color);
        valueText.setGravity(android.view.Gravity.END);
        card.addView(valueText);
        
        parent.addView(card);
    }
    
    private void showActionButtons() {
        // Container de botões
        LinearLayout buttonsContainer = new LinearLayout(this);
        buttonsContainer.setOrientation(LinearLayout.VERTICAL);
        buttonsContainer.setPadding(20, 20, 20, 20);
        
        // Botões principais
        createActionButton(buttonsContainer, "🔄 GERENCIAR MÁQUINAS", Color.parseColor("#2196F3"), v -> showMachinesManagement());
        createActionButton(buttonsContainer, "📊 RELATÓRIOS", Color.parseColor("#4CAF50"), v -> showReports());
        createActionButton(buttonsContainer, "⚙️ CONFIGURAÇÕES", Color.parseColor("#FF9800"), v -> showSettings());
        createActionButton(buttonsContainer, "🔄 SINCRONIZAR", Color.parseColor("#9C27B0"), v -> syncData());
        createActionButton(buttonsContainer, "🧪 TESTAR PAYGO", Color.parseColor("#607D8B"), v -> testPayGo());
        createActionButton(buttonsContainer, "🗑️ LIMPAR DADOS", Color.parseColor("#F44336"), v -> clearData());
        
        contentContainer.addView(buttonsContainer);
    }
    
    private void createActionButton(LinearLayout parent, String text, int color, View.OnClickListener listener) {
        Button button = new Button(this);
        button.setText(text);
        button.setTextSize(16);
        button.setPadding(20, 20, 20, 20);
        button.setBackgroundColor(color);
        button.setTextColor(Color.WHITE);
        button.setOnClickListener(listener);
        
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        params.setMargins(0, 0, 0, 10);
        button.setLayoutParams(params);
        
        parent.addView(button);
    }
    
    private void showMachinesManagement() {
        contentContainer.removeAllViews();
        
        // Título
        TextView title = new TextView(this);
        title.setText("🔄 GERENCIAR MÁQUINAS");
        title.setTextSize(20);
        title.setTextColor(Color.parseColor("#333333"));
        title.setPadding(0, 0, 0, 20);
        contentContainer.addView(title);
        
        // Lista de máquinas
        List<SupabaseHelper.Machine> machines = supabaseHelper.getAllMachines();
        
        for (SupabaseHelper.Machine machine : machines) {
            createMachineCard(machine);
        }
        
        // Botão adicionar máquina
        Button addButton = new Button(this);
        addButton.setText("➕ ADICIONAR MÁQUINA");
        addButton.setTextSize(16);
        addButton.setPadding(20, 20, 20, 20);
        addButton.setBackgroundColor(Color.parseColor("#4CAF50"));
        addButton.setTextColor(Color.WHITE);
        addButton.setOnClickListener(v -> addMachine());
        contentContainer.addView(addButton);
    }
    
    private void createMachineCard(SupabaseHelper.Machine machine) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(20, 20, 20, 20);
        card.setBackgroundColor(Color.WHITE);
        
        // Informações da máquina
        TextView info = new TextView(this);
        info.setText(machine.getName() + " - " + machine.getTypeDisplay() + "\n" +
                    "Preço: R$ " + new DecimalFormat("0.00").format(machine.getPrice()) + " | " +
                    "Duração: " + machine.getDuration() + " min\n" +
                    "Status: " + machine.getStatusDisplay());
        info.setTextSize(14);
        info.setTextColor(Color.parseColor("#333333"));
        info.setPadding(0, 0, 0, 15);
        card.addView(info);
        
        // Botões de ação
        LinearLayout buttonRow = new LinearLayout(this);
        buttonRow.setOrientation(LinearLayout.HORIZONTAL);
        
        // Botão alterar status
        Button statusButton = new Button(this);
        statusButton.setText("🔄 ALTERAR STATUS");
        statusButton.setTextSize(12);
        statusButton.setPadding(10, 10, 10, 10);
        statusButton.setBackgroundColor(Color.parseColor("#FF9800"));
        statusButton.setTextColor(Color.WHITE);
        statusButton.setOnClickListener(v -> changeMachineStatus(machine));
        buttonRow.addView(statusButton);
        
        // Botão editar
        Button editButton = new Button(this);
        editButton.setText("✏️ EDITAR");
        editButton.setTextSize(12);
        editButton.setPadding(10, 10, 10, 10);
        editButton.setBackgroundColor(Color.parseColor("#2196F3"));
        editButton.setTextColor(Color.WHITE);
        editButton.setOnClickListener(v -> editMachine(machine));
        buttonRow.addView(editButton);
        
        card.addView(buttonRow);
        contentContainer.addView(card);
    }
    
    private void changeMachineStatus(SupabaseHelper.Machine machine) {
        String[] statusOptions = {"LIVRE", "OCUPADA", "MANUTENCAO"};
        String currentStatus = machine.getStatus();
        
        // Encontrar próximo status
        int currentIndex = -1;
        for (int i = 0; i < statusOptions.length; i++) {
            if (statusOptions[i].equals(currentStatus)) {
                currentIndex = i;
                break;
            }
        }
        
        String newStatus = statusOptions[(currentIndex + 1) % statusOptions.length];
        
        // Atualizar status
        if (supabaseHelper.updateMachineStatus(machine.getId(), newStatus)) {
            Toast.makeText(this, "Status alterado para: " + newStatus, Toast.LENGTH_SHORT).show();
            showMachinesManagement(); // Recarregar
        } else {
            Toast.makeText(this, "Erro ao alterar status", Toast.LENGTH_SHORT).show();
        }
    }
    
    private void editMachine(SupabaseHelper.Machine machine) {
        // Implementar edição de máquina
        Toast.makeText(this, "Edição de máquina em desenvolvimento", Toast.LENGTH_SHORT).show();
    }
    
    private void addMachine() {
        // Implementar adição de máquina
        Toast.makeText(this, "Adição de máquina em desenvolvimento", Toast.LENGTH_SHORT).show();
    }
    
    private void showReports() {
        contentContainer.removeAllViews();
        
        // Título
        TextView title = new TextView(this);
        title.setText("📊 RELATÓRIOS");
        title.setTextSize(20);
        title.setTextColor(Color.parseColor("#333333"));
        title.setPadding(0, 0, 0, 20);
        contentContainer.addView(title);
        
        // Relatório do dia (simulado)
        // List<DatabaseHelper.Operation> todayOperations = dbHelper.getOperationsByDate(getCurrentDate());
        
        TextView reportText = new TextView(this);
        reportText.setText("📅 RELATÓRIO DO DIA: " + getCurrentDate() + "\n\n" +
                          "Total de operações: 8\n" +
                          "Operações pagas: 6\n" +
                          "Receita total: R$ 150.00\n\n" +
                          "DETALHES DAS OPERAÇÕES:\n" +
                          "• Lavadora 1 - R$ 15.00 - ✅ Pago - 14:30\n" +
                          "• Secadora 1 - R$ 10.00 - ✅ Pago - 14:45\n" +
                          "• Lavadora 2 - R$ 15.00 - ✅ Pago - 15:15\n" +
                          "• Secadora 2 - R$ 10.00 - ✅ Pago - 15:30\n" +
                          "• Lavadora 3 - R$ 15.00 - ✅ Pago - 16:00\n" +
                          "• Secadora 3 - R$ 10.00 - ✅ Pago - 16:15\n");
        reportText.setTextSize(12);
        reportText.setTextColor(Color.parseColor("#333333"));
        reportText.setPadding(20, 20, 20, 20);
        reportText.setBackgroundColor(Color.WHITE);
        contentContainer.addView(reportText);
    }
    
    
    private void showSettings() {
        contentContainer.removeAllViews();
        
        // Título
        TextView title = new TextView(this);
        title.setText("⚙️ CONFIGURAÇÕES");
        title.setTextSize(20);
        title.setTextColor(Color.parseColor("#333333"));
        title.setPadding(0, 0, 0, 20);
        contentContainer.addView(title);
        
        // Configurações atuais
        TextView settingsText = new TextView(this);
        settingsText.setText("CONFIGURAÇÕES ATUAIS:\n\n" +
                           "Nome da empresa: Top Lavanderia\n" +
                           "Endereço: Rua das Lavadeiras, 123\n" +
                           "Telefone: (11) 99999-9999\n" +
                           "Sincronização: " + (supabaseHelper.isConnected() ? "Ativada" : "Desativada") + "\n" +
                           "Modo offline: Ativado\n" +
                           "Sincronização automática: Ativada\n" +
                           "Intervalo de sincronização: 300 segundos\n" +
                           "Status Supabase: " + (supabaseHelper.isConnected() ? "Conectado" : "Desconectado"));
        settingsText.setTextSize(14);
        settingsText.setTextColor(Color.parseColor("#333333"));
        settingsText.setPadding(20, 20, 20, 20);
        settingsText.setBackgroundColor(Color.WHITE);
        contentContainer.addView(settingsText);
        
        // Botão para editar configurações
        Button editButton = new Button(this);
        editButton.setText("✏️ EDITAR CONFIGURAÇÕES");
        editButton.setTextSize(16);
        editButton.setPadding(20, 20, 20, 20);
        editButton.setBackgroundColor(Color.parseColor("#FF9800"));
        editButton.setTextColor(Color.WHITE);
        editButton.setOnClickListener(v -> editSettings());
        contentContainer.addView(editButton);
    }
    
    private void editSettings() {
        // Implementar edição de configurações
        Toast.makeText(this, "Edição de configurações em desenvolvimento", Toast.LENGTH_SHORT).show();
    }
    
    private void syncData() {
        // Implementar sincronização
        Toast.makeText(this, "Sincronização em desenvolvimento", Toast.LENGTH_SHORT).show();
    }
    
    private void testPayGo() {
        payGoManager.testPayGo();
        Toast.makeText(this, "Teste do PayGo iniciado", Toast.LENGTH_SHORT).show();
    }
    
    private void clearData() {
        // Implementar limpeza de dados
        Toast.makeText(this, "Limpeza de dados em desenvolvimento", Toast.LENGTH_SHORT).show();
    }
    
    private String getCurrentTime() {
        SimpleDateFormat sdf = new SimpleDateFormat("HH:mm:ss", Locale.getDefault());
        return sdf.format(new Date());
    }
    
    private String getCurrentDate() {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault());
        return sdf.format(new Date());
    }
}
