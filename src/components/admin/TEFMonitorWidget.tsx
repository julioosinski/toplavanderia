import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  CreditCard, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock,
  AlertTriangle,
  Activity,
  Settings
} from 'lucide-react';
import { useTEFIntegration } from '@/hooks/useTEFIntegration';

interface TEFMonitorWidgetProps {
  config: {
    host: string;
    port: string;
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
  };
  onConfigClick: () => void;
}

interface TransactionLog {
  id: string;
  timestamp: Date;
  amount: number;
  status: 'success' | 'failed' | 'processing';
  nsu?: string;
  errorMessage?: string;
}

export const TEFMonitorWidget = ({ config, onConfigClick }: TEFMonitorWidgetProps) => {
  const [transactionLogs, setTransactionLogs] = useState<TransactionLog[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const {
    status,
    isProcessing,
    checkTEFStatus,
    testConnection
  } = useTEFIntegration(config);

  // Verificar status do TEF periodicamente
  useEffect(() => {
    const interval = setInterval(() => {
      checkTEFStatus();
    }, 30000); // A cada 30 segundos

    // Verificação inicial
    checkTEFStatus();

    return () => clearInterval(interval);
  }, [checkTEFStatus]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await checkTEFStatus();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const getStatusColor = () => {
    if (!status.isOnline) return 'bg-red-500';
    if (status.consecutiveFailures > 0) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusText = () => {
    if (!status.isOnline) return 'Offline';
    if (status.consecutiveFailures > 0) return 'Instável';
    return 'Online';
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CreditCard size={16} />
            Monitor TEF Elgin
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onConfigClick}
            >
              <Settings size={14} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Status Indicator */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
                <span className="font-medium">{getStatusText()}</span>
                {status.isOnline ? (
                  <Wifi size={16} className="text-green-600" />
                ) : (
                  <WifiOff size={16} className="text-red-600" />
                )}
              </div>
              <Badge variant={status.isOnline ? 'default' : 'destructive'}>
                {status.isOnline ? 'Conectado' : 'Desconectado'}
              </Badge>
            </div>

            {/* Connection Details */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Endpoint</div>
                <div className="font-mono text-xs">
                  {config.host}:{config.port}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Última Verificação</div>
                <div className="text-xs">
                  {formatTimestamp(status.lastCheck)}
                </div>
              </div>
              {status.version && (
                <div>
                  <div className="text-muted-foreground">Versão</div>
                  <div className="text-xs">{status.version}</div>
                </div>
              )}
              <div>
                <div className="text-muted-foreground">Falhas Consecutivas</div>
                <div className="text-xs">{status.consecutiveFailures}</div>
              </div>
            </div>

            {/* Health Indicators */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Status de Inicialização</span>
                {status.isInitialized ? (
                  <CheckCircle size={16} className="text-green-600" />
                ) : (
                  <XCircle size={16} className="text-red-600" />
                )}
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span>Conectividade</span>
                {status.isOnline ? (
                  <CheckCircle size={16} className="text-green-600" />
                ) : (
                  <XCircle size={16} className="text-red-600" />
                )}
              </div>

              <div className="flex items-center justify-between text-sm">
                <span>Estabilidade</span>
                {status.consecutiveFailures === 0 ? (
                  <CheckCircle size={16} className="text-green-600" />
                ) : status.consecutiveFailures < 3 ? (
                  <AlertTriangle size={16} className="text-yellow-600" />
                ) : (
                  <XCircle size={16} className="text-red-600" />
                )}
              </div>
            </div>

            {/* Test Connection Button */}
            <Button 
              onClick={testConnection} 
              variant="outline" 
              className="w-full"
              disabled={isProcessing}
            >
              <Activity size={16} className="mr-2" />
              Testar Conexão
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Logs Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock size={16} />
            Log de Transações Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactionLogs.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              <CreditCard size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhuma transação registrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactionLogs.slice(0, 5).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    {log.status === 'success' ? (
                      <CheckCircle size={16} className="text-green-600" />
                    ) : log.status === 'processing' ? (
                      <RefreshCw size={16} className="text-blue-600 animate-spin" />
                    ) : (
                      <XCircle size={16} className="text-red-600" />
                    )}
                    <div>
                      <div className="text-sm font-medium">
                        R$ {log.amount.toFixed(2).replace('.', ',')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatTimestamp(log.timestamp)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {log.nsu && (
                      <div className="text-xs font-mono">NSU: {log.nsu}</div>
                    )}
                    {log.errorMessage && (
                      <div className="text-xs text-red-600 max-w-24 truncate">
                        {log.errorMessage}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Warning Messages */}
      {status.consecutiveFailures > 2 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="text-yellow-600 mt-0.5" size={16} />
              <div className="text-sm text-yellow-800">
                <p className="font-semibold">Sistema TEF Instável</p>
                <p>
                  Detectadas {status.consecutiveFailures} falhas consecutivas. 
                  Verifique a conexão e configurações do TEF.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};