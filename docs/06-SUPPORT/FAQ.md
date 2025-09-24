# FAQ - Perguntas Frequentes

## Instalação e Configuração

### Q: Como instalar o TopLavanderia pela primeira vez?
**R:** Siga o [Guia de Início Rápido](../01-GUIA-INICIAL/QUICK-START.md):
1. Clone o repositório
2. Execute `npm install`
3. Configure o PayGO com suas credenciais
4. Execute `npx cap sync` e `npx cap run android`

### Q: Preciso de um tablet específico?
**R:** Requisitos mínimos:
- Android 8.0+ (API 26)
- 2GB RAM
- Porta USB para conexão com PPC930
- WiFi estável

### Q: O app funciona sem internet?
**R:** Funcionalidades offline limitadas:
- ✅ Interface básica
- ✅ PayGO (rede local)
- ❌ Supabase (requer internet)
- ❌ PIX (requer internet)

## PayGO e PPC930

### Q: O pinpad PPC930 não é detectado, o que fazer?
**R:** Checklist de troubleshooting:
1. **Cabo USB** - Use cabo de dados (não apenas carregamento)
2. **Permissões** - Ative "Depuração USB" no Android
3. **Driver** - Verifique se o dispositivo aparece em `adb devices`
4. **Reinicialização** - Reinicie o app e reconecte o pinpad
5. **Teste manual** - Use Admin > PayGO Diagnostics

### Q: Erro "PayGO initialization failed"
**R:** Possíveis causas:
- **Chave de automação** incorreta ou expirada
- **Host/Porta** errados na configuração
- **Biblioteca .aar** não incluída no build
- **Permissões** de rede bloqueadas

```typescript
// Teste a configuração
const config = {
  host: "192.168.1.100", // IP correto?
  port: 3000,            // Porta padrão
  automationKey: "sua-chave-válida"
};
```

### Q: Transações falham mesmo com pinpad conectado
**R:** Diagnóstico passo a passo:
1. **Teste conexão** - Admin > Test Connection
2. **Valor válido** - Entre R$ 0,01 e R$ 9.999,99
3. **Rede estável** - Ping para o servidor PayGO
4. **Timeout** - Aguarde até 2 minutos para transações

### Q: Como configurar PIX?
**R:** PIX requer:
- Internet ativa
- Configuração PayGO completa
- Ordem de pagamento válida
- QR Code será gerado automaticamente

## Problemas Técnicos

### Q: App trava na tela de loading
**R:** Soluções comuns:
1. **Force close** o app
2. **Limpar cache** - Configurações > Apps > TopLavanderia > Storage > Clear Cache
3. **Reinstalar** o app
4. **Verificar logs** - `adb logcat | grep TopLavanderia`

### Q: Erro "Network request failed"
**R:** Checklist de rede:
- WiFi conectado e estável
- Firewall não bloqueando porta 3000
- IP do servidor PayGO correto
- DNS funcionando

### Q: Como acessar o painel administrativo?
**R:** 
1. Abra o app
2. Pressione 5 vezes no logo (canto superior)
3. Digite o PIN administrativo
4. Acesse Admin > [funcionalidade desejada]

### Q: Esqueci o PIN administrativo
**R:** Para resetar o PIN:
1. Acesse o arquivo de configuração no dispositivo
2. Ou reinstale o app (perderá configurações locais)
3. Ou use o reset via Supabase (se configurado)

## Máquinas e ESP32

### Q: Como conectar máquinas ao ESP32?
**R:** Consulte [ESP32_IMPLEMENTATION.md](../ESP32_IMPLEMENTATION.md):
1. Configure a rede WiFi no ESP32
2. Conecte os relés às máquinas
3. Cadastre no painel admin
4. Teste a liberação de créditos

### Q: Máquina não liga após pagamento
**R:** Verificações:
1. **ESP32 online** - Admin > ESP32 Monitor
2. **Relé funcionando** - Teste manual no ESP32
3. **Configuração** - IP correto da máquina
4. **Alimentação** - Verifique fonte do ESP32

### Q: Como monitorar status das máquinas?
**R:** Use o dashboard admin:
- Admin > Machine Status
- Tempo real de uso
- Histórico de transações
- Status de conectividade ESP32

## Pagamentos e Transações

### Q: Como funciona o fallback de pagamentos?
**R:** Sistema universal tenta na ordem:
1. **PayGO** (preferência)
2. **TEF** (se PayGO falhar)
3. **Manual** (último recurso)

### Q: Transação aprovada mas máquina não ligou
**R:** Procedimento:
1. **Verificar logs** - Admin > Transaction History
2. **ESP32 status** - Confirmar conectividade
3. **Reenviar comando** - Admin > Credit Release
4. **Estorno** - Se necessário, via admin

### Q: Como fazer estorno de pagamento?
**R:** 
1. Admin > Transaction History
2. Localizar transação
3. Clicar "Refund" (se disponível)
4. Para PayGO: usar terminal físico
5. Para PIX: processo manual no banco

### Q: PIX não gera QR Code
**R:** Verificar:
- Internet conectada
- Valor dentro dos limites
- Configuração PIX válida
- Sem transações pendentes

## Manutenção e Atualizações

### Q: Como atualizar o app?
**R:** 
1. **Backup** das configurações
2. **Git pull** do repositório
3. **npm install** (novas dependências)
4. **npx cap sync** (sincronizar)
5. **Build e deploy** nova versão

### Q: Como fazer backup das configurações?
**R:** 
- Configurações salvas no Supabase automaticamente
- Para backup local: Admin > Export Settings
- Para restaurar: Admin > Import Settings

### Q: App consome muita bateria
**R:** Otimizações:
- Desabilitar localização se não usar
- Reduzir frequência de polling
- Usar modo "economia" quando inativo
- Verificar wakelocks no Android

## Suporte e Desenvolvimento

### Q: Como reportar bugs?
**R:** 
1. **GitHub Issues** - [link do repositório]/issues
2. **Logs** - Inclua logs do Android/console
3. **Screenshots** - Capturas da tela do erro
4. **Reprodução** - Passos para reproduzir

### Q: Como solicitar novas funcionalidades?
**R:** 
- GitHub Issues com label "enhancement"
- Descrever caso de uso específico
- Incluir mockups se possível
- Considerar impacto em outras funcionalidades

### Q: App é open source?
**R:** 
- Código principal: Sim (licença a definir)
- Integrações PayGO: Proprietária
- Configurações específicas: Não incluídas

### Q: Como contribuir com o desenvolvimento?
**R:** 
1. **Fork** o repositório
2. **Create branch** para sua feature
3. **Commit** com mensagens claras
4. **Pull request** com descrição detalhada
5. **Code review** pela equipe

## Licenciamento e Comercial

### Q: Posso usar em ambiente comercial?
**R:** Consulte a licença do projeto. Algumas integrações podem ter restrições comerciais.

### Q: Preciso pagar pelo PayGO?
**R:** PayGO é um serviço pago separadamente. Consulte a PayGO para licenciamento.

### Q: Suporte técnico tem custo?
**R:** 
- **Community**: Gratuito via GitHub
- **Professional**: Consulte opções pagas
- **Enterprise**: Suporte dedicado disponível

## Troubleshooting Avançado

### Q: Como ativar logs detalhados?
**R:** 
```typescript
// No app
localStorage.setItem('debug', 'true');

// Android
adb logcat | grep -E "(PayGO|TopLavanderia|ESP32)"
```

### Q: Como testar sem hardware físico?
**R:** 
- Use modo de simulação no código
- Mock das APIs PayGO/ESP32
- Ambiente de desenvolvimento com stubs

### Q: Performance está lenta
**R:** 
- Verificar memória RAM disponível
- Limpar cache do browser/WebView
- Reduzir polling frequency
- Otimizar queries do Supabase

## Contatos

**Suporte Técnico:** suporte@toplavanderia.com
**Bugs/Features:** GitHub Issues
**Documentação:** Esta pasta `/docs`
**Comunidade:** [Discord/Slack se houver]

---

**Não encontrou sua pergunta?** 
Abra uma issue no GitHub ou entre em contato pelo suporte técnico.