import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  Usb, 
  Wifi, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCw,
  CreditCard,
  Smartphone
} from 'lucide-react';
import { usePayGOIntegration } from '@/hooks/usePayGOIntegration';

interface PayGOPPC930DiagnosticsProps {
  config: {
    host: string;
    port: number;
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
    automationKey: string;
    cnpjCpf: string;
  };
}

export const PayGOPPC930Diagnostics: React.FC<PayGOPPC930DiagnosticsProps> = ({ config }) => {
  const { status, detectPinpad, checkPayGOStatus, initializePayGO, testConnection } = usePayGOIntegration(config);
  const [pinpadInfo, setPinpadInfo] = useState<any>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isTestingPayment, setIsTestingPayment] = useState(false);

  const handleDetectPinpad = async () => {
    setIsDetecting(true);
    try {
      const result = await detectPinpad();
      setPinpadInfo(result);
      
      if (result.detected) {
        toast.success('PPC930 detectado com sucesso!');
      } else {
        toast.error('PPC930 não foi detectado. Verifique a conexão USB.');
      }
    } catch (error) {
      console.error('Error detecting PPC930:', error);
      toast.error('Erro ao detectar PPC930');
    } finally {
      setIsDetecting(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      const isConnected = await testConnection();
      if (isConnected) {
        toast.success('Conexão PayGO OK!');
      } else {
        toast.error('Falha na conexão PayGO');
      }
    } catch (error) {
      toast.error('Erro ao testar conexão');
    }
  };

  const handleInitialize = async () => {
    try {
      const success = await initializePayGO();
      if (success) {
        toast.success('PayGO inicializado com sucesso!');
      } else {
        toast.error('Falha ao inicializar PayGO');
      }
    } catch (error) {
      toast.error('Erro ao inicializar PayGO');
    }
  };

  const getStatusIcon = (isOnline: boolean) => {
    return isOnline ? (
      <CheckCircle className="h-5 w-5 text-green-500" />
    ) : (
      <XCircle className="h-5 w-5 text-red-500" />
    );
  };

  const getStatusBadge = (isOnline: boolean) => {
    return (
      <Badge variant={isOnline ? "default" : "destructive"}>
        {isOnline ? "Online" : "Offline"}
      </Badge>
    );
  };

  useEffect(() => {
    // Auto-detect pinpad on component mount
    handleDetectPinpad();
  }, []);

  return (
    <div className="space-y-6">
      {/* PayGO System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            Status do Sistema PayGO
          </CardTitle>
          <CardDescription>
            Monitoramento em tempo real da conexão PayGO
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status:</span>
              <div className="flex items-center gap-2">
                {getStatusIcon(status.online)}
                {getStatusBadge(status.online)}
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Inicializado:</span>
              <Badge variant={status.initialized ? "default" : "secondary"}>
                {status.initialized ? "Sim" : "Não"}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Falhas:</span>
              <Badge variant={status.consecutiveFailures > 3 ? "destructive" : "secondary"}>
                {status.consecutiveFailures}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Última Verificação:</span>
              <span className="text-sm text-muted-foreground">
                {status.lastCheck.toLocaleTimeString()}
              </span>
            </div>
          </div>
          
          <Separator className="my-4" />
          
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => checkPayGOStatus()}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Verificar Status
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              className="flex items-center gap-2"
            >
              <Wifi className="h-4 w-4" />
              Testar Conexão
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleInitialize}
              className="flex items-center gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Inicializar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* PPC930 Pinpad Detection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Usb className="h-5 w-5" />
            Detecção PPC930 Pinpad
          </CardTitle>
          <CardDescription>
            Status da conexão USB com o pinpad PPC930
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              onClick={handleDetectPinpad}
              disabled={isDetecting}
              className="flex items-center gap-2"
            >
              {isDetecting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Usb className="h-4 w-4" />
              )}
              {isDetecting ? 'Detectando...' : 'Detectar PPC930'}
            </Button>

            {pinpadInfo && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Status:</span>
                  <div className="flex items-center gap-2">
                    {pinpadInfo.detected ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <Badge variant={pinpadInfo.detected ? "default" : "destructive"}>
                      {pinpadInfo.detected ? "Detectado" : "Não Detectado"}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-medium">Dispositivo:</span>
                  <span className="text-sm">{pinpadInfo.deviceName}</span>
                </div>

                {pinpadInfo.detected && pinpadInfo.vendorId && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Vendor ID:</span>
                      <span className="text-sm font-mono">{pinpadInfo.vendorId}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-medium">Product ID:</span>
                      <span className="text-sm font-mono">{pinpadInfo.productId}</span>
                    </div>

                    {pinpadInfo.serialNumber && (
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Serial Number:</span>
                        <span className="text-sm font-mono">{pinpadInfo.serialNumber}</span>
                      </div>
                    )}
                  </>
                )}

                {pinpadInfo.error && (
                  <div className="flex items-start gap-2 text-sm text-red-600">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{pinpadInfo.error}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Configuration Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Configuração Atual</CardTitle>
          <CardDescription>
            Resumo das configurações PayGO
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Host:</span>
              <p className="text-muted-foreground">{config.host}</p>
            </div>
            <div>
              <span className="font-medium">Porta:</span>
              <p className="text-muted-foreground">{config.port}</p>
            </div>
            <div>
              <span className="font-medium">Timeout:</span>
              <p className="text-muted-foreground">{config.timeout}ms</p>
            </div>
            <div>
              <span className="font-medium">Tentativas:</span>
              <p className="text-muted-foreground">{config.retryAttempts}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};