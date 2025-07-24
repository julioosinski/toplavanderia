import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Save, Shield, Clock, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdminPinDialog } from "./AdminPinDialog";
import { useAdminAccess } from "@/hooks/useAdminAccess";

interface TEFConfig {
  host: string;
  port: string;
  timeout: number;
}

interface SecureTEFConfigProps {
  config: TEFConfig;
  onConfigChange: (config: TEFConfig) => void;
  onClose: () => void;
}

export const SecureTEFConfig = ({ config, onConfigChange, onClose }: SecureTEFConfigProps) => {
  const [tempConfig, setTempConfig] = useState(config);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const { toast } = useToast();
  const { isAuthenticated, authenticate, logout, renewSession, sessionTimeoutMs } = useAdminAccess();

  const handleSave = () => {
    if (!isAuthenticated) {
      setShowPinDialog(true);
      return;
    }

    // Validar configurações
    if (!tempConfig.host.trim()) {
      toast({
        title: "Erro de Validação",
        description: "IP do TEF é obrigatório",
        variant: "destructive"
      });
      return;
    }

    if (!tempConfig.port.trim() || isNaN(parseInt(tempConfig.port))) {
      toast({
        title: "Erro de Validação",
        description: "Porta deve ser um número válido",
        variant: "destructive"
      });
      return;
    }

    if (tempConfig.timeout < 5000 || tempConfig.timeout > 300000) {
      toast({
        title: "Erro de Validação",
        description: "Timeout deve estar entre 5 e 300 segundos",
        variant: "destructive"
      });
      return;
    }

    // Salvar configurações
    onConfigChange(tempConfig);
    toast({
      title: "Configurações Salvas",
      description: "Configurações TEF atualizadas com sucesso",
    });
    
    // Log de auditoria (em produção, isso deve ir para o backend)
    console.log(`[AUDIT] TEF Config changed by admin at ${new Date().toISOString()}`, {
      oldConfig: config,
      newConfig: tempConfig
    });
    
    onClose();
  };

  const handleAuthenticate = (pin: string) => {
    const success = authenticate(pin);
    if (success) {
      setSessionActive(true);
      toast({
        title: "Acesso Autorizado",
        description: `Sessão válida por ${sessionTimeoutMs / 60000} minutos`,
      });
    }
    return success;
  };

  const handleLogout = () => {
    logout();
    setSessionActive(false);
    onClose();
  };

  // Renovar sessão a cada interação
  const handleInteraction = () => {
    if (isAuthenticated) {
      renewSession();
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-clean flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-glow">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <Settings className="text-primary-foreground" size={24} />
            </div>
            <CardTitle className="text-xl flex items-center justify-center gap-2">
              <Shield size={20} />
              Configuração TEF Segura
            </CardTitle>
            
            {isAuthenticated && (
              <div className="flex items-center justify-center gap-2 text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">
                <Shield size={16} />
                Sessão Administrativa Ativa
              </div>
            )}
          </CardHeader>
          
          <CardContent className="space-y-4" onMouseMove={handleInteraction} onKeyDown={handleInteraction}>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="text-orange-600 mt-0.5" size={16} />
                <div className="text-sm text-orange-800">
                  <p className="font-semibold">Área Restrita</p>
                  <p>Configurações críticas do sistema de pagamento. Acesso apenas para administradores autorizados.</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="host">IP do TEF Elgin</Label>
              <Input 
                id="host"
                value={tempConfig.host}
                onChange={(e) => setTempConfig({...tempConfig, host: e.target.value})}
                placeholder="127.0.0.1"
                disabled={!isAuthenticated}
                className={!isAuthenticated ? "opacity-50" : ""}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="port">Porta</Label>
              <Input 
                id="port"
                value={tempConfig.port}
                onChange={(e) => setTempConfig({...tempConfig, port: e.target.value})}
                placeholder="4321"
                disabled={!isAuthenticated}
                className={!isAuthenticated ? "opacity-50" : ""}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="timeout">Timeout (ms)</Label>
              <Input 
                id="timeout"
                type="number"
                value={tempConfig.timeout}
                onChange={(e) => setTempConfig({...tempConfig, timeout: parseInt(e.target.value) || 60000})}
                placeholder="60000"
                min="5000"
                max="300000"
                disabled={!isAuthenticated}
                className={!isAuthenticated ? "opacity-50" : ""}
              />
              <p className="text-xs text-muted-foreground">
                Entre 5.000ms (5s) e 300.000ms (5min)
              </p>
            </div>
            
            <div className="flex space-x-2 pt-4">
              {isAuthenticated ? (
                <>
                  <Button onClick={handleSave} variant="fresh" className="flex-1">
                    <Save size={16} className="mr-2" />
                    Salvar
                  </Button>
                  <Button onClick={handleLogout} variant="outline" className="flex-1">
                    <Shield size={16} className="mr-2" />
                    Logout
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={() => setShowPinDialog(true)} variant="fresh" className="flex-1">
                    <Shield size={16} className="mr-2" />
                    Autenticar
                  </Button>
                  <Button onClick={onClose} variant="outline" className="flex-1">
                    Cancelar
                  </Button>
                </>
              )}
            </div>

            {isAuthenticated && (
              <div className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                <Clock size={12} />
                Sessão expira automaticamente em {sessionTimeoutMs / 60000} minutos
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AdminPinDialog
        open={showPinDialog}
        onOpenChange={setShowPinDialog}
        onAuthenticate={handleAuthenticate}
        title="Configurações TEF"
        description="Digite o PIN de administrador para acessar as configurações do sistema de pagamento"
      />
    </>
  );
};