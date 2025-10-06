# 📝 CHANGELOG - TOTEM TOP LAVANDERIA

## Versão 2.0.0 (2025-01-23) - TOTEM 100% NATIVO

### ✨ Novas Funcionalidades

#### 🏗️ Arquitetura Nativa
- ✅ `TotemActivity` como activity principal e launcher
- ✅ Modo kiosk ativado (HOME + DEFAULT categories)
- ✅ Orientação landscape forçada (`screenOrientation="landscape"`)
- ✅ Tela sempre ligada (`keepScreenOn="true"`)
- ✅ Configuração otimizada para uso 24/7

#### 💳 Integração PayGO Real
- ✅ Integração completa com PayGO Integrado CERT v4.1.50.5
- ✅ Comunicação direta com PPC930 via USB
- ✅ Detecção automática de dispositivos USB
- ✅ Processamento real de transações
- ✅ Callbacks de status em tempo real
- ✅ Tratamento de erros robusto
- ✅ Suporte a transações pendentes

#### 🔌 Detecção USB PPC930
- ✅ Filtro USB atualizado com múltiplos vendor/product IDs:
  - PPC930: 8137/5169, 1027/24577
  - Positivo L4: 1155/22336
  - Gertec: 11257/2352
- ✅ Intent filters para ATTACHED e DETACHED
- ✅ Suporte a CDC/ACM e dispositivos seriais

#### 🏪 Filtro por Lavanderia
- ✅ Configuração de `laundry_id` via constante ou SharedPreferences
- ✅ Queries Supabase filtradas automaticamente
- ✅ Método `setLaundryId()` para configuração dinâmica
- ✅ Persistência em SharedPreferences
- ✅ Log detalhado de configuração

#### 📊 Integração Supabase Aprimorada
- ✅ Filtro automático por `laundry_id`
- ✅ Carregamento de status ESP32 em tempo real
- ✅ Sincronização de status de máquinas
- ✅ Criação de transações com `laundry_id`
- ✅ Sistema de fallback para dados offline

### 🔧 Melhorias Técnicas

#### Build e Versão
- ✅ `versionCode` incrementado para 2
- ✅ `versionName` atualizado para "2.0.0"
- ✅ `targetSdk` atualizado para 34 (Android 14)
- ✅ Build release otimizado
- ✅ Debug mode configurado

#### AndroidManifest.xml
```xml
<!-- ANTES -->
<activity android:name=".TotemActivity">
    <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
    </intent-filter>
</activity>

<!-- DEPOIS -->
<activity 
    android:name=".TotemActivity"
    android:screenOrientation="landscape"
    android:keepScreenOn="true"
    android:theme="@style/AppTheme.NoActionBar">
    <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
        <category android:name="android.intent.category.HOME" />
        <category android:name="android.intent.category.DEFAULT" />
    </intent-filter>
    <!-- USB filters -->
</activity>
```

#### device_filter.xml
```xml
<!-- ANTES -->
<usb-device vendor-id="11257" product-id="2352" />

<!-- DEPOIS -->
<usb-device vendor-id="8137" product-id="5169" />
<usb-device vendor-id="1027" product-id="24577" />
<usb-device vendor-id="1155" product-id="22336" />
<usb-device vendor-id="11257" product-id="2352" />
<usb-device vendor-id="1105" product-id="32768" />
<usb-device class="2" subclass="2" protocol="1" />
<usb-device class="255" subclass="0" protocol="0" />
```

#### SupabaseHelper.java
```java
// ANTES
String url = SUPABASE_URL + "/rest/v1/machines?select=*&order=name";

// DEPOIS
private static final String DEFAULT_LAUNDRY_ID = "567a7bb6-...";
private String currentLaundryId;

String url = SUPABASE_URL + "/rest/v1/machines?select=*&laundry_id=eq." 
    + currentLaundryId + "&order=name";
```

### 📚 Documentação

#### Novos Arquivos
- ✅ `DEPLOYMENT_TOTEM/README_BUILD_APK.md` - Guia completo de build
- ✅ `DEPLOYMENT_TOTEM/QUICK_START.md` - Início rápido (5 minutos)
- ✅ `DEPLOYMENT_TOTEM/CHANGELOG.md` - Histórico de mudanças

#### Seções do README_BUILD_APK.md
- ✅ Pré-requisitos e ambiente
- ✅ Configuração de lavanderia
- ✅ Build debug e release
- ✅ Assinatura de APK
- ✅ Instalação no tablet
- ✅ Configuração modo kiosk
- ✅ Checklist completo de testes
- ✅ Debug e troubleshooting
- ✅ Logs detalhados
- ✅ Problemas comuns e soluções
- ✅ Distribuição e próximos passos

### 🧪 Testes Implementados

#### Checklist de Testes
- ✅ Testes iniciais (7 itens)
- ✅ Testes de máquinas (6 itens)
- ✅ Testes de PayGO/PPC930 (5 itens)
- ✅ Testes de pagamento real (3 cenários)
- ✅ Testes de integração Supabase (2 queries)

#### Cenários de Teste
1. ✅ Pagamento aprovado
2. ✅ Pagamento recusado
3. ✅ Cancelamento
4. ✅ Transação pendente
5. ✅ Confirmação manual
6. ✅ Queda de conexão

### 🐛 Correções

#### Queries Supabase
- ✅ Corrigido filtro de máquinas por lavanderia
- ✅ Adicionado logs detalhados de requisições
- ✅ Tratamento de erros HTTP aprimorado

#### USB Detection
- ✅ Adicionados múltiplos vendor/product IDs
- ✅ Suporte a classes genéricas de dispositivos
- ✅ Intent filters duplicados removidos

#### Build Configuration
- ✅ Removidas dependências Capacitor comentadas
- ✅ Configurações de packaging otimizadas
- ✅ Lint checks ajustados para release

### 🔒 Segurança

- ✅ ANON_KEY mantida segura
- ✅ RLS policies respeitadas
- ✅ Transações com laundry_id obrigatório
- ✅ SharedPreferences em modo privado

### ⚡ Performance

- ✅ Queries filtradas reduzem carga de rede
- ✅ Status ESP32 carregado em background
- ✅ Fallback para dados offline
- ✅ Threading otimizado para PayGO

### 📦 Distribuição

#### Tamanho do APK
- Debug: ~18 MB
- Release: ~15 MB

#### Compatibilidade
- Android 5.1+ (API 22+)
- Target: Android 14 (API 34)
- Arquitetura: armeabi-v7a, arm64-v8a

### 🔮 Próximas Versões (Roadmap)

#### v2.1.0 (Planejado)
- [ ] Configuração remota via tela oculta
- [ ] Múltiplos idiomas (PT, EN, ES)
- [ ] Modo offline completo
- [ ] Fila de sincronização

#### v2.2.0 (Planejado)
- [ ] Atualização OTA
- [ ] Monitoramento remoto
- [ ] Analytics de uso
- [ ] Alertas push

#### v3.0.0 (Futuro)
- [ ] Suporte a múltiplos métodos de pagamento
- [ ] Interface customizável
- [ ] API de terceiros
- [ ] Dashboard em tempo real

---

## Versão 1.0.0 (2025-01-15) - INICIAL

### ✨ Funcionalidades Iniciais

- ⚫ TotemActivity básico
- ⚫ Listagem de máquinas
- ⚫ Integração Supabase básica
- ⚫ PayGO Manager (mock)

### ⚠️ Limitações v1.0.0

- ❌ Sem filtro por lavanderia
- ❌ PayGO simulado (não real)
- ❌ USB detection limitada
- ❌ Sem modo kiosk
- ❌ Sem documentação completa

---

## 🎯 Comparação de Versões

| Funcionalidade | v1.0.0 | v2.0.0 |
|---------------|--------|--------|
| PayGO Real | ❌ | ✅ |
| Filtro Lavanderia | ❌ | ✅ |
| Modo Kiosk | ❌ | ✅ |
| USB PPC930 | ⚠️ Básico | ✅ Completo |
| Documentação | ⚠️ Parcial | ✅ Completa |
| Testes | ❌ | ✅ Checklist |
| Target SDK | 33 | 34 |
| Status ESP32 | ❌ | ✅ |

---

**Legenda:**
- ✅ Implementado
- ⚠️ Parcial
- ❌ Não implementado
- ⚫ Versão anterior
- 🔮 Planejado
