# 🌐 GUIA DE ACESSO - APLICATIVO WEB E TABLET

## 📱 **ACESSO AO APLICATIVO WEB**

### **1. URL do Aplicativo Web**
```
https://rkdybjzwiwwqqzjfmerm.supabase.co
```

### **2. Acesso via Navegador**
1. **Abra o navegador** no computador ou tablet
2. **Digite a URL**: `https://rkdybjzwiwwqqzjfmerm.supabase.co`
3. **Faça login** com suas credenciais
4. **Acesse o painel administrativo** para gerenciar máquinas

### **3. Configuração do Supabase**
- **URL**: `https://rkdybjzwiwwqqzjfmerm.supabase.co`
- **Chave Anônima**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZHlianp3aXd3cXF6amZtZXJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMDgxNjcsImV4cCI6MjA2ODg4NDE2N30.CnRP8lrmGmvcbHmWdy72ZWlfZ28cDdNoxdADnyFAOXg`

---

## 🏪 **CONFIGURAÇÃO DO TABLET**

### **1. Verificar Conectividade WiFi**
1. **Abra as configurações** do tablet
2. **Vá em WiFi** e verifique se está conectado
3. **Teste a internet** abrindo um navegador
4. **Verifique se consegue acessar** o aplicativo web

### **2. Testar o Aplicativo Android**
1. **Abra o app** "Top Lavanderia" no tablet
2. **Aguarde carregar** as máquinas
3. **Verifique se aparece** "Online" no status
4. **Se aparecer "Offline"**, verifique a conexão WiFi

### **3. Verificar Logs do Sistema**
Execute no computador para ver os logs:
```bash
adb logcat | findstr "SupabaseHelper\|TotemActivity\|RealPayGo"
```

---

## 🔧 **CADASTRAR MÁQUINAS NO SISTEMA**

### **1. Via Aplicativo Web**
1. **Acesse** o aplicativo web
2. **Faça login** como administrador
3. **Vá em "Máquinas"** ou "Admin"
4. **Clique em "Adicionar Máquina"**
5. **Preencha os dados**:
   - **Nome**: Ex: "Lavadora 1"
   - **Tipo**: "washing" (lavar) ou "drying" (secar)
   - **Status**: "available" (disponível)
   - **Preço**: Ex: 15.00
   - **Duração**: Ex: 40 (minutos)
   - **Localização**: Ex: "Conjunto A"

### **2. Via SQL Direto (Supabase)**
```sql
-- Inserir máquina de lavar
INSERT INTO machines (name, type, status, price_per_kg, cycle_time_minutes, location, esp32_id, relay_pin)
VALUES ('Lavadora 1', 'washing', 'available', 15.00, 40, 'Conjunto A', 'main', 1);

-- Inserir máquina de secar
INSERT INTO machines (name, type, status, price_per_kg, cycle_time_minutes, location, esp32_id, relay_pin)
VALUES ('Secadora 1', 'drying', 'available', 10.00, 20, 'Conjunto A', 'main', 2);
```

---

## 🐛 **RESOLUÇÃO DE PROBLEMAS**

### **Problema 1: Tablet mostra "Offline"**
**Solução:**
1. Verifique se o WiFi está conectado
2. Teste a internet no navegador
3. Verifique se consegue acessar o Supabase
4. Reinicie o aplicativo

### **Problema 2: Não aparecem máquinas**
**Solução:**
1. Verifique se há máquinas cadastradas no Supabase
2. Verifique os logs do aplicativo
3. Teste a conectividade com o Supabase
4. Use as máquinas padrão se offline

### **Problema 3: Erro de conexão**
**Solução:**
1. Verifique a URL do Supabase
2. Verifique a chave de API
3. Teste a conectividade de rede
4. Verifique os logs de erro

---

## 📊 **VERIFICAR STATUS DO SISTEMA**

### **1. No Aplicativo Web**
- **Dashboard**: Veja estatísticas gerais
- **Máquinas**: Lista todas as máquinas cadastradas
- **Transações**: Histórico de pagamentos
- **Configurações**: Ajustes do sistema

### **2. No Tablet Android**
- **Status**: Mostra se está online/offline
- **Máquinas**: Lista máquinas disponíveis
- **Admin**: Painel administrativo
- **Logs**: Informações de debug

---

## 🔄 **SINCRONIZAÇÃO**

### **Online (Conectado)**
- ✅ Máquinas carregadas do Supabase
- ✅ Transações salvas em tempo real
- ✅ Status atualizado automaticamente
- ✅ Relatórios sincronizados

### **Offline (Desconectado)**
- ⚠️ Máquinas padrão carregadas
- ⚠️ Transações salvas localmente
- ⚠️ Sincronização quando conectar
- ⚠️ Funcionamento limitado

---

## 📞 **SUPORTE**

### **Logs Importantes**
- `SupabaseHelper`: Conexão com banco
- `TotemActivity`: Interface do totem
- `RealPayGo`: Comunicação com PPC930

### **Comandos Úteis**
```bash
# Ver logs em tempo real
adb logcat | findstr "SupabaseHelper\|TotemActivity\|RealPayGo"

# Limpar logs
adb logcat -c

# Reiniciar aplicativo
adb shell am force-stop app.lovable.toplavanderia
adb shell am start -n app.lovable.toplavanderia/.TotemActivity
```

---

## ✅ **CHECKLIST DE VERIFICAÇÃO**

- [ ] WiFi conectado no tablet
- [ ] Internet funcionando
- [ ] Aplicativo web acessível
- [ ] Máquinas cadastradas no Supabase
- [ ] App Android instalado
- [ ] Status mostra "Online"
- [ ] Máquinas aparecem no totem
- [ ] PayGo/PPC930 funcionando
- [ ] Logs sem erros críticos

---

**🎯 PRÓXIMOS PASSOS:**
1. Acesse o aplicativo web
2. Cadastre as máquinas necessárias
3. Teste o tablet com WiFi conectado
4. Verifique se as máquinas aparecem
5. Teste um pagamento real na PPC930
