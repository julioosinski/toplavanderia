# Guia de Integração PayGO - Passo a Passo

## 1. Pré-requisitos

### Hardware/Software:
- Terminal PayGO configurado e funcionando
- Rede local estável (Wi-Fi ou Ethernet)
- Tablet/totem na mesma rede do terminal PayGO
- Aplicação totem instalada e funcionando

### Informações Necessárias:
- IP do terminal PayGO
- Porta de comunicação (padrão: 2500)
- Chave de acesso/autenticação (se houver)
- Configurações de rede específicas

## 2. Configuração de Rede

### 2.1. Verificar Conectividade
```bash
# Teste de ping para o terminal PayGO
ping [IP_DO_TERMINAL_PAYGO]

# Teste de porta específica
telnet [IP_DO_TERMINAL_PAYGO] 2500
```

### 2.2. Configurar Firewall
- Liberar porta 2500 (ou porta configurada)
- Permitir comunicação entre totem e terminal
- Configurar IP estático (recomendado)

## 3. Configuração da Aplicação

### 3.1. Acessar Painel Administrativo
1. Na aplicação do totem, acesse a tela de administração
2. Digite o PIN administrativo
3. Vá para a aba "Configurações"

### 3.2. Configurar PayGO
No painel administrativo, configure:

```javascript
// Configurações PayGO
{
  "host": "192.168.1.100",          // IP do terminal PayGO
  "port": 2500,                     // Porta de comunicação
  "timeout": 30000,                 // Timeout em ms
  "retryAttempts": 3,               // Tentativas de retry
  "enableRetry": true,              // Habilitar retry automático
  "debugMode": false                // Modo debug (só para testes)
}
```

### 3.3. Campos Obrigatórios:
- **Host**: IP do terminal PayGO na rede local
- **Porta**: Porta de comunicação (padrão 2500)
- **Timeout**: Tempo limite para transações (30-60 segundos)

## 4. Teste de Conectividade

### 4.1. Teste Básico
1. No painel administrativo, clique em "Testar Conexão PayGO"
2. Aguarde resposta do sistema
3. Verifique se retorna "Conexão OK"

### 4.2. Teste de Transação
1. Faça uma transação de teste de R$ 0,01
2. Verifique se o terminal PayGO responde
3. Confirme se a transação é processada corretamente

## 5. Configurações Avançadas

### 5.1. Parâmetros de Retry
```javascript
{
  "retryAttempts": 3,           // Número de tentativas
  "retryDelay": 2000,           // Delay entre tentativas (ms)
  "exponentialBackoff": true    // Aumentar delay progressivamente
}
```

### 5.2. Configurações de Segurança
```javascript
{
  "encryptTransactions": true,  // Criptografar comunicação
  "validateResponses": true,    // Validar respostas do terminal
  "logTransactions": true       // Log de transações para auditoria
}
```

## 6. Monitoramento e Logs

### 6.1. Verificar Status PayGO
- No painel administrativo, monitore o status em tempo real
- Verde: Funcionando normalmente
- Amarelo: Problemas intermitentes
- Vermelho: Falha de comunicação

### 6.2. Logs de Transação
```javascript
// Exemplo de log de transação
{
  "timestamp": "2024-01-15T10:30:00Z",
  "type": "credit_card",
  "amount": 1500,               // R$ 15,00 em centavos
  "status": "approved",
  "authCode": "123456",
  "receipt": "...",
  "terminal": "192.168.1.100:2500"
}
```

## 7. Troubleshooting Comum

### 7.1. Erro de Conexão
**Problema**: "Falha ao conectar com PayGO"
**Soluções**:
- Verificar IP e porta
- Testar ping para o terminal
- Verificar firewall
- Reiniciar terminal PayGO

### 7.2. Timeout de Transação
**Problema**: "Timeout na transação"
**Soluções**:
- Aumentar timeout (60-90 segundos)
- Verificar estabilidade da rede
- Verificar se terminal não está ocupado

### 7.3. Transação Negada
**Problema**: "Transação negada pelo terminal"
**Soluções**:
- Verificar dados do cartão
- Conferir valor da transação
- Verificar se terminal está configurado corretamente

## 8. Manutenção Preventiva

### 8.1. Verificações Diárias
- [ ] Teste de conectividade PayGO
- [ ] Verificar logs de erro
- [ ] Confirmar sincronização de dados

### 8.2. Verificações Semanais
- [ ] Backup de configurações
- [ ] Limpeza de logs antigos
- [ ] Teste de transação completa

### 8.3. Verificações Mensais
- [ ] Atualização de certificados
- [ ] Revisão de configurações de segurança
- [ ] Teste de failover (se configurado)

## 9. Contatos de Suporte

### Suporte Técnico PayGO:
- Telefone: [INSERIR_TELEFONE]
- Email: [INSERIR_EMAIL]
- Horário: Segunda a Sexta, 8h às 18h

### Suporte Aplicação:
- Email: [SEU_EMAIL_SUPORTE]
- Documentação: [LINK_DOCUMENTACAO]

## 10. Certificação e Homologação

Antes de colocar em produção:
1. Realizar testes completos com o PayGO
2. Validar todas as formas de pagamento
3. Certificar configurações de segurança
4. Obter aprovação final do PayGO (se necessário)