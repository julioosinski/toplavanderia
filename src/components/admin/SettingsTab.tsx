import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Wifi, Cpu, CreditCard, Save, Microchip, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ESP32ConfigurationManager from "./ESP32ConfigurationManager";

interface SystemSettings {
  id: string;
  wifi_ssid?: string;
  wifi_password?: string;
  esp32_host?: string;
  esp32_port: number;
  tef_terminal_id?: string;
  tef_config?: string;
  default_cycle_time: number;
  default_price: number;
  auto_mode: boolean;
  notifications_enabled: boolean;
  heartbeat_interval_seconds?: number;
  max_offline_duration_minutes?: number;
  signal_threshold_warning?: number;
  enable_esp32_monitoring?: boolean;
  esp32_configurations?: any[];
}

interface ESP32Config {
  id: string;
  name: string;
  host: string;
  port: number;
  location: string;
  machines: string[];
}

export const SettingsTab = () => {
  const [settings, setSettings] = useState<SystemSettings>({
    id: '',
    wifi_ssid: '',
    wifi_password: '',
    esp32_host: '',
    esp32_port: 80,
    tef_terminal_id: '',
    tef_config: '',
    default_cycle_time: 40,
    default_price: 5.00,
    auto_mode: false,
    notifications_enabled: true,
    heartbeat_interval_seconds: 30,
    max_offline_duration_minutes: 5,
    signal_threshold_warning: -70,
    enable_esp32_monitoring: true,
    esp32_configurations: []
  });
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        setSettings({
          ...data[0],
          esp32_configurations: Array.isArray(data[0].esp32_configurations) 
            ? data[0].esp32_configurations 
            : []
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar configurações",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaveLoading(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({
          ...settings,
          updated_at: new Date().toISOString()
        })
        .eq('id', settings.id);

      if (error) throw error;

      toast({
        title: "Configurações salvas",
        description: "As configurações foram atualizadas com sucesso",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Erro",
        description: "Falha ao salvar configurações",
        variant: "destructive"
      });
    } finally {
      setSaveLoading(false);
    }
  };

  const updateSetting = (key: keyof SystemSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleESP32ConfigurationsUpdate = async (configs: ESP32Config[]) => {
    updateSetting('esp32_configurations', configs);
    
    // Salvar automaticamente no Supabase
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({
          esp32_configurations: configs as any,
          updated_at: new Date().toISOString()
        })
        .eq('id', settings.id);

      if (error) throw error;

      toast({
        title: "Configurações ESP32 salvas",
        description: "As configurações dos ESP32s foram atualizadas com sucesso",
      });
    } catch (error) {
      console.error('Error saving ESP32 configurations:', error);
      toast({
        title: "Erro",
        description: "Falha ao salvar configurações ESP32",
        variant: "destructive"
      });
    }
  };

  const addMockTransactions = async () => {
    try {
      const { data: machines } = await supabase.from('machines').select('id, name').limit(3);
      if (!machines || machines.length === 0) {
        toast({
          title: "Erro",
          description: "Nenhuma máquina encontrada para criar transações",
          variant: "destructive"
        });
        return;
      }

      // Create mock transactions for the last 30 days
      const mockTransactions = [];
      const today = new Date();
      
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        // Random number of transactions per day (0-5)
        const dailyTransactions = Math.floor(Math.random() * 6);
        
        for (let j = 0; j < dailyTransactions; j++) {
          const machine = machines[Math.floor(Math.random() * machines.length)];
          const amount = Number((Math.random() * 50 + 15).toFixed(2)); // $15-$65
          const weight = Number((Math.random() * 8 + 2).toFixed(1)); // 2-10 kg
          const duration = Math.floor(Math.random() * 30 + 25); // 25-55 minutes
          
          const createdAt = new Date(date);
          createdAt.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
          
          const startedAt = new Date(createdAt);
          startedAt.setMinutes(startedAt.getMinutes() + Math.floor(Math.random() * 10));
          
          const completedAt = new Date(startedAt);
          completedAt.setMinutes(completedAt.getMinutes() + duration);
          
          mockTransactions.push({
            machine_id: machine.id,
            user_id: null, // Anonymous for testing
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Settings className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Carregando configurações...</p>
        </div>
      </div>
    );
  }

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
                value={settings.wifi_ssid || ''}
                onChange={(e) => updateSetting('wifi_ssid', e.target.value)}
                placeholder="Nome da rede Wi-Fi"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wifi-password">Senha do Wi-Fi</Label>
              <Input
                id="wifi-password"
                type="password"
                value={settings.wifi_password || ''}
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
                value={settings.esp32_host || ''}
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
                value={settings.esp32_port}
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
                value={settings.tef_terminal_id || ''}
                onChange={(e) => updateSetting('tef_terminal_id', e.target.value)}
                placeholder="ID do terminal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tef-config">Configuração TEF</Label>
              <Input
                id="tef-config"
                value={settings.tef_config || ''}
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
              checked={settings.auto_mode}
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
              checked={settings.notifications_enabled}
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
              checked={settings.enable_esp32_monitoring || false}
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
                value={settings.heartbeat_interval_seconds || 30}
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
                value={settings.max_offline_duration_minutes || 5}
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
                value={settings.signal_threshold_warning || -70}
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
            configurations={settings.esp32_configurations || []}
            onUpdate={handleESP32ConfigurationsUpdate}
          />
        </CardContent>
      </Card>

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
        <Button onClick={saveSettings} disabled={saveLoading} className="min-w-32">
          <Save size={16} className="mr-2" />
          {saveLoading ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>
    </div>
  );
};