import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Wifi, Cpu, CreditCard, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
    notifications_enabled: true
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
        setSettings(data[0]);
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

      <Separator />

      {/* Default Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="text-primary" />
            <span>Configurações Padrão</span>
          </CardTitle>
          <CardDescription>
            Configure os valores padrão para novas máquinas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="default-price">Preço padrão por kg (R$)</Label>
              <Input
                id="default-price"
                type="number"
                step="0.01"
                min="0"
                value={settings.default_price}
                onChange={(e) => updateSetting('default_price', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="default-duration">Duração padrão do ciclo (min)</Label>
              <Input
                id="default-duration"
                type="number"
                min="1"
                max="180"
                value={settings.default_cycle_time}
                onChange={(e) => updateSetting('default_cycle_time', parseInt(e.target.value) || 0)}
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