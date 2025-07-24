import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  CreditCard, 
  Settings, 
  Monitor, 
  Shield, 
  ArrowLeft,
  Activity,
  AlertTriangle
} from 'lucide-react';
import { TEFMonitorWidget } from './TEFMonitorWidget';
import { SecureTEFConfig } from './SecureTEFConfig';

interface TEFConfig {
  host: string;
  port: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

interface EnhancedTEFAdminProps {
  config: TEFConfig;
  onConfigChange: (config: TEFConfig) => void;
  onClose: () => void;
}

export const EnhancedTEFAdmin = ({ config, onConfigChange, onClose }: EnhancedTEFAdminProps) => {
  const [activeTab, setActiveTab] = useState<'monitor' | 'config'>('monitor');
  const [showConfig, setShowConfig] = useState(false);

  if (showConfig) {
    return (
      <SecureTEFConfig
        config={config}
        onConfigChange={onConfigChange}
        onClose={() => setShowConfig(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-clean p-4">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onClose}
              className="flex items-center gap-2"
            >
              <ArrowLeft size={16} />
              Voltar ao Totem
            </Button>
            <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center">
              <CreditCard className="text-primary-foreground" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Administração TEF</h1>
              <p className="text-muted-foreground">Sistema Elgin TEF - Monitoramento e Configuração</p>
            </div>
          </div>
          
          <Badge variant="outline" className="flex items-center gap-2">
            <Shield size={14} />
            Área Administrativa
          </Badge>
        </div>

        <Separator className="mb-6" />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'monitor' | 'config')}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="monitor" className="flex items-center gap-2">
              <Monitor size={16} />
              Monitor TEF
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Settings size={16} />
              Configurações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="monitor" className="space-y-6">
            <div className="grid gap-6">
              {/* Status Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity size={20} />
                    Status do Sistema TEF
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="text-center space-y-2">
                      <div className="text-2xl font-bold text-primary">
                        {config.host}:{config.port}
                      </div>
                      <div className="text-sm text-muted-foreground">Endpoint TEF</div>
                    </div>
                    <div className="text-center space-y-2">
                      <div className="text-2xl font-bold text-blue-600">
                        {config.timeout / 1000}s
                      </div>
                      <div className="text-sm text-muted-foreground">Timeout</div>
                    </div>
                    <div className="text-center space-y-2">
                      <div className="text-2xl font-bold text-green-600">
                        {config.retryAttempts}x
                      </div>
                      <div className="text-sm text-muted-foreground">Tentativas</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Monitor Widget */}
              <TEFMonitorWidget 
                config={config}
                onConfigClick={() => setShowConfig(true)}
              />
            </div>
          </TabsContent>

          <TabsContent value="config" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings size={20} />
                  Configurações do Sistema
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Warning */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="text-yellow-600 mt-0.5" size={16} />
                      <div className="text-sm text-yellow-800">
                        <p className="font-semibold">Atenção</p>
                        <p>
                          Alterações nas configurações TEF podem afetar o funcionamento do sistema de pagamento. 
                          Certifique-se de que possui as credenciais administrativas antes de prosseguir.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Current Config Display */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <h4 className="font-semibold">Configuração Atual</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Host:</span>
                          <span className="font-mono">{config.host}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Porta:</span>
                          <span className="font-mono">{config.port}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Timeout:</span>
                          <span className="font-mono">{config.timeout}ms</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tentativas:</span>
                          <span className="font-mono">{config.retryAttempts}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Delay:</span>
                          <span className="font-mono">{config.retryDelay}ms</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-semibold">Melhorias Implementadas</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          <span>Sistema de retry automático</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          <span>Monitoramento em tempo real</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          <span>Log detalhado de transações</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          <span>Recuperação automática de falhas</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          <span>Interface de cancelamento melhorada</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="pt-4">
                    <Button 
                      onClick={() => setShowConfig(true)}
                      variant="fresh"
                      className="w-full"
                    >
                      <Shield size={16} className="mr-2" />
                      Acessar Configurações Seguras
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};