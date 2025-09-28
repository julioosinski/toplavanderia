# Instalação Manual no Tablet Android

## 📱 **Instalação Direta no Tablet (Sem Computador)**

Se não conseguir usar ADB, pode instalar os APKs diretamente no tablet:

### **1. Preparar Arquivos**

1. **Transferir APKs para o tablet:**
   - Conectar tablet ao computador via USB
   - Copiar os arquivos APK para a pasta Downloads do tablet
   - Ou usar Google Drive, Dropbox, etc.

2. **Arquivos necessários:**
   - `PGIntegrado-v4.1.50.5_CERT_geral_250605.apk` (para testes)
   - `PGIntegrado-v4.1.50.5_PROD_geral_250605.apk` (para produção)

### **2. Configurar Tablet**

1. **Ativar instalação de fontes desconhecidas:**
   - Ir para Configurações > Segurança
   - Ativar "Fontes desconhecidas" ou "Instalar apps desconhecidos"
   - Permitir para "Arquivos" ou "Gerenciador de arquivos"

2. **Conectar PPC930:**
   - Conectar PPC930 via USB
   - Verificar se dispositivo é reconhecido

### **3. Instalar PayGo Integrado**

1. **Abrir gerenciador de arquivos no tablet**
2. **Navegar para a pasta Downloads**
3. **Localizar o arquivo APK do PayGo**
4. **Tocar no arquivo APK**
5. **Seguir as instruções de instalação**
6. **Permitir todas as permissões solicitadas**

### **4. Configurar PayGo Integrado**

1. **Abrir "PayGo Integrado" no tablet**
2. **Clicar em "Parear Bluetooth"**
3. **Selecionar PPC930 na lista de dispositivos**
4. **Inserir senha de pareamento se solicitado**
5. **Configurar o dispositivo**

### **5. Instalar Ponto de Captura**

1. **No PayGo Integrado:**
   - Iniciar operação administrativa
   - Selecionar "INSTALACAO"
   - Inserir senha técnica: `314159`
   - Indicar o ponto de captura
   - Inserir CNPJ do estabelecimento
   - Confirmar servidor e porta TCP
   - Aguardar impressão do comprovante

### **6. Instalar Top Lavanderia**

Para instalar o Top Lavanderia, você precisa compilar o APK:

#### **Opção A: Compilar no Computador**
```bash
# No computador
npm install
npm run build
npx cap build android
npx cap run android
```

#### **Opção B: Usar APK Pré-compilado**
Se tiver um APK pré-compilado do Top Lavanderia:
1. Transferir APK para o tablet
2. Instalar da mesma forma que o PayGo
3. Configurar nas configurações do app

## 🔧 **Configurações Importantes**

### **PayGo Integrado**
- **Host**: IP do servidor PayGo
- **Porta**: 3000 (padrão)
- **Protocolo**: TCP
- **Dispositivo**: PPC930

### **Top Lavanderia**
- **API Endpoint**: Configurado nas configurações
- **PayGo Integration**: Ativada por padrão
- **Modo Kiosk**: Ativado

## 🐛 **Solução de Problemas**

### **APK não instala**
1. Verificar se "Fontes desconhecidas" está ativado
2. Verificar se há espaço suficiente no tablet
3. Tentar reiniciar o tablet
4. Verificar se o arquivo APK não está corrompido

### **PayGo não conecta**
1. Verificar se PPC930 está conectado via USB
2. Verificar se Bluetooth está ativado
3. Tentar parear novamente
4. Verificar configurações de rede

### **Aplicativo não abre**
1. Verificar permissões do aplicativo
2. Verificar se há atualizações disponíveis
3. Tentar reinstalar o aplicativo
4. Verificar logs do sistema

## 📋 **Checklist de Verificação**

### **Antes da Instalação**
- [ ] Tablet Android 5.1+ funcionando
- [ ] PPC930 conectado via USB
- [ ] Conexão de rede disponível
- [ ] APKs transferidos para o tablet

### **Durante a Instalação**
- [ ] PayGo Integrado instalado com sucesso
- [ ] Permissões concedidas
- [ ] Aplicativo abre normalmente

### **Após a Instalação**
- [ ] PayGo Integrado configurado
- [ ] PPC930 pareado e funcionando
- [ ] Ponto de captura instalado
- [ ] Top Lavanderia instalado e funcionando

## 📞 **Suporte**

Se ainda tiver problemas:
1. Verificar logs do Android
2. Documentar erros encontrados
3. Contactar equipe de desenvolvimento

## 🎯 **Próximos Passos**

1. **Instalar PayGo Integrado**
2. **Configurar PPC930**
3. **Instalar ponto de captura**
4. **Compilar e instalar Top Lavanderia**
5. **Realizar testes de funcionamento**
6. **Configurar para produção**
