# CHANGELOG v2.1 - Configuração por CNPJ

## Data: 2025-10-06

## 🎯 OBJETIVO

Implementar sistema de configuração dinâmica do totem usando CNPJ da lavanderia, permitindo que:
- O totem seja configurado inicialmente com o CNPJ da lavanderia
- O sistema busque automaticamente os dados da lavanderia no Supabase
- O nome da lavanderia apareça no topo do totem
- Apenas as máquinas daquela lavanderia sejam exibidas
- O status real (online/offline/ocupada) seja mostrado corretamente

---

## 📋 ALTERAÇÕES IMPLEMENTADAS

### 1. SupabaseHelper.java

#### 1.1. Configuração por CNPJ
**Antes:**
```java
private static final String DEFAULT_LAUNDRY_ID = "567a7bb6-8d26-4d9c-bbe3-f8dcc28e7569";
private String currentLaundryId;
```

**Depois:**
```java
private static final String PREFS_NAME = "totem_config";
private static final String PREF_LAUNDRY_CNPJ = "laundry_cnpj";
private static final String PREF_LAUNDRY_ID = "laundry_id";
private static final String PREF_LAUNDRY_NAME = "laundry_name";

private String currentLaundryId;
private String currentLaundryCNPJ;
private String currentLaundryName;
```

#### 1.2. Novos Métodos Implementados

##### `configureLaundryByCNPJ(String cnpj)`
Busca a lavanderia no Supabase usando o CNPJ e salva as configurações localmente.

```java
public boolean configureLaundryByCNPJ(String cnpj) {
    Laundry laundry = fetchLaundryByCNPJ(cnpj);
    
    if (laundry != null) {
        this.currentLaundryCNPJ = cnpj;
        this.currentLaundryId = laundry.getId();
        this.currentLaundryName = laundry.getName();
        
        // Salvar nas preferências
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putString(PREF_LAUNDRY_CNPJ, cnpj)
            .putString(PREF_LAUNDRY_ID, laundry.getId())
            .putString(PREF_LAUNDRY_NAME, laundry.getName())
            .apply();
        
        return true;
    }
    return false;
}
```

##### `fetchLaundryByCNPJ(String cnpj)`
Faz a requisição HTTP para o Supabase buscando a lavanderia ativa com o CNPJ fornecido.

**Endpoint usado:**
```
GET /rest/v1/laundries?select=*&cnpj=eq.{cnpj}&is_active=eq.true
```

##### `isConfigured()`
Verifica se o totem já foi configurado (tem CNPJ e ID salvos).

##### `getLaundryCNPJ()`, `getLaundryId()`, `getLaundryName()`
Retornam as informações da lavanderia configurada.

#### 1.3. Nova Classe: Laundry

```java
public static class Laundry {
    private String id;
    private String cnpj;
    private String name;
    private String address;
    private String city;
    private String state;
    
    // Getters e Setters
}
```

#### 1.4. Validação na Busca de Máquinas

**Antes:**
```java
String url = SUPABASE_URL + "/rest/v1/machines?select=*&laundry_id=eq." + currentLaundryId;
```

**Depois:**
```java
if (currentLaundryId == null) {
    Log.e(TAG, "❌ Lavanderia não configurada - não é possível buscar máquinas");
    return getDefaultMachines();
}

String url = SUPABASE_URL + "/rest/v1/machines?select=*&laundry_id=eq." + currentLaundryId;
```

---

### 2. TotemActivity.java

#### 2.1. Verificação de Configuração no onCreate

**Antes:**
```java
protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    
    supabaseHelper = new SupabaseHelper(this);
    // ... restante do código
}
```

**Depois:**
```java
protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    
    supabaseHelper = new SupabaseHelper(this);
    
    // Verificar se totem está configurado
    if (!supabaseHelper.isConfigured()) {
        Log.d(TAG, "Totem não configurado - exibindo tela de configuração");
        showConfigurationScreen();
        return;
    }
    
    // ... restante do código
}
```

#### 2.2. Título Dinâmico com Nome da Lavanderia

**Antes:**
```java
TextView titleText = new TextView(this);
titleText.setText("🧺 TOP LAVANDERIA");
```

**Depois:**
```java
TextView titleText = new TextView(this);
String laundryName = supabaseHelper.getLaundryName();
titleText.setText("🧺 " + laundryName.toUpperCase());
```

#### 2.3. Nova Tela de Configuração Inicial

Método `showConfigurationScreen()` implementado com:

**Interface:**
- Logo e título "🧺 CONFIGURAÇÃO INICIAL"
- Campo de entrada para CNPJ (14 dígitos)
- Instruções claras
- Validação de entrada
- Feedback visual de sucesso/erro
- Loading durante a configuração

**Fluxo:**
1. Usuário digita o CNPJ (sem pontuação)
2. Validação: deve ter exatamente 14 dígitos
3. Busca no Supabase em background
4. Se encontrado: salva e recarrega a activity
5. Se não encontrado: exibe erro e permite tentar novamente

**Código da tela:**
```java
private void showConfigurationScreen() {
    LinearLayout layout = new LinearLayout(this);
    layout.setOrientation(LinearLayout.VERTICAL);
    layout.setBackgroundColor(Color.parseColor("#0D1117"));
    
    // Campo de CNPJ
    EditText cnpjInput = new EditText(this);
    cnpjInput.setHint("00000000000000");
    cnpjInput.setInputType(InputType.TYPE_CLASS_NUMBER);
    
    // Botão de confirmar
    Button confirmButton = new Button(this);
    confirmButton.setText("✅ CONFIGURAR");
    confirmButton.setOnClickListener(v -> {
        String cnpj = cnpjInput.getText().toString().trim();
        
        // Validação
        if (cnpj.length() != 14) {
            // Mostrar erro
            return;
        }
        
        // Configurar em background
        new Thread(() -> {
            boolean success = supabaseHelper.configureLaundryByCNPJ(cnpj);
            
            runOnUiThread(() -> {
                if (success) {
                    // Recarregar activity
                    recreate();
                } else {
                    // Mostrar erro
                }
            });
        }).start();
    });
    
    setContentView(layout);
}
```

---

## 🎨 STATUS DAS MÁQUINAS

O sistema já mostra corretamente os status:

### Status Disponíveis:
1. **🟢 DISPONÍVEL** (verde `#238636`)
   - Máquina livre
   - ESP32 online
   - Botão habilitado

2. **🟡 OCUPADA** (amarelo `#D29922`)
   - Máquina em uso
   - ESP32 online
   - Botão desabilitado

3. **🟡 MANUTENÇÃO** (laranja `#FF9800`)
   - Máquina em manutenção
   - ESP32 online
   - Botão desabilitado

4. **🔴 OFFLINE** (cinza `#21262D`)
   - ESP32 desconectado
   - Botão desabilitado
   - Texto cinza

### Lógica de Status:
```java
boolean isOnline = machine.isEsp32Online();
String status = machine.getStatus();
boolean isAvailable = isOnline && "LIVRE".equals(status);
```

---

## 📦 DADOS PERSISTIDOS (SharedPreferences)

O sistema salva localmente:

```
totem_config:
  - laundry_cnpj: "00000000000000"
  - laundry_id: "uuid-da-lavanderia"
  - laundry_name: "Nome da Lavanderia"
```

**Localização:** `SharedPreferences` do app Android
**Persistência:** Mantém-se mesmo após reiniciar o app

---

## 🔄 FLUXO COMPLETO

### Primeira Instalação:
1. Abrir app → Tela de configuração
2. Digitar CNPJ → Validar
3. Buscar no Supabase → Salvar dados
4. Recarregar app → Totem funcional

### Uso Normal:
1. Abrir app → Carregar configuração salva
2. Mostrar nome da lavanderia no topo
3. Buscar máquinas da lavanderia no Supabase
4. Exibir apenas máquinas desta lavanderia
5. Mostrar status real (online/offline/ocupada)

---

## 🔧 INTEGRAÇÃO COM PAINEL ADMIN

### No Painel Web (React):

Os administradores já podem:
1. Cadastrar lavanderias com CNPJ
2. Adicionar/editar máquinas
3. Associar máquinas à lavanderia
4. Ver transações filtradas por lavanderia

### Tabelas Usadas:

#### `laundries`
```sql
SELECT id, cnpj, name, address, city, state, is_active
FROM laundries
WHERE cnpj = '00000000000000' AND is_active = true
```

#### `machines`
```sql
SELECT *
FROM machines
WHERE laundry_id = 'uuid-da-lavanderia'
ORDER BY name
```

#### `esp32_status`
```sql
SELECT esp32_id, status_da_rede, last_seen
FROM esp32_status
```

---

## ✅ CHECKLIST DE TESTES

### Configuração Inicial:
- [ ] Tela de configuração aparece na primeira abertura
- [ ] Validação de CNPJ (14 dígitos)
- [ ] Mensagem de erro para CNPJ inválido
- [ ] Mensagem de erro para CNPJ não encontrado
- [ ] Mensagem de sucesso com nome da lavanderia
- [ ] App recarrega automaticamente após configuração

### Operação Normal:
- [ ] Nome da lavanderia aparece no topo
- [ ] Apenas máquinas da lavanderia são exibidas
- [ ] Status "🟢 DISPONÍVEL" para máquinas livres e online
- [ ] Status "🟡 OCUPADA" para máquinas em uso
- [ ] Status "🔴 OFFLINE" para máquinas com ESP32 desconectado
- [ ] Filtragem por tipo (Lavadoras / Secadoras)

### Persistência:
- [ ] Configuração mantém-se após reiniciar app
- [ ] Configuração mantém-se após reiniciar tablet
- [ ] Não pede CNPJ novamente após configurado

---

## 🚀 PRÓXIMOS PASSOS

### Recomendações:

1. **Reconfiguração Remota:**
   - Adicionar opção de reconfigurar CNPJ (7 toques no logo)
   - Limpar configurações antigas

2. **Sincronização:**
   - Atualizar automaticamente se dados da lavanderia mudarem
   - Implementar refresh periódico

3. **Validação:**
   - Adicionar máscara de CNPJ (00.000.000/0000-00)
   - Validar dígitos verificadores

4. **Monitoramento:**
   - Enviar heartbeat com identificação da lavanderia
   - Logs de configuração para suporte remoto

---

## 📝 NOTAS IMPORTANTES

1. **CNPJ deve estar cadastrado:** O CNPJ digitado deve existir na tabela `laundries` e estar com `is_active = true`

2. **Máquinas devem ter laundry_id:** Todas as máquinas devem ter o campo `laundry_id` preenchido

3. **ESP32 status:** O status das máquinas depende da tabela `esp32_status` estar atualizada

4. **Sem CNPJ configurado:** App não funciona até CNPJ ser configurado

---

## 🐛 TROUBLESHOOTING

### Problema: "CNPJ não encontrado"
**Solução:** Verificar no painel admin se:
- Lavanderia existe na tabela `laundries`
- Campo `cnpj` está preenchido corretamente
- Campo `is_active` está como `true`

### Problema: "Nenhuma máquina aparece"
**Solução:** Verificar no painel admin se:
- Máquinas existem na tabela `machines`
- Campo `laundry_id` está preenchido
- `laundry_id` corresponde ao ID da lavanderia

### Problema: "Todas máquinas offline"
**Solução:** Verificar:
- ESP32s estão conectados
- Tabela `esp32_status` está sendo atualizada
- Campo `status_da_rede` está como "online" ou "conectado"

---

## 📚 DOCUMENTAÇÃO RELACIONADA

- [README_BUILD_APK.md](./README_BUILD_APK.md) - Guia completo de build
- [QUICK_START.md](./QUICK_START.md) - Início rápido
- [CHANGELOG.md](./CHANGELOG.md) - Histórico de versões anteriores
