import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Wifi, Cpu, CreditCard, Save, Microchip, Database, Receipt, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ESP32ConfigurationManager from "../ESP32ConfigurationManager";
import { NFSeTestWidget } from "../NFSeTestWidget";
import { SystemSettings } from "@/hooks/useSystemSettings";
import { supabase } from "@/integrations/supabase/client";
import { useLaundry } from "@/contexts/LaundryContext";

interface SettingsFormProps {
  settings: SystemSettings;
  onUpdate: (updates: Partial<SystemSettings>) => void;
  isUpdating: boolean;
}

export const SettingsForm = ({ settings, onUpdate, isUpdating }: SettingsFormProps) => {
  const [localSettings, setLocalSettings] = useState(settings);
  const { toast } = useToast();
  const { currentLaundry } = useLaundry();

  const updateSetting = (key: keyof SystemSettings, value: any) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onUpdate(localSettings);
    toast({
      title: "Configurações salvas",
      description: `Configurações de ${currentLaundry?.name} atualizadas com sucesso`,
    });
  };

  const handleESP32ConfigurationsUpdate = async (configs: any[]) => {
    updateSetting('esp32_configurations', configs);
    onUpdate({ esp32_configurations: configs });
  };

  const addMockTransactions = async () => {
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

      {/* TEF Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CreditCard className="text-primary" />
            <span>Configurações TEF</span>
          </CardTitle>
          <CardDescription>
            Configure o Terminal Eletrônico Fiscal (TEF) para pagamentos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tef-terminal">ID do Terminal TEF</Label>
              <Input
                id="tef-terminal"
                value={localSettings.tef_terminal_id || ''}
                onChange={(e) => updateSetting('tef_terminal_id', e.target.value)}
                placeholder="ID do terminal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tef-config">Configuração TEF</Label>
              <Input
                id="tef-config"
                value={localSettings.tef_config || ''}
                onChange={(e) => updateSetting('tef_config', e.target.value)}
                placeholder="Configurações adicionais"
              />
            </div>
          </div>
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
          <CardTitle className="flex items-center space-x-2">
            <Microchip className="text-primary" />
            <span>Gerenciamento de Dispositivos ESP32</span>
          </CardTitle>
          <CardDescription>
            Configure e gerencie múltiplos controladores ESP32 para diferentes conjuntos de máquinas
          </CardDescription>
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
      {localSettings.nfse_enabled && (
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
        <Button onClick={handleSave} disabled={isUpdating} className="min-w-32">
          <Save size={16} className="mr-2" />
          {isUpdating ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>
    </div>
  );
};
