# Checklist de Verificação - Top Lavanderia

## Antes da Instalação

- [ ] Tablet Android 5.1+ conectado via USB
- [ ] ADB habilitado no tablet
- [ ] PPC930 conectado e ligado
- [ ] Conexão WiFi disponível
- [ ] Arquivos de instalação na máquina

## Instalação

- [ ] PayGo Integrado instalado com sucesso
- [ ] PPC930 pareado via Bluetooth
- [ ] Ponto de captura instalado (senha: 314159)
- [ ] CNPJ configurado no PayGo
- [ ] Top Lavanderia APK instalado

## Pós-Instalação

### PayGo Integrado
- [ ] App abre normalmente
- [ ] PPC930 detectado e pareado
- [ ] Comprovante de instalação impresso

### Top Lavanderia
- [ ] App abre em modo kiosk (tela cheia)
- [ ] CNPJ da lavanderia inserido
- [ ] Máquinas carregadas do Supabase
- [ ] Interface responsiva no tablet

## Testes Funcionais

### Conexão PayGo
- [ ] Diagnóstico: "PayGo inicializado" = ✅
- [ ] Diagnóstico: "Pinpad USB detectado" = ✅
- [ ] Comunicação estabelecida com PPC930

### Pagamentos
- [ ] Cartão de crédito processado com sucesso
- [ ] Cartão de débito processado com sucesso
- [ ] PIX processado (se disponível)
- [ ] Cancelamento de transação funciona
- [ ] Transação salva no Supabase

### Controle de Máquinas
- [ ] ESP32 online e respondendo
- [ ] Máquina ativada após pagamento aprovado
- [ ] Tempo de ciclo correto
- [ ] Status atualiza em tempo real

### Interface
- [ ] Navegação fluida
- [ ] Feedback visual nos pagamentos
- [ ] Mensagens de erro claras
- [ ] Modo kiosk estável

## Configurações de Produção

- [ ] PayGo PROD instalado (não CERT)
- [ ] CNPJ real configurado
- [ ] Chave de automação inserida
- [ ] WiFi da loja configurado
- [ ] Modo debug desativado

## Aprovação

**Data**: ___________
**Responsável**: ___________
**Assinatura**: ___________
