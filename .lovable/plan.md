

# Análise Completa do Sistema — O que Falta para 100% Funcional

## Estado Atual do Sistema

O sistema tem uma arquitetura sólida com frontend React (totem), backend Supabase, comunicação ESP32 via pull model, e integração PayGO nativa. Porém há gaps críticos entre o código e a operação real.

---

## 1. BLOQUEADORES CRÍTICOS (sistema não funciona sem isso)

### 1.1. APK Desatualizado no Tablet
Todas as melhorias recentes (CNPJ setup, cache offline, refatoração, diagnósticos) existem apenas no código web. O tablet roda um APK antigo. **Ação necessária:**
```text
npm run build
npx cap sync android
cd android && ./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```

### 1.2. ESP32s Offline
Os dois ESP32 registrados (`lavadora_01` e `lavadora_02`) estão **offline desde outubro 2025** (último heartbeat: 12/10/2025). Sem ESP32 online, as máquinas não podem ser ativadas fisicamente após pagamento.

**Ação necessária:**
- Verificar se os ESP32 estão ligados e conectados à rede Wi-Fi `2G Osinski`
- Confirmar que o firmware v3.0.0 está fazendo polling para `esp32-monitor?action=poll_commands` a cada 5 segundos
- Verificar se os IPs `192.168.0.11` e `192.168.0.21` ainda são válidos

### 1.3. PayGO Não Configurado
No banco de dados, as configurações PayGO estão zeradas:
- `paygo_enabled: false`
- `paygo_host: null`
- `paygo_automation_key: null`
- `paygo_cnpj_cpf: null`

**Sem estas configurações, nenhum pagamento por cartão funciona.** Ação necessária no painel admin:
- Habilitar PayGO (`paygo_enabled: true`)
- Configurar `paygo_host` com o IP do terminal/pinpad na rede local
- Configurar `paygo_automation_key` (chave fornecida pela PayGO)
- Configurar `paygo_cnpj_cpf` com o CNPJ da empresa

### 1.4. Máquinas sem ESP32 Correspondente
Existem 10 máquinas cadastradas para TOP LAVANDERIA SINUELO, mas apenas 2 ESP32s registrados (`lavadora_01` e `lavadora_02`). As máquinas `lavadora_03`, `lavadora_04`, `lavadora_05`, `secadora_01` a `secadora_05` não têm ESP32 registrado na tabela `esp32_status`, o que significa que não podem receber comandos de ativação.

---

## 2. CONFIGURAÇÕES NECESSÁRIAS PARA INTEGRAÇÃO COM MAQUININHA

### 2.1. Hardware Necessário
- **Pinpad PPC930** conectado ao tablet via USB
- **Biblioteca PayGO** (`InterfaceAutomacao-v2.1.0.6.aar`) já incluída no projeto Android
- **MainActivity.java** com `RealPayGoManager` configurado (já existe no código nativo)

### 2.2. Configuração no Painel Admin (system_settings)
Acessar o painel admin e configurar:

| Campo | Valor Necessário | Descrição |
|---|---|---|
| `paygo_enabled` | `true` | Ativar integração |
| `paygo_host` | IP do pinpad (ex: `127.0.0.1`) | Para Smart POS, usar localhost |
| `paygo_port` | `8080` ou porta configurada | Porta de comunicação |
| `paygo_automation_key` | Chave da PayGO | Fornecida pela credenciadora |
| `paygo_cnpj_cpf` | `43652666000137` | CNPJ da TOP LAVANDERIA |

### 2.3. Credenciamento PayGO
Antes de processar pagamentos reais:
1. Contatar a PayGO para obter credenciamento
2. Receber a `automation_key` de produção
3. Configurar o terminal para o CNPJ da empresa
4. Realizar transações de teste (R$ 0,01) para homologação

---

## 3. GAPS NO CÓDIGO (problemas que precisam ser corrigidos)

### 3.1. Fluxo de Pagamento Incompleto
No `Totem.tsx` linha 247, após pagamento bem-sucedido, `activateMachine` é chamada mas o `paymentStep` nunca muda para `"success"`. O fluxo para em `onSuccess` sem feedback visual ao cliente.

**Correção:** Após `activateMachine`, setar `setPaymentStep("success")` e `setTransactionData(result.data)`.

### 3.2. system_settings sem Acesso Público (RLS)
A tabela `system_settings` exige autenticação (`is_super_admin` ou role-based). O totem opera sem login, então **não consegue carregar** `paygo_host`, `paygo_automation_key`, etc. O `useSystemSettings` vai falhar silenciosamente.

**Correção:** Adicionar uma política RLS pública de SELECT para `system_settings` (somente campos não-sensíveis), ou criar uma edge function que retorne as configs necessárias.

### 3.3. Transação Criada como "completed" Antes da Ativação
Na `activateMachine` (linha 125-134), a transação é inserida com `status: 'completed'` e `completed_at` preenchido **antes** de confirmar que o ESP32 executou o comando. Se o ESP32 falhar, a transação fica registrada como concluída mas a máquina nunca ligou.

**Correção:** Inserir com `status: 'pending'`, atualizar para `'completed'` apenas após confirmação do ESP32 via `confirm_command`.

### 3.4. PIN Admin — Hash Correto?
O `admin_config` tem um `pin_hash` usando bcrypt. O `validate_admin_pin` faz `crypt(_pin, stored_hash)`. Verifique se o PIN que você quer usar corresponde ao hash armazenado. Para redefinir:
```sql
UPDATE admin_config SET pin_hash = crypt('SEU_NOVO_PIN', gen_salt('bf'));
```

---

## 4. CHECKLIST PARA OPERAÇÃO 100%

### Hardware
- [ ] ESP32 de cada máquina ligado e online (firmware v3.0.0, polling a cada 5s)
- [ ] Pinpad PPC930 conectado ao tablet via USB
- [ ] Tablet com APK atualizado instalado
- [ ] Rede Wi-Fi estável (`2G Osinski`, senha `10203040`)

### Supabase (Banco de Dados)
- [ ] ESP32s registrados para todas as 10 máquinas (faltam 8)
- [ ] `paygo_enabled = true` nas system_settings
- [ ] `paygo_host`, `paygo_automation_key`, `paygo_cnpj_cpf` preenchidos
- [ ] RLS de `system_settings` permitindo leitura pública (ou edge function)
- [ ] PIN admin configurado corretamente no `admin_config`

### PayGO / Maquininha
- [ ] Credenciamento ativo com a PayGO
- [ ] `automation_key` de produção obtida
- [ ] Terminal homologado para o CNPJ `43652666000137`
- [ ] Teste de transação R$ 0,01 aprovado

### Código (correções necessárias)
- [ ] Corrigir fluxo de sucesso no pagamento (setar `paymentStep = "success"`)
- [ ] Corrigir status da transação (inserir como `pending`, não `completed`)
- [ ] Resolver acesso do totem às `system_settings` (RLS ou edge function)
- [ ] Recompilar e instalar APK no tablet

---

## 5. RESUMO POR PRIORIDADE

| Prioridade | Item | Esforço |
|---|---|---|
| URGENTE | Recompilar e instalar APK | 10 min |
| URGENTE | Ligar e conectar ESP32s | Hardware |
| URGENTE | Configurar PayGO no banco | 5 min |
| ALTA | Corrigir RLS de system_settings para totem | 1 correção SQL |
| ALTA | Corrigir fluxo de pagamento (success + pending) | 2 edições no código |
| ALTA | Registrar ESP32s faltantes no banco | 8 inserts |
| MÉDIA | Obter credenciamento PayGO | Processo externo |
| MÉDIA | Testar transação real com pinpad | Teste físico |

Posso implementar todas as correções de código (itens 3.1, 3.2, 3.3) agora se você aprovar. As configurações de hardware e credenciamento da PayGO são ações externas que você precisa fazer manualmente.

