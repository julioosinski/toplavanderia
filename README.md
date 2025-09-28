# 🏪 Top Lavanderia - Sistema de Totem com PayGo

Sistema completo de autoatendimento para lavanderia com integração real de pagamento via PayGo Android Kit v4.1.50.5 e PPC930.

## 🚀 Funcionalidades

### ✨ **Sistema de Totem**
- 🏪 Interface intuitiva para seleção de máquinas
- 🧺 Máquinas de lavar e secar com preços configuráveis
- ⏱️ Tempo de ciclo personalizável por máquina
- 📱 Interface otimizada para tablet Android

### 💳 **Integração de Pagamento Real**
- 🔌 Comunicação real com PPC930 via PayGo Android Kit v4.1.50.5
- 💰 Processamento de pagamentos com cartão
- ✅ Confirmação automática de transações
- 🔄 Sistema de retry e tratamento de erros

### 🌐 **Sistema Híbrido Online/Offline**
- ☁️ Sincronização com Supabase em tempo real
- 📊 Armazenamento local para funcionamento offline
- 🔄 Sincronização automática quando online
- 📈 Relatórios e monitoramento de operações

### ⚙️ **Painel Administrativo**
- 📊 Dashboard com estatísticas em tempo real
- 🏭 Gerenciamento de máquinas
- 📋 Relatórios de vendas e operações
- ⚙️ Configurações do sistema
- 🧪 Testes de conectividade PayGo/PPC930

## 🛠️ Tecnologias Utilizadas

### **Frontend (Web)**
- ⚛️ React 18 + TypeScript
- 🎨 Tailwind CSS
- 🔧 Vite
- 📱 Capacitor

### **Backend**
- 🗄️ Supabase (PostgreSQL)
- 🔐 Autenticação JWT
- 📊 APIs REST
- 🔄 Sincronização em tempo real

### **Mobile (Android)**
- ☕ Java 8
- 🏗️ Android Gradle Plugin
- 📱 Android API 24+
- 🔌 PayGo Android Kit v4.1.50.5

### **Integração de Pagamento**
- 💳 PayGo Integrado CERT/PROD
- 🔌 PPC930 Pinpad
- 📡 Comunicação USB/Serial
- 🔐 Certificação PCI

## 📦 Estrutura do Projeto

```
toplavanderia/
├── 📱 android/                    # Aplicativo Android
│   ├── app/src/main/java/         # Código Java
│   │   └── app/lovable/toplavanderia/
│   │       ├── TotemActivity.java      # Interface principal
│   │       ├── AdminActivity.java      # Painel administrativo
│   │       ├── RealPayGoManager.java   # Integração PayGo
│   │       ├── SupabaseHelper.java     # Conexão Supabase
│   │       └── DatabaseHelper.java     # Banco local
│   └── app/build/outputs/apk/     # APK compilado
├── 🌐 src/                        # Frontend React
│   ├── components/                # Componentes React
│   ├── pages/                     # Páginas da aplicação
│   ├── hooks/                     # Hooks customizados
│   └── integrations/supabase/     # Configuração Supabase
├── 📊 supabase/                   # Backend Supabase
│   ├── migrations/                # Migrações do banco
│   └── functions/                 # Edge Functions
├── 📦 tablet_package/             # Pacote para instalação
└── 📚 docs/                       # Documentação
```

## 🚀 Instalação e Configuração

### **1. Pré-requisitos**
- Node.js 18+
- Java 8+
- Android SDK
- PayGo Android Kit v4.1.50.5
- PPC930 Pinpad

### **2. Configuração do Supabase**
```bash
# URL do projeto
https://rkdybjzwiwwqqzjfmerm.supabase.co

# Chave anônima
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZHlianp3aXd3cXF6amZtZXJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMDgxNjcsImV4cCI6MjA2ODg4NDE2N30.CnRP8lrmGmvcbHmWdy72ZWlfZ28cDdNoxdADnyFAOXg
```

### **3. Instalação do Frontend**
```bash
npm install
npm run build
```

### **4. Compilação do Android**
```bash
cd android
./gradlew assembleDebug
```

### **5. Instalação no Tablet**
```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

## 🔧 Configuração do PayGo

### **1. Instalação do PayGo Integrado**
- Instale o APK do PayGo Integrado (CERT ou PROD)
- Configure a PPC930 via cabo USB
- Teste a conectividade

### **2. Configuração da PPC930**
- Conecte via USB ao tablet
- Configure os parâmetros de comunicação
- Teste transações de exemplo

### **3. Teste de Integração**
```bash
# Verificar logs
adb logcat | findstr "RealPayGo\|SupabaseHelper\|TotemActivity"
```

## 📱 Uso do Sistema

### **Interface do Totem**
1. **Seleção de Máquina**: Escolha entre lavadoras e secadoras
2. **Confirmação**: Visualize preço e duração
3. **Pagamento**: Processe via PPC930
4. **Liberação**: Máquina é liberada automaticamente

### **Painel Administrativo**
1. **Dashboard**: Estatísticas em tempo real
2. **Máquinas**: Gerenciar status e configurações
3. **Relatórios**: Histórico de operações
4. **Configurações**: Ajustes do sistema

## 🔄 Sincronização de Dados

### **Online**
- ✅ Máquinas carregadas do Supabase
- ✅ Transações salvas em tempo real
- ✅ Status atualizado automaticamente
- ✅ Relatórios sincronizados

### **Offline**
- ⚠️ Máquinas padrão carregadas
- ⚠️ Transações salvas localmente
- ⚠️ Sincronização quando conectar
- ⚠️ Funcionamento limitado

## 🐛 Resolução de Problemas

### **Problema: Tablet mostra "Offline"**
```bash
# Verificar conectividade
adb logcat | findstr "SupabaseHelper"
```

### **Problema: PayGo não conecta**
```bash
# Verificar PayGo
adb logcat | findstr "RealPayGo"
```

### **Problema: Máquinas não aparecem**
1. Verificar se há máquinas cadastradas no Supabase
2. Verificar logs de conectividade
3. Testar com máquinas padrão

## 📊 Monitoramento

### **Logs Importantes**
- `SupabaseHelper`: Conexão com banco
- `TotemActivity`: Interface do totem
- `RealPayGo`: Comunicação com PPC930
- `AdminActivity`: Painel administrativo

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

## 📈 Roadmap

### **Versão Atual (v1.0.0)**
- ✅ Sistema de totem completo
- ✅ Integração real PayGo/PPC930
- ✅ Sincronização Supabase
- ✅ Painel administrativo
- ✅ Sistema híbrido online/offline

### **Próximas Versões**
- 🔄 Integração com ESP32
- 📊 Relatórios avançados
- 🔔 Notificações push
- 🌍 Multi-idioma
- 📱 App iOS

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 📞 Suporte

Para suporte técnico ou dúvidas:
- 📧 Email: suporte@toplavanderia.com
- 📱 WhatsApp: (11) 99999-9999
- 🌐 Website: https://toplavanderia.com

---

**🎯 Sistema completo de totem de lavanderia com integração real de pagamento!**

Desenvolvido com ❤️ para revolucionar o autoatendimento em lavanderias.