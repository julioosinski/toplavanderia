import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Settings, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { usePayGOIntegration, PayGOConfig } from '@/hooks/usePayGOIntegration';
import { usePayGOHealthMonitor } from '@/hooks/usePayGOHealthMonitor';
import { getPayGOStatusColor, getPayGOStatusText, formatPayGOAmount } from '@/lib/paygoUtils';

interface PayGOMonitorWidgetProps {
  config: PayGOConfig;
  onConfigClick: () => void;
}

interface TransactionLog {
  id: string;
  timestamp: Date;
  amount: number;
  status: 'approved' | 'denied' | 'cancelled' | 'error';
  nsu?: string;
  errorMessage?: string;
}

export const PayGOMonitorWidget: React.FC<PayGOMonitorWidgetProps> = ({
  config,
  onConfigClick,
}) => {
  const [transactionLogs, setTransactionLogs] = useState<TransactionLog[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { status, isProcessing, checkPayGOStatus, testConnection } = usePayGOIntegration(config);
  const { metrics, isMonitoring } = usePayGOHealthMonitor(config, true);

  useEffect(() => {
    const interval = setInterval(() => {
      checkPayGOStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, [checkPayGOStatus]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await checkPayGOStatus();
    setIsRefreshing(false);
  };

  const getStatusColor = (isOnline: boolean): string => {
    return isOnline ? 'text-green-600' : 'text-red-600';
  };

  const getStatusText = (isOnline: boolean): string => {
    return isOnline ? 'Online' : 'Offline';
  };

  const formatTimestamp = (date: Date): string => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  return (
    <div className="space-y-6">
      {/* PayGO Status Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Status PayGO Elgin</CardTitle>
              <CardDescription>
                Monitoramento do sistema de pagamento PayGO
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing || isMonitoring}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button variant="outline" size="sm" onClick={onConfigClick}>
                <Settings className="h-4 w-4 mr-2" />
                Configurar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connection Details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Host</p>
              <p className="text-sm font-mono">{config.host}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Porta</p>
              <p className="text-sm font-mono">{config.port}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <div className="flex items-center gap-2">
                {status.online ? (
                  <Wifi className="h-4 w-4 text-green-600" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-600" />
                )}
                <Badge variant="outline" className={getStatusColor(status.online)}>
                  {getStatusText(status.online)}
                </Badge>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Inicializado</p>
              <Badge variant={status.initialized ? "default" : "secondary"}>
                {status.initialized ? 'Sim' : 'Não'}
              </Badge>
            </div>
          </div>

          {/* Health Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Saúde do Sistema</p>
              <Badge className={getPayGOStatusColor(metrics.status)}>
                {getPayGOStatusText(metrics.status)}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Latência</p>
              <p className="text-sm">{metrics.latency}ms</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Taxa de Erro</p>
              <p className="text-sm">{(metrics.errorRate * 100).toFixed(1)}%</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Falhas Consecutivas</p>
              <p className="text-sm">{status.consecutiveFailures}</p>
            </div>
          </div>

          {/* Version and Last Check */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Versão</p>
              <p className="text-sm">{status.version || 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Última Verificação</p>
              <p className="text-sm">{formatTimestamp(status.lastCheck)}</p>
            </div>
          </div>

          {/* Warnings */}
          {status.consecutiveFailures > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Sistema PayGO instável. {status.consecutiveFailures} falha(s) consecutiva(s).
              </AlertDescription>
            </Alert>
          )}

          {/* Processing Indicator */}
          {isProcessing && (
            <Alert>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <AlertDescription>
                Processando transação PayGO...
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Recent Transaction Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Transações Recentes</CardTitle>
          <CardDescription>
            Histórico das últimas transações PayGO
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactionLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma transação registrada
            </p>
          ) : (
            <div className="space-y-2">
              {transactionLogs.slice(0, 10).map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge 
                      variant={log.status === 'approved' ? 'default' : 'destructive'}
                    >
                      {log.status === 'approved' ? 'Aprovada' : 
                       log.status === 'denied' ? 'Negada' : 
                       log.status === 'cancelled' ? 'Cancelada' : 'Erro'}
                    </Badge>
                    <span className="font-medium">{formatPayGOAmount(log.amount)}</span>
                    {log.nsu && (
                      <span className="text-sm text-muted-foreground">NSU: {log.nsu}</span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm">{formatTimestamp(log.timestamp)}</p>
                    {log.errorMessage && (
                      <p className="text-xs text-red-600">{log.errorMessage}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};