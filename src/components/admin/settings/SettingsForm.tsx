import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wifi, CreditCard, Save, Receipt, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { NFSeTestWidget } from "../NFSeTestWidget";
import { SystemSettings } from "@/hooks/useSystemSettings";
import { useLaundry } from "@/hooks/useLaundry";

interface SettingsFormProps {
  settings: SystemSettings;
  onUpdate: (updates: Partial<SystemSettings>) => void;
  isUpdating: boolean;
  canEdit?: boolean;
}

export const SettingsForm = ({ settings, onUpdate, isUpdating, canEdit = true }: SettingsFormProps) => {
  const [localSettings, setLocalSettings] = useState(settings);
  const { toast } = useToast();
  const { currentLaundry } = useLaundry();

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

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

  return (
    <>
      {!canEdit && (
        <Alert className="mb-4 border-amber-200 bg-amber-50 dark:bg-amber-950/30">
          <AlertDescription>
            Perfil <strong>operador</strong>: visualização das configurações. Para alterar, peça a um <strong>administrador</strong>.
          </AlertDescription>
        </Alert>
      )}
      <fieldset disabled={!canEdit} className="min-w-0 border-0 p-0 m-0 disabled:opacity-[0.92]">
        <div className="space-y-6">

      {/* Wi-Fi */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Wifi className="text-primary" />
            <span>Rede Wi-Fi</span>
          </CardTitle>
          <CardDescription>
            Wi-Fi pré-configurado no firmware dos ESP32
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="wifi-ssid">Nome da Rede (SSID)</Label>
              <Input
                id="wifi-ssid"
                value={localSettings.wifi_ssid || ''}
                onChange={(e) => updateSetting('wifi_ssid', e.target.value)}
                placeholder="Nome da rede Wi-Fi"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wifi-password">Senha</Label>
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

      {/* Pagamentos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CreditCard className="text-primary" />
            <span>Pagamentos</span>
          </CardTitle>
          <CardDescription>
            Integração com gateway de pagamentos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Habilitar Pagamentos</p>
              <p className="text-sm text-muted-foreground">
                Ativa a integração com a maquininha de cartão
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="sitef-ponto-captura">Ponto de Captura</Label>
              <Input
                id="sitef-ponto-captura"
                value={localSettings.tef_terminal_id || ''}
                onChange={(e) => updateSetting('tef_terminal_id', e.target.value)}
                placeholder="102251"
              />
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="sitef-cnpj">CNPJ de Instalação</Label>
              <Input
                id="sitef-cnpj"
                value={localSettings.paygo_cnpj_cpf || ''}
                onChange={(e) => updateSetting('paygo_cnpj_cpf', e.target.value)}
                placeholder="43652666000137"
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
            </div>
          </div>

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

      {/* Sistema */}
      <Card>
        <CardHeader>
          <CardTitle>Sistema</CardTitle>
          <CardDescription>Comportamento geral e monitoramento</CardDescription>
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

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Monitoramento ESP32</p>
              <p className="text-sm text-muted-foreground">
                Heartbeat e detecção de ESP32 offline
              </p>
            </div>
            <Switch
              checked={localSettings.enable_esp32_monitoring || false}
              onCheckedChange={(checked) => updateSetting('enable_esp32_monitoring', checked)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="heartbeat-interval">Heartbeat (seg)</Label>
              <Input
                id="heartbeat-interval"
                type="number"
                min="10"
                max="300"
                value={localSettings.heartbeat_interval_seconds || 30}
                onChange={(e) => updateSetting('heartbeat_interval_seconds', parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="offline-duration">Máx. Offline (min)</Label>
              <Input
                id="offline-duration"
                type="number"
                min="1"
                max="60"
                value={localSettings.max_offline_duration_minutes || 5}
                onChange={(e) => updateSetting('max_offline_duration_minutes', parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signal-threshold">Limite Sinal (dBm)</Label>
              <Input
                id="signal-threshold"
                type="number"
                min="-100"
                max="-30"
                value={localSettings.signal_threshold_warning || -70}
                onChange={(e) => updateSetting('signal_threshold_warning', parseInt(e.target.value))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* NFSe */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Receipt className="text-primary" />
            <span>Nota Fiscal (NFSe)</span>
          </CardTitle>
          <CardDescription>
            Emissão automática de NFSe via Zapier
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Habilitar NFSe Automática</p>
              <p className="text-sm text-muted-foreground">
                Emite automaticamente para transações concluídas
              </p>
            </div>
            <Switch
              checked={localSettings.nfse_enabled || false}
              onCheckedChange={(checked) => updateSetting('nfse_enabled', checked)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Empresa</Label>
              <Input
                id="company-name"
                value={localSettings.company_name || ''}
                onChange={(e) => updateSetting('company_name', e.target.value)}
                placeholder="Nome da empresa"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-cnpj">CNPJ</Label>
              <Input
                id="company-cnpj"
                value={localSettings.company_cnpj || ''}
                onChange={(e) => updateSetting('company_cnpj', e.target.value)}
                placeholder="00.000.000/0001-00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company-email">Email</Label>
            <Input
              id="company-email"
              type="email"
              value={localSettings.company_email || ''}
              onChange={(e) => updateSetting('company_email', e.target.value)}
              placeholder="contato@empresa.com.br"
            />
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

      {/* Salvar */}
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
