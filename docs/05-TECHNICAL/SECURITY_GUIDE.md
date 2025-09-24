# Guia de Segurança - TopLavanderia

## Visão Geral
Este guia detalha as práticas de segurança implementadas no TopLavanderia, incluindo autenticação, autorização, proteção de dados e configurações de segurança.

## Autenticação e Autorização

### Supabase Auth
```typescript
// Configuração de autenticação
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://your-project.supabase.co',
  'your-anon-key'
  // A chave anon é segura para uso no frontend
);
```

### Row Level Security (RLS)
Todas as tabelas têm RLS habilitado:

```sql
-- Exemplo: Usuários só veem suas próprias transações
CREATE POLICY "users_own_transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Admins veem tudo
CREATE POLICY "admins_see_all" ON transactions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
```

### Níveis de Acesso
```typescript
enum UserRole {
  ADMIN = 'admin',     // Acesso total ao sistema
  OPERATOR = 'operator', // Operação das máquinas
  USER = 'user'        // Uso básico do sistema
}
```

## Proteção de Dados Sensíveis

### Chaves de API e Secrets
**NUNCA** armazene secrets no código frontend:

```typescript
// ❌ ERRADO - Nunca faça isso
const PAYGO_KEY = "minha-chave-secreta";

// ✅ CORRETO - Use Supabase Edge Functions
const { data } = await supabase.functions.invoke('secure-payment', {
  body: { amount, orderId }
  // A chave fica segura no servidor
});
```

### Configuração de Secrets no Supabase
```bash
# Adicionar secret via CLI
supabase secrets set PAYGO_AUTOMATION_KEY="sua-chave-aqui"
supabase secrets set TEF_MERCHANT_KEY="sua-chave-tef"

# Usar na Edge Function
const paygoKey = Deno.env.get('PAYGO_AUTOMATION_KEY');
```

### Validação de Input
```typescript
import { z } from 'zod';

// Schema de validação
const paymentSchema = z.object({
  amount: z.number()
    .min(0.01, "Valor mínimo R$ 0,01")
    .max(9999.99, "Valor máximo R$ 9.999,99"),
  paymentType: z.enum(['credit', 'debit', 'pix']),
  orderId: z.string()
    .min(1, "Order ID obrigatório")
    .max(50, "Order ID muito longo")
    .regex(/^[a-zA-Z0-9-_]+$/, "Caracteres inválidos")
});

// Uso
const validatePayment = (data: unknown) => {
  try {
    return paymentSchema.parse(data);
  } catch (error) {
    throw new Error("Dados de pagamento inválidos");
  }
};
```

## Segurança de Rede

### Configuração Android
```xml
<!-- network_security_config.xml -->
<network-security-config>
    <!-- Permitir HTTP apenas para IPs locais -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">192.168.1.0/24</domain>
        <domain includeSubdomains="true">10.0.0.0/8</domain>
        <domain includeSubdomains="true">172.16.0.0/12</domain>
    </domain-config>
    
    <!-- HTTPS obrigatório para APIs externas -->
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system"/>
        </trust-anchors>
    </base-config>
</network-security-config>
```

### Firewall e Rede Local
```bash
# Configuração de firewall recomendada
# Permitir apenas IPs confiáveis na porta PayGO
iptables -A INPUT -p tcp --dport 3000 -s 192.168.1.0/24 -j ACCEPT
iptables -A INPUT -p tcp --dport 3000 -j REJECT

# Monitorar conexões
netstat -tuln | grep :3000
```

## Segurança PayGO

### Configuração Segura
```typescript
interface SecurePayGOConfig {
  host: string;      // IP na rede local apenas
  port: number;      // Porta não padrão
  automationKey: string; // Chave rotacionada regularmente
  timeout: number;   // Timeout para evitar travamentos
  maxRetries: number; // Limite de tentativas
}

// Validação da configuração
const validatePayGOConfig = (config: unknown): SecurePayGOConfig => {
  const schema = z.object({
    host: z.string().ip("IP inválido"),
    port: z.number().min(1024).max(65535),
    automationKey: z.string().min(10, "Chave muito curta"),
    timeout: z.number().min(5000).max(120000),
    maxRetries: z.number().min(1).max(5)
  });
  
  return schema.parse(config);
};
```

### Logs de Auditoria
```typescript
// Registrar todas as transações PayGO
const auditPayGOTransaction = async (transaction: PayGOTransaction) => {
  await supabase.from('audit_logs').insert({
    event_type: 'paygo_transaction',
    user_id: getCurrentUserId(),
    transaction_id: transaction.orderId,
    amount: transaction.amount,
    ip_address: await getClientIP(),
    user_agent: navigator.userAgent,
    timestamp: new Date().toISOString()
  });
};
```

## Segurança do Dispositivo

### Proteções Android
```xml
<!-- AndroidManifest.xml -->
<application
    android:allowBackup="false"
    android:debuggable="false"
    android:networkSecurityConfig="@xml/network_security_config">
    
    <!-- Impedir screenshots em telas sensíveis -->
    <activity android:name=".PaymentActivity"
              android:excludeFromRecents="true" />
</application>
```

### Detecção de Root/Jailbreak
```typescript
import { Device } from '@capacitor/device';

const checkDeviceSecurity = async () => {
  const info = await Device.getInfo();
  
  // Verificar se o dispositivo está rooteado
  if (info.isVirtual) {
    console.warn('App rodando em emulador');
  }
  
  // Implementar verificações adicionais conforme necessário
};
```

## Monitoramento e Alertas

### Logs de Segurança
```typescript
enum SecurityEventType {
  FAILED_LOGIN = 'failed_login',
  SUSPICIOUS_PAYMENT = 'suspicious_payment',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  DEVICE_CHANGE = 'device_change'
}

const logSecurityEvent = async (
  eventType: SecurityEventType,
  details: Record<string, any>
) => {
  await supabase.from('security_logs').insert({
    event_type: eventType,
    user_id: getCurrentUserId(),
    details,
    ip_address: await getClientIP(),
    timestamp: new Date().toISOString()
  });
};
```

### Alertas Automáticos
```sql
-- Trigger para alertas de segurança
CREATE OR REPLACE FUNCTION notify_security_event()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.event_type IN ('unauthorized_access', 'suspicious_payment') THEN
    -- Enviar notificação para admins
    INSERT INTO notifications (
      user_id, 
      type, 
      message,
      priority
    )
    SELECT 
      p.user_id,
      'security_alert',
      'Evento de segurança detectado: ' || NEW.event_type,
      'high'
    FROM profiles p 
    WHERE p.role = 'admin';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER security_event_trigger
  AFTER INSERT ON security_logs
  FOR EACH ROW
  EXECUTE FUNCTION notify_security_event();
```

## Backup e Recuperação

### Estratégia de Backup
```typescript
// Edge Function para backup automático
export const handler = async () => {
  // Backup de configurações críticas
  const configs = await supabase
    .from('paygo_config')
    .select('*');
    
  const backupData = {
    timestamp: new Date().toISOString(),
    configs: configs.data,
    // Não incluir chaves sensíveis no backup
  };
  
  // Armazenar em local seguro
  await storeSecureBackup(backupData);
};
```

### Recuperação de Desastres
1. **Backup diário** das configurações
2. **Replicação** da base de dados
3. **Plano de contingência** para falhas de pagamento
4. **Documentação** dos procedimentos de recuperação

## Checklist de Segurança

### Desenvolvimento
- [ ] RLS habilitado em todas as tabelas
- [ ] Validação de input implementada
- [ ] Secrets não expostos no frontend
- [ ] HTTPS obrigatório para APIs externas
- [ ] Logs de auditoria implementados

### Produção
- [ ] Firewall configurado corretamente
- [ ] Certificados SSL válidos
- [ ] Monitoramento de segurança ativo
- [ ] Backup automático funcionando
- [ ] Plano de resposta a incidentes

### Dispositivo
- [ ] App assinado com certificado válido
- [ ] Proteção contra debugging
- [ ] Verificação de integridade do dispositivo
- [ ] Criptografia de dados locais

## Resposta a Incidentes

### Procedimento Padrão
1. **Detecção** - Monitoramento automático
2. **Contenção** - Isolar sistema afetado
3. **Análise** - Investigar causa raiz
4. **Recuperação** - Restaurar operação normal
5. **Documentação** - Registrar lições aprendidas

### Contatos de Emergência
- **Suporte Técnico:** suporte@toplavanderia.com
- **Segurança:** security@toplavanderia.com
- **PayGO Suporte:** [contato-paygo]
- **Supabase Status:** https://status.supabase.com

## Conformidade

### LGPD (Lei Geral de Proteção de Dados)
- Coleta mínima de dados pessoais
- Consentimento explícito do usuário
- Direito ao esquecimento implementado
- Política de privacidade clara

### PCI DSS (para pagamentos com cartão)
- Dados de cartão nunca armazenados localmente
- Comunicação criptografada com PayGO
- Logs de acesso a dados de pagamento
- Testes regulares de penetração