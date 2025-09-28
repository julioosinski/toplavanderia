# Solução para Erro 2130 - PayGo Integrado

## 🔍 **O que é o Erro 2130?**

O erro 2130 no PayGo Integrado indica que o **PPC930 não está sendo reconhecido** pelo sistema. Este é um problema comum de configuração USB.

## 🛠️ **Soluções Passo a Passo**

### **1. Verificar Conexão Física**

**No Tablet:**
- [ ] PPC930 conectado via USB
- [ ] Cabo USB funcionando (testar com outro cabo)
- [ ] LED do PPC930 aceso
- [ ] Conector USB limpo

**Teste:**
- Desconectar e reconectar o PPC930
- Tentar outro cabo USB
- Verificar se o PPC930 liga em outro dispositivo

### **2. Configurar Permissões USB no Tablet**

**Android 5.1+ (seu caso):**
1. Ir para **Configurações > Segurança**
2. Ativar **"Fontes desconhecidas"**
3. Ir para **Configurações > Aplicativos**
4. Encontrar **"PayGo Integrado"**
5. Clicar em **"Permissões"**
6. Ativar **"USB"** e **"Armazenamento"**

### **3. Configurar Depuração USB**

1. Ir para **Configurações > Sobre o dispositivo**
2. Tocar **7 vezes** em "Número da versão"
3. Voltar para **Configurações > Opções do desenvolvedor**
4. Ativar **"Depuração USB"**
5. Ativar **"Depuração USB (Segurança)"**
6. Ativar **"Verificação de aplicativos via USB"**

### **4. Configurar PayGo Integrado**

**No PayGo Integrado:**
1. Abrir o aplicativo
2. Ir para **Configurações**
3. Verificar se **"USB"** está ativado
4. Verificar se **"Bluetooth"** está ativado
5. Tentar **"Detectar Dispositivos"**

### **5. Instalar Driver USB (se necessário)**

**Se o PPC930 não aparecer:**
1. Conectar PPC930 ao computador
2. Verificar se aparece como "Dispositivo desconhecido"
3. Baixar driver do site da PayGo
4. Instalar driver no computador
5. Reconectar no tablet

### **6. Configuração de Rede**

**Verificar configurações:**
- **Host**: IP do servidor PayGo
- **Porta**: 3000 (padrão)
- **Protocolo**: TCP
- **Conexão**: Ativa

### **7. Reiniciar Serviços**

**No Tablet:**
1. Fechar PayGo Integrado
2. Ir para **Configurações > Aplicativos**
3. Encontrar **"PayGo Integrado"**
4. Clicar **"Forçar parada"**
5. Clicar **"Limpar cache"**
6. Abrir PayGo Integrado novamente

### **8. Teste de Conectividade**

**Verificar se PPC930 responde:**
1. No PayGo Integrado
2. Ir para **Diagnósticos**
3. Clicar **"Testar Conexão"**
4. Verificar logs de erro

## 🔧 **Comandos de Diagnóstico**

**Via ADB (no computador):**
```bash
# Verificar dispositivos USB
adb shell ls /dev/bus/usb/

# Verificar logs do PayGo
adb logcat | grep -i paygo

# Verificar dispositivos USB
adb shell cat /proc/bus/usb/devices
```

## 📋 **Checklist de Verificação**

### **Hardware:**
- [ ] PPC930 ligado e LED aceso
- [ ] Cabo USB funcionando
- [ ] Conector limpo e firme
- [ ] PPC930 funciona em outro dispositivo

### **Software:**
- [ ] PayGo Integrado instalado
- [ ] Permissões USB ativadas
- [ ] Depuração USB ativada
- [ ] Aplicativo atualizado

### **Configuração:**
- [ ] PayGo Integrado configurado
- [ ] Rede configurada
- [ ] Servidor PayGo acessível
- [ ] PPC930 detectado

## 🚨 **Se Nada Funcionar**

### **Opção 1 - Reset Completo:**
1. Desinstalar PayGo Integrado
2. Reiniciar tablet
3. Reinstalar PayGo Integrado
4. Configurar do zero

### **Opção 2 - Verificar Compatibilidade:**
- PPC930 compatível com Android 5.1?
- Versão do PayGo Integrado correta?
- Firmware do PPC930 atualizado?

### **Opção 3 - Suporte Técnico:**
- Contatar suporte PayGo
- Fornecer logs de erro
- Informar modelo do tablet
- Informar versão do Android

## 📞 **Informações para Suporte**

**Coletar antes de contatar:**
- Modelo do tablet
- Versão do Android
- Versão do PayGo Integrado
- Logs de erro completos
- Marca/modelo do PPC930

## 🎯 **Próximos Passos**

1. **Testar cada solução** na ordem
2. **Documentar** o que funcionou
3. **Verificar** se PPC930 é detectado
4. **Configurar** PayGo Integrado
5. **Testar** transação de exemplo

---

**Status Atual:** Erro 2130 - PPC930 não detectado
**Próximo:** Testar soluções acima
