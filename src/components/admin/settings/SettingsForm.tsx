import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wifi, Cpu, CreditCard, Save, Microchip, Database, Receipt, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ESP32ConfigurationManager from "../ESP32ConfigurationManager";
import { ESP32ConfigurationDialog } from "../ESP32ConfigurationDialog";
import { NFSeTestWidget } from "../NFSeTestWidget";
import { SystemSettings, type ESP32Configuration } from "@/hooks/useSystemSettings";
import { supabase } from "@/integrations/supabase/client";
import { useLaundry } from "@/contexts/LaundryContext";

interface SettingsFormProps {
  settings: SystemSettings;
  onUpdate: (updates: Partial<SystemSettings>) => void;
  isUpdating: boolean;
  /** false = operador: somente leitura (integrações bloqueadas) */
  canEdit?: boolean;
}

export const SettingsForm = ({ settings, onUpdate, isUpdating, canEdit = true }: SettingsFormProps) => {
  const [localSettings, setLocalSettings] = useState(settings);
  const { toast } = useToast();
  const { currentLaundry } = useLaundry();

  const updateSetting = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (!canEdit) return;
    onUpdate(localSettings);
    toast({
      title: "Configurações salvas",
      description: `Configurações de ${currentLaundry?.name} atualizadas com sucesso`,
    });
  };

  const handleESP32ConfigurationsUpdate = async (configs: ESP32Configuration[]) => {
    if (!canEdit) return;
    
    // Atualizar estado local
    updateSetting('esp32_configurations', configs);
    
    // Salvar no Supabase imediatamente
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({ 
          esp32_configurations: configs,
          updated_at: new Date().toISOString()
        })
        .eq('laundry_id', currentLaundry?.id);

      if (error) {
        console.error('Erro ao salvar ESP32 configs:', error);
        toast({
          title: "Erro ao salvar",
          description: "Não foi possível salvar as configurações ESP32",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Configurações Salvas",
        description: "ESP32s configurados com sucesso",
      });
      
      // Também chamar onUpdate para garantir que o hook seja atualizado
      onUpdate({ esp32_configurations: configs });
    } catch (error) {
      console.error('❌ Erro inesperado ao salvar:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao salvar configurações",
        variant: "destructive",
      });
    }
  };

  const addMockTransactions = async () => {
    if (!canEdit) return;
    try {
      const { data: machines } = await supabase
        .from('machines')
        .select('id, name')
        .eq('laundry_id', currentLaundry?.id)
        .limit(3);
        
      if (!machines || machines.length === 0) {
        toast({
          title: "Erro",
          description: "Nenhuma máquina encontrada para criar transações",
          variant: "destructive"
        });
        return;
      }

      const mockTransactions = [];
      const today = new Date();
      
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        const dailyTransactions = Math.floor(Math.random() * 6);
        
        for (let j = 0; j < dailyTransactions; j++) {
          const machine = machines[Math.floor(Math.random() * machines.length)];
          const amount = Number((Math.random() * 50 + 15).toFixed(2));
          const weight = Number((Math.random() * 8 + 2).toFixed(1));
          const duration = Math.floor(Math.random() * 30 + 25);
          
          const createdAt = new Date(date);
          createdAt.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
          
          const startedAt = new Date(createdAt);
          startedAt.setMinutes(startedAt.getMinutes() + Math.floor(Math.random() * 10));
          
          const completedAt = new Date(startedAt);
          completedAt.setMinutes(completedAt.getMinutes() + duration);
          
          mockTransactions.push({
            machine_id: machine.id,
            laundry_id: currentLaundry?.id,
            user_id: null,
            weight_kg: weight,
            duration_minutes: duration,
            total_amount: amount,
            payment_method: Math.random() > 0.5 ? 'credit_card' : 'cash',
            status: 'completed',
            created_at: createdAt.toISOString(),
            started_at: startedAt.toISOString(),
            completed_at: completedAt.toISOString()
          });
        }
      }

      const { error } = await supabase.from('transactions').insert(mockTransactions);
      
      if (error) throw error;

      toast({
        title: "Transações Criadas",
        description: `${mockTransactions.length} transações de teste foram adicionadas`,
      });
    } catch (error) {
      console.error('Error creating mock transactions:', error);
      toast({
        title: "Erro",
        description: "Falha ao criar transações de teste",
        variant: "destructive"
      });
    }
  };

  return (
    <>
      {!canEdit && (
        <Alert className="mb-4 border-amber-200 bg-amber-50 dark:bg-amber-950/30">
          <AlertDescription>
            Perfil <strong>operador</strong>: visualização das configurações. Para alterar integrações (PayGO,
            ESP32, NFSe), peça a um <strong>administrador</strong>.
          </AlertDescription>
        </Alert>
      )}
      <fieldset disabled={!canEdit} className="min-w-0 border-0 p-0 m-0 disabled:opacity-[0.92]">
        <div className="space-y-6">
      {/* Network Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Wifi className="text-primary" />
            <span>Configurações de Rede</span>
          </CardTitle>
          <CardDescription>
            Configure as informações de rede Wi-Fi e conectividade
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="wifi-ssid">Nome da Rede Wi-Fi (SSID)</Label>
              <Input
                id="wifi-ssid"
                value={localSettings.wifi_ssid || ''}
                onChange={(e) => updateSetting('wifi_ssid', e.target.value)}
                placeholder="Nome da rede Wi-Fi"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wifi-password">Senha do Wi-Fi</Label>
              <Input
                id="wifi-password"
                type="password"
                value={localSettings.wifi_password || ''}
                onChange={(e) => updateSetting('wifi_password', e.target.value)}
                placeholder="Senha da rede Wi-Fi"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ESP32 Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Cpu className="text-primary" />
            <span>Configurações do ESP32</span>
          </CardTitle>
          <CardDescription>
            Configure a comunicação com os controladores ESP32
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="esp32-host">Endereço IP/Host do ESP32</Label>
              <Input
                id="esp32-host"
                value={localSettings.esp32_host || ''}
                onChange={(e) => updateSetting('esp32_host', e.target.value)}
                placeholder="192.168.1.100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="esp32-port">Porta de Comunicação</Label>
              <Input
                id="esp32-port"
                type="number"
                min="1"
                max="65535"
                value={localSettings.esp32_port}
                onChange={(e) => updateSetting('esp32_port', parseInt(e.target.value) || 80)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SiTef/TPGWeb Payment Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CreditCard className="text-primary" />
            <span>Integração de Pagamentos (SiTef/TPGWeb)</span>
          </CardTitle>
          <CardDescription>
            Configure a conexão com o gateway SiTef/TPGWeb para processar pagamentos via pinpad PPC930
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Habilitar Pagamentos</p>
              <p className="text-sm text-muted-foreground">
                Ativa a integração com a maquininha de cartão via SiTef
              </p>
            </div>
            <Switch
              checked={localSettings.paygo_enabled || false}
              onCheckedChange={(checked) => updateSetting('paygo_enabled', checked)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sitef-host">Endereço do Servidor</Label>
              <Input
                id="sitef-host"
                value={localSettings.paygo_host || ''}
                onChange={(e) => updateSetting('paygo_host', e.target.value)}
                placeholder="pos-transac-sb.tpgweb.io"
              />
              <p className="text-xs text-muted-foreground">
                Endereço fornecido pela credenciadora (ex: pos-transac-sb.tpgweb.io)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sitef-port">Porta</Label>
              <Input
                id="sitef-port"
                type="number"
                min="1"
                max="65535"
                value={localSettings.paygo_port || 31735}
                onChange={(e) => updateSetting('paygo_port', parseInt(e.target.value) || 31735)}
              />
              <p className="text-xs text-muted-foreground">
                Porta do servidor SiTef (sandbox: 31735)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sitef-ponto-captura">Ponto de Captura</Label>
              <Input
                id="sitef-ponto-captura"
                value={localSettings.tef_terminal_id || ''}
                onChange={(e) => updateSetting('tef_terminal_id', e.target.value)}
                placeholder="102251"
              />
              <p className="text-xs text-muted-foreground">
                Código do ponto de captura fornecido pela credenciadora
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sitef-senha">Senha Técnica</Label>
              <Input
                id="sitef-senha"
                type="password"
                value={localSettings.paygo_automation_key || ''}
                onChange={(e) => updateSetting('paygo_automation_key', e.target.value)}
                placeholder="Senha fornecida pela credenciadora"
              />
              <p className="text-xs text-muted-foreground">
                Senha técnica para autenticação no SiTef
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sitef-cnpj">CNPJ de Instalação</Label>
              <Input
                id="sitef-cnpj"
                value={localSettings.paygo_cnpj_cpf || ''}
                onChange={(e) => updateSetting('paygo_cnpj_cpf', e.target.value)}
                placeholder="43652666000137"
              />
              <p className="text-xs text-muted-foreground">
                CNPJ cadastrado na credenciadora (apenas números)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sitef-timeout">Timeout (ms)</Label>
              <Input
                id="sitef-timeout"
                type="number"
                min="5000"
                max="120000"
                value={localSettings.paygo_timeout || 30000}
                onChange={(e) => updateSetting('paygo_timeout', parseInt(e.target.value) || 30000)}
              />
              <p className="text-xs text-muted-foreground">Tempo máximo de espera</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sitef-retry">Tentativas</Label>
              <Input
                id="sitef-retry"
                type="number"
                min="1"
                max="10"
                value={localSettings.paygo_retry_attempts || 3}
                onChange={(e) => updateSetting('paygo_retry_attempts', parseInt(e.target.value) || 3)}
              />
              <p className="text-xs text-muted-foreground">Retentativas em caso de falha</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sitef-retry-delay">Delay entre tentativas (ms)</Label>
              <Input
                id="sitef-retry-delay"
                type="number"
                min="500"
                max="10000"
                value={localSettings.paygo_retry_delay || 2000}
                onChange={(e) => updateSetting('paygo_retry_delay', parseInt(e.target.value) || 2000)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sitef-extra-config">Configuração Adicional (JSON)</Label>
              <Input
                id="sitef-extra-config"
                value={localSettings.tef_config || ''}
                onChange={(e) => updateSetting('tef_config', e.target.value)}
                placeholder='{"ambiente": "sandbox"}'
              />
              <p className="text-xs text-muted-foreground">
                Configurações extras em formato JSON (opcional)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-provider">Provedor de Pagamento</Label>
              <Select
                value={localSettings.paygo_provedor || 'paygo'}
                onValueChange={(value) => updateSetting('paygo_provedor', value)}
              >
                <SelectTrigger id="payment-provider">
                  <SelectValue placeholder="Selecione o provedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paygo">PayGo (padrão)</SelectItem>
                  <SelectItem value="cielo">Cielo LIO</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Define qual SDK nativo o tablet usará para processar pagamentos
              </p>
            </div>
          </div>

          {/* Cielo LIO Credentials — visible only when provider = cielo */}
          {(localSettings.paygo_provedor === 'cielo') && (
            <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
              <h4 className="text-sm font-semibold">Credenciais Cielo LIO</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cielo-client-id">Client ID</Label>
                  <Input
                    id="cielo-client-id"
                    value={localSettings.cielo_client_id || ''}
                    onChange={(e) => updateSetting('cielo_client_id', e.target.value)}
                    placeholder="Cielo Client ID"
                  />
                  <p className="text-xs text-muted-foreground">
                    Obtido no portal de desenvolvedores Cielo
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cielo-access-token">Access Token</Label>
                  <Input
                    id="cielo-access-token"
                    type="password"
                    value={localSettings.cielo_access_token || ''}
                    onChange={(e) => updateSetting('cielo_access_token', e.target.value)}
                    placeholder="Token de acesso"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cielo-merchant-code">Código do Estabelecimento (EC)</Label>
                  <Input
                    id="cielo-merchant-code"
                    value={localSettings.cielo_merchant_code || ''}
                    onChange={(e) => updateSetting('cielo_merchant_code', e.target.value)}
                    placeholder="Ex: 1234567890"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cielo-environment">Ambiente</Label>
                  <Select
                    value={localSettings.cielo_environment || 'sandbox'}
                    onValueChange={(value) => updateSetting('cielo_environment', value)}
                  >
                    <SelectTrigger id="cielo-environment">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sandbox">Sandbox (teste)</SelectItem>
                      <SelectItem value="production">Produção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Features */}
      <Card>
        <CardHeader>
          <CardTitle>Funcionalidades do Sistema</CardTitle>
          <CardDescription>
            Configure o comportamento do sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Modo automático</p>
              <p className="text-sm text-muted-foreground">
                Inicia automaticamente quando detecta carga
              </p>
            </div>
            <Switch
              checked={localSettings.auto_mode}
              onCheckedChange={(checked) => updateSetting('auto_mode', checked)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Notificações</p>
              <p className="text-sm text-muted-foreground">
                Alertas por email sobre manutenção e problemas
              </p>
            </div>
            <Switch
              checked={localSettings.notifications_enabled}
              onCheckedChange={(checked) => updateSetting('notifications_enabled', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* ESP32 Monitoring Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Monitoramento ESP32</CardTitle>
          <CardDescription>
            Configure o monitoramento automático dos controladores ESP32
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Monitoramento ESP32</p>
              <p className="text-sm text-muted-foreground">
                Habilitar monitoramento automático do ESP32
              </p>
            </div>
            <Switch
              checked={localSettings.enable_esp32_monitoring || false}
              onCheckedChange={(checked) => updateSetting('enable_esp32_monitoring', checked)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="heartbeat-interval">Intervalo de Heartbeat (segundos)</Label>
              <Input
                id="heartbeat-interval"
                type="number"
                min="10"
                max="300"
                value={localSettings.heartbeat_interval_seconds || 30}
                onChange={(e) => updateSetting('heartbeat_interval_seconds', parseInt(e.target.value))}
              />
              <p className="text-sm text-muted-foreground">
                Frequência de verificação (10-300s)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="offline-duration">Tempo Máx. Offline (min)</Label>
              <Input
                id="offline-duration"
                type="number"
                min="1"
                max="60"
                value={localSettings.max_offline_duration_minutes || 5}
                onChange={(e) => updateSetting('max_offline_duration_minutes', parseInt(e.target.value))}
              />
              <p className="text-sm text-muted-foreground">
                Tempo antes de marcar offline
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="signal-threshold">Limite Sinal WiFi (dBm)</Label>
              <Input
                id="signal-threshold"
                type="number"
                min="-100"
                max="-30"
                value={localSettings.signal_threshold_warning || -70}
                onChange={(e) => updateSetting('signal_threshold_warning', parseInt(e.target.value))}
              />
              <p className="text-sm text-muted-foreground">
                Limite para alerta sinal fraco
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ESP32 Device Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Microchip className="text-primary" />
                <span>Gerenciamento de Dispositivos ESP32</span>
              </CardTitle>
              <CardDescription>
                Configure e gerencie múltiplos controladores ESP32 para diferentes conjuntos de máquinas
              </CardDescription>
            </div>
            <ESP32ConfigurationDialog />
          </div>
        </CardHeader>
        <CardContent>
          <ESP32ConfigurationManager 
            configurations={localSettings.esp32_configurations || []}
            onUpdate={handleESP32ConfigurationsUpdate}
          />
        </CardContent>
      </Card>

      {/* NFSe Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Receipt className="text-primary" />
            <span>Integração Nota Fiscal de Serviço (NFSe)</span>
          </CardTitle>
          <CardDescription>
            Configure a integração automática com emissão de NFSe via Zapier
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Habilitar NFSe Automática</p>
              <p className="text-sm text-muted-foreground">
                Emite automaticamente NFSe para transações concluídas
              </p>
            </div>
            <Switch
              checked={localSettings.nfse_enabled || false}
              onCheckedChange={(checked) => updateSetting('nfse_enabled', checked)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Nome da Empresa</Label>
              <Input
                id="company-name"
                value={localSettings.company_name || ''}
                onChange={(e) => updateSetting('company_name', e.target.value)}
                placeholder="Nome da pousada/empresa"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-cnpj">CNPJ da Empresa</Label>
              <Input
                id="company-cnpj"
                value={localSettings.company_cnpj || ''}
                onChange={(e) => updateSetting('company_cnpj', e.target.value)}
                placeholder="00.000.000/0001-00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-email">Email da Empresa</Label>
              <Input
                id="company-email"
                type="email"
                value={localSettings.company_email || ''}
                onChange={(e) => updateSetting('company_email', e.target.value)}
                placeholder="contato@pousada.com.br"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="zapier-webhook">
              <Zap className="inline w-4 h-4 mr-1" />
              Zapier Webhook URL
            </Label>
            <Input
              id="zapier-webhook"
              value={localSettings.zapier_webhook_url || ''}
              onChange={(e) => updateSetting('zapier_webhook_url', e.target.value)}
              placeholder="https://hooks.zapier.com/hooks/catch/..."
            />
            <p className="text-sm text-muted-foreground">
              1. Crie um Zap no Zapier com trigger "Webhooks by Zapier"<br/>
              2. Conecte com seu provedor de NFSe (EasyGestor, TiraNota, etc.)<br/>
              3. Cole aqui a URL do webhook gerada pelo Zapier
            </p>
          </div>
        </CardContent>
      </Card>

      {/* NFSe Test Widget */}
      {canEdit && localSettings.nfse_enabled && (
        <NFSeTestWidget
          webhookUrl={localSettings.zapier_webhook_url || ''}
          companyName={localSettings.company_name || ''}
          companyCnpj={localSettings.company_cnpj || ''}
          companyEmail={localSettings.company_email || ''}
        />
      )}

      {/* Development Tools */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="text-primary" />
            <span>Ferramentas de Desenvolvimento</span>
          </CardTitle>
          <CardDescription>
            Ferramentas para testes e desenvolvimento do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Transações de Teste</p>
                <p className="text-sm text-muted-foreground">
                  Adiciona transações fictícias dos últimos 30 dias para testar relatórios
                </p>
              </div>
              <Button variant="outline" onClick={addMockTransactions}>
                Adicionar Dados de Teste
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isUpdating || !canEdit} className="min-w-32">
          <Save size={16} className="mr-2" />
          {isUpdating ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>
        </div>
      </fieldset>
    </>
  );
};
