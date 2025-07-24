import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Shield, Settings, Activity, AlertTriangle } from 'lucide-react';
import { PayGOMonitorWidget } from './PayGOMonitorWidget';
import { SecurePayGOConfig } from './SecurePayGOConfig';
import { PayGOConfig } from '@/hooks/usePayGOIntegration';
import { usePayGOHealthMonitor } from '@/hooks/usePayGOHealthMonitor';
import { getPayGOStatusColor, getPayGOStatusText } from '@/lib/paygoUtils';

interface EnhancedPayGOAdminProps {
  config: PayGOConfig;
  onConfigChange: (config: PayGOConfig) => void;
  onClose: () => void;
}

export const EnhancedPayGOAdmin: React.FC<EnhancedPayGOAdminProps> = ({
  config,
  onConfigChange,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState('monitor');
  const [showConfig, setShowConfig] = useState(false);
  const { metrics } = usePayGOHealthMonitor(config, true);

  if (showConfig) {
    return (
      <SecurePayGOConfig
        config={config}
        onConfigChange={onConfigChange}
        onClose={() => setShowConfig(false)}
      />
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">PayGO Elgin - Administração</h1>
            <p className="text-muted-foreground">
              Sistema de gestão e monitoramento PayGO
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={getPayGOStatusColor(metrics.status)}>
            {getPayGOStatusText(metrics.status)}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {config.host}:{config.port}
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="monitor" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Monitor PayGO
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        {/* Monitor Tab */}
        <TabsContent value="monitor" className="space-y-6">
          {/* System Status Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Status do Sistema</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  <Badge className={getPayGOStatusColor(metrics.status)}>
                    {getPayGOStatusText(metrics.status)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Última verificação há {Math.floor((Date.now() - (metrics.lastSuccessfulTransaction?.getTime() || Date.now())) / 60000)} min
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Latência Média</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.latency}ms</div>
                <p className="text-xs text-muted-foreground">
                  Taxa de erro: {(metrics.errorRate * 100).toFixed(1)}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Falhas Consecutivas</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.consecutiveFailures}</div>
                <p className="text-xs text-muted-foreground">
                  Uptime: {metrics.uptime} verificações
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Monitor Widget */}
          <PayGOMonitorWidget
            config={config}
            onConfigClick={() => setShowConfig(true)}
          />
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações Atuais</CardTitle>
              <CardDescription>
                Visualize e gerencie as configurações do PayGO Elgin
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Host</p>
                  <p className="font-mono text-sm">{config.host}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Porta</p>
                  <p className="font-mono text-sm">{config.port}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Timeout</p>
                  <p className="font-mono text-sm">{config.timeout}ms</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Tentativas</p>
                  <p className="font-mono text-sm">{config.retryAttempts}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">CNPJ/CPF</p>
                  <p className="font-mono text-sm">{config.cnpjCpf || 'Não configurado'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Delay entre tentativas</p>
                  <p className="font-mono text-sm">{config.retryDelay}ms</p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">Melhorias no Sistema</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Monitoramento automático de saúde do sistema</li>
                  <li>• Recuperação automática em caso de falhas</li>
                  <li>• Logs detalhados de transações</li>
                  <li>• Configuração segura com autenticação</li>
                  <li>• Validação robusta de entrada</li>
                </ul>
              </div>

              <Button onClick={() => setShowConfig(true)} className="w-full">
                <Shield className="h-4 w-4 mr-2" />
                Acessar Configurações Seguras
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};