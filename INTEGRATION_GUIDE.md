# 🏨 SISTEMA TOP LAVANDERIA - POUSADA
## Guia Completo de Funcionalidades e Integração PayGO

---

## 📋 **FUNCIONALIDADES IMPLEMENTADAS**

### ✅ **1. SISTEMA DE GESTÃO COMPLETO**
- **Frontend Responsivo**: Landing page + Totem touchscreen + Admin
- **Painel Administrativo**: Gestão completa de máquinas e transações
- **Modo Kiosk**: Segurança para tablets (Android/iOS via Capacitor)
- **Monitoramento ESP32**: Status em tempo real das máquinas

### ✅ **2. SISTEMAS DE PAGAMENTO**
- **PayGO Elgin**: Cartão crédito/débito + PIX (IMPLEMENTADO)
- **TEF Elgin**: Sistema backup para cartões (IMPLEMENTADO)
- **PIX Nativo**: QR Code com polling automático (IMPLEMENTADO)
- **Retry Automático**: Recuperação inteligente de falhas

### ✅ **3. AUTOMAÇÃO FISCAL (NFSe)**
- **Integração Zapier**: Emissão automática de nota fiscal
- **Webhook Configurável**: Para qualquer provedor NFSe
- **Widget de Teste**: Validação da integração
- **Dados da Empresa**: CNPJ, nome, email configuráveis

### ✅ **4. CONTROLE DE MÁQUINAS**
- **ESP32 Integration**: Ativação física das máquinas
- **Status Automático**: Disponível/Em uso/Manutenção/Offline
- **Monitoramento**: Heartbeat, sinal Wi-Fi, uptime
- **Failover**: Sistema redundante para alta disponibilidade

---

## 🔌 **INTEGRAÇÃO PAYGO - PASSO A PASSO**

### **ETAPA 1: Preparação do Hardware**
```bash
1. Conecte a maquininha Elgin via USB ou Wi-Fi
2. Instale o software PayGO Elgin no Windows
3. Configure a maquininha no software oficial
4. Teste uma transação manual primeiro
```

### **ETAPA 2: Configuração da API**
```bash
1. Abra as configurações do PayGO Elgin
2. Habilite "Interface de Automação"
3. Configure a porta (padrão: 8080)
4. Defina chave de automação (se necessário)
5. Confirme que está rodando em localhost:8080
```

### **ETAPA 3: Configuração no Sistema**
```bash
1. Acesse /admin no navegador
2. Faça login como administrador
3. Vá na aba "Setup PayGO"
4. Siga o guia passo a passo
5. Configure Host: 127.0.0.1, Porta: 8080
```

### **ETAPA 4: Teste da Integração**
```bash
1. Use o widget de teste no admin
2. Teste pagamento com cartão de teste
3. Teste geração de PIX
4. Verifique logs de transação
5. Valide ativação das máquinas
```

---

## 🛠️ **CONFIGURAÇÕES TÉCNICAS**

### **Endpoints PayGO (Automação)**
```http
GET  http://127.0.0.1:8080/status          # Status da maquininha
POST http://127.0.0.1:8080/transaction     # Processar pagamento
POST http://127.0.0.1:8080/pix/generate    # Gerar PIX
GET  http://127.0.0.1:8080/pix/status/:id  # Status PIX
POST http://127.0.0.1:8080/cancel          # Cancelar transação
```

### **Exemplo de Payload - Pagamento Cartão**
```json
{
  "amount": 1500,        // R$ 15,00 em centavos
  "installments": 1,     // Parcelas
  "paymentType": "CREDIT", // CREDIT, DEBIT, PIX
  "orderId": "ORDER-123"   // ID único da transação
}
```

### **Exemplo de Payload - PIX**
```json
{
  "amount": 1500,        // R$ 15,00 em centavos
  "orderId": "PIX-123",  // ID único
  "expiresIn": 300       // 5 minutos
}
```

---

## 🔧 **TROUBLESHOOTING PAYGO**

### **Problema: Maquininha não conecta**
```bash
✅ Soluções:
- Verifique se cabo USB está bem conectado
- Reinstale drivers da maquininha
- Teste em outra porta USB
- Configure Wi-Fi se for conexão wireless
```

### **Problema: Erro de comunicação HTTP**
```bash
✅ Soluções:
- Confirme se PayGO Elgin está rodando
- Verifique se porta 8080 está liberada no firewall
- Teste acesso manual: http://127.0.0.1:8080/status
- Reinicie o software PayGO
```

### **Problema: Pagamento sempre negado**
```bash
✅ Soluções:
- Verifique configuração do estabelecimento
- Confirme dados do CNPJ/CPF
- Teste com cartão válido de outra bandeira
- Verifique conexão com internet (para autorização)
```

---

## 📱 **MODO TOTEM (Tablet)**

### **Configuração Android/iOS**
```bash
1. Instale o APK gerado pelo Capacitor
2. Execute o app em modo fullscreen
3. O sistema ativa automaticamente:
   - Modo kiosk (impede sair do app)
   - Segurança administrativa (PIN)
   - Bloqueio de navegação externa
```

### **Funcionalidades do Totem**
- ✅ Interface touchscreen otimizada
- ✅ Seleção visual de máquinas
- ✅ Pagamento integrado (Cartão + PIX)
- ✅ Feedback visual em tempo real
- ✅ Timeout automático para reset
- ✅ Acesso administrativo oculto (7 toques)

---

## 💾 **ESTRUTURA DO BANCO DE DADOS**

### **Tabelas Principais**
```sql
machines        -- Lavadoras/secadoras e configurações
transactions    -- Histórico de pagamentos
esp32_status    -- Status dos controladores
system_settings -- Configurações globais
user_credits    -- Sistema de créditos (futuro)
profiles        -- Usuários do sistema
```

### **Configurações NFSe**
```sql
-- Campos na tabela system_settings:
zapier_webhook_url  -- URL do webhook Zapier
nfse_enabled       -- Habilitar emissão automática
company_cnpj       -- CNPJ da pousada
company_name       -- Nome da empresa
company_email      -- Email para NFSe
```

---

## 🚀 **PRÓXIMOS PASSOS RECOMENDADOS**

### **Curto Prazo (1-2 semanas)**
1. ✅ Configure PayGO seguindo este guia
2. ✅ Teste todas as formas de pagamento
3. ✅ Configure NFSe via Zapier
4. ✅ Deploy do app no tablet

### **Médio Prazo (1-2 meses)**
1. 📊 Analytics avançadas de uso
2. 🔔 Notificações push para admin
3. 📱 App mobile para hóspedes
4. 💳 Sistema de créditos pré-pagos

### **Longo Prazo (3-6 meses)**
1. 🤖 IA para otimização de preços
2. 📈 Dashboard de business intelligence
3. 🌐 Multi-idiomas para turistas
4. 🔗 Integração com sistema de hotel

---

## 📞 **SUPORTE E RECURSOS**

### **Documentação Técnica**
- 📘 Este guia completo
- 🔧 Widget de teste integrado
- 📊 Logs detalhados no admin
- 🐛 Console de debug no browser

### **Links Úteis**
- **Elgin Official**: https://elgin.com.br
- **PayGO Support**: https://elgin.com.br/suporte
- **Zapier Webhooks**: https://zapier.com/help/webhooks
- **Supabase Docs**: https://supabase.com/docs

---

## ✨ **RESUMO FINAL**

🎉 **SEU SISTEMA ESTÁ COMPLETO E PRONTO!**

✅ **Frontend**: Landing + Totem + Admin
✅ **Pagamentos**: PayGO + TEF + PIX
✅ **Hardware**: ESP32 + Máquinas
✅ **Fiscal**: NFSe automática
✅ **Segurança**: RLS + Autenticação
✅ **Mobile**: Capacitor Android/iOS

**Para ativar PayGO**: Siga o "ETAPA 1-4" acima
**Para usar**: Acesse /totem no tablet
**Para gerenciar**: Acesse /admin no computador

**🚀 Sua pousada agora tem um sistema de lavanderia profissional e automatizado!**