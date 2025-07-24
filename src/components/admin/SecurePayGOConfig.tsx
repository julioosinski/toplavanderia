import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Shield, ShieldCheck, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { AdminPinDialog } from './AdminPinDialog';
import { PayGOConfig } from '@/hooks/usePayGOIntegration';
import { validatePayGOConfig, formatCnpjCpf, isValidCnpjCpf } from '@/lib/paygoUtils';

interface SecurePayGOConfigProps {
  config: PayGOConfig;
  onConfigChange: (config: PayGOConfig) => void;
  onClose: () => void;
}

export const SecurePayGOConfig: React.FC<SecurePayGOConfigProps> = ({
  config,
  onConfigChange,
  onClose,
}) => {
  const [tempConfig, setTempConfig] = useState<PayGOConfig>(config);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const { toast } = useToast();
  const { isAuthenticated, authenticate, renewSession, logout } = useAdminAccess();

  useEffect(() => {
    setSessionActive(isAuthenticated);
  }, [isAuthenticated]);

  const handleSave = () => {
    if (!sessionActive) {
      setShowPinDialog(true);
      return;
    }

    const errors = validatePayGOConfig(tempConfig);
    if (errors.length > 0) {
      toast({
        title: "Configuração inválida",
        description: errors.join(', '),
        variant: "destructive",
      });
      return;
    }

    onConfigChange(tempConfig);
    onClose();
    
    toast({
      title: "Configuração salva",
      description: "Configurações PayGO foram atualizadas com sucesso.",
    });
  };

  const handleAuthenticate = (pin: string): boolean => {
    const success = authenticate(pin);
    if (success) {
      setSessionActive(true);
      setShowPinDialog(false);
      toast({
        title: "Autenticado com sucesso",
        description: "Acesso administrativo concedido.",
      });
    }
    return success;
  };

  const handleLogout = () => {
    logout();
    setSessionActive(false);
    onClose();
  };

  const handleInteraction = () => {
    if (sessionActive) {
      renewSession();
    }
  };

  const handleCnpjCpfChange = (value: string) => {
    const formatted = formatCnpjCpf(value);
    setTempConfig(prev => ({ ...prev, cnpjCpf: formatted }));
  };

  const minutesUntilExpiry = 15; // Fixed 15 minutes for demo

  return (
    <Card className="w-full max-w-2xl mx-auto" onClick={handleInteraction}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {sessionActive ? (
                <ShieldCheck className="h-5 w-5 text-green-600" />
              ) : (
                <Shield className="h-5 w-5 text-red-600" />
              )}
              Configuração Segura PayGO
            </CardTitle>
            <CardDescription>
              Configure os parâmetros do sistema PayGO Elgin
            </CardDescription>
          </div>
          {sessionActive && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {minutesUntilExpiry}min restantes
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Authentication Status */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status da Sessão:</span>
            <Badge variant={sessionActive ? "default" : "secondary"}>
              {sessionActive ? "Autenticado" : "Não Autenticado"}
            </Badge>
          </div>
          {sessionActive && (
            <span className="text-xs text-muted-foreground">
              Expira em {minutesUntilExpiry} minutos
            </span>
          )}
        </div>

        {/* Configuration Fields */}
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="host">Host/IP do PayGO</Label>
              <Input
                id="host"
                value={tempConfig.host}
                onChange={(e) => setTempConfig(prev => ({ ...prev, host: e.target.value }))}
                placeholder="127.0.0.1"
                disabled={!sessionActive}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Porta</Label>
              <Input
                id="port"
                type="number"
                value={tempConfig.port}
                onChange={(e) => setTempConfig(prev => ({ ...prev, port: parseInt(e.target.value) || 8080 }))}
                placeholder="8080"
                disabled={!sessionActive}
                min="1"
                max="65535"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="automationKey">Chave de Automação</Label>
            <Input
              id="automationKey"
              type="password"
              value={tempConfig.automationKey}
              onChange={(e) => setTempConfig(prev => ({ ...prev, automationKey: e.target.value }))}
              placeholder="Chave de acesso da API"
              disabled={!sessionActive}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cnpjCpf">CNPJ/CPF do Estabelecimento</Label>
            <Input
              id="cnpjCpf"
              value={tempConfig.cnpjCpf}
              onChange={(e) => handleCnpjCpfChange(e.target.value)}
              placeholder="00.000.000/0000-00 ou 000.000.000-00"
              disabled={!sessionActive}
              className={!isValidCnpjCpf(tempConfig.cnpjCpf) && tempConfig.cnpjCpf ? 'border-red-500' : ''}
            />
            {tempConfig.cnpjCpf && !isValidCnpjCpf(tempConfig.cnpjCpf) && (
              <p className="text-sm text-red-600">CNPJ/CPF deve ter 11 ou 14 dígitos</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="timeout">Timeout (ms)</Label>
              <Input
                id="timeout"
                type="number"
                value={tempConfig.timeout}
                onChange={(e) => setTempConfig(prev => ({ ...prev, timeout: parseInt(e.target.value) || 30000 }))}
                placeholder="30000"
                disabled={!sessionActive}
                min="1000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="retryAttempts">Tentativas</Label>
              <Input
                id="retryAttempts"
                type="number"
                value={tempConfig.retryAttempts}
                onChange={(e) => setTempConfig(prev => ({ ...prev, retryAttempts: parseInt(e.target.value) || 3 }))}
                placeholder="3"
                disabled={!sessionActive}
                min="1"
                max="10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="retryDelay">Delay (ms)</Label>
              <Input
                id="retryDelay"
                type="number"
                value={tempConfig.retryDelay}
                onChange={(e) => setTempConfig(prev => ({ ...prev, retryDelay: parseInt(e.target.value) || 1000 }))}
                placeholder="1000"
                disabled={!sessionActive}
                min="100"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between pt-4 border-t">
          {sessionActive ? (
            <div className="flex gap-2">
              <Button onClick={handleSave}>
                Salvar Configurações
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                Sair
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button onClick={() => setShowPinDialog(true)}>
                Autenticar
              </Button>
            </div>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </CardContent>

      {/* PIN Dialog */}
      <AdminPinDialog
        open={showPinDialog}
        onOpenChange={setShowPinDialog}
        onAuthenticate={handleAuthenticate}
      />
    </Card>
  );
};