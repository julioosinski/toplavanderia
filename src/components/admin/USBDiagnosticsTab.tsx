import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Usb, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useUSBConnection } from '@/hooks/useUSBConnection';
import { toast } from 'sonner';

export const USBDiagnosticsTab = () => {
  const { 
    isSupported, 
    devices, 
    isScanning, 
    lastError, 
    scanForDevices, 
    connectToDevice, 
    disconnectFromDevice,
    getConnectedPinpads 
  } = useUSBConnection();

  const handleConnect = async (device: any) => {
    const success = await connectToDevice(device);
    if (success) {
      toast.success(`Conectado ao ${device.deviceName}`);
    } else {
      toast.error(`Falha ao conectar com ${device.deviceName}`);
    }
  };

  const handleDisconnect = (device: any) => {
    disconnectFromDevice(device);
    toast.info(`Desconectado de ${device.deviceName}`);
  };

  const connectedPinpads = getConnectedPinpads();

  return (
    <div className="space-y-6">
      {/* USB Support Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Usb className="h-5 w-5" />
            Status USB
          </CardTitle>
          <CardDescription>
            Verificação do suporte USB e dispositivos conectados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Suporte USB:</span>
            <Badge variant={isSupported ? "default" : "destructive"}>
              {isSupported ? "Suportado" : "Não Suportado"}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span>Pinpads Conectados:</span>
            <Badge variant={connectedPinpads.length > 0 ? "default" : "secondary"}>
              {connectedPinpads.length}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span>Dispositivos Detectados:</span>
            <Badge variant="outline">
              {devices.length}
            </Badge>
          </div>

          {lastError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{lastError}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Device Scanner */}
      <Card>
        <CardHeader>
          <CardTitle>Scanner de Dispositivos</CardTitle>
          <CardDescription>
            Buscar por pinpads e terminais de pagamento conectados via USB
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={scanForDevices} 
            disabled={isScanning || !isSupported}
            className="w-full"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'Buscando...' : 'Buscar Dispositivos'}
          </Button>
        </CardContent>
      </Card>

      {/* Connected Devices */}
      {devices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Dispositivos Encontrados</CardTitle>
            <CardDescription>
              Dispositivos USB detectados no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {devices.map((device, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {device.isConnected ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-gray-400" />
                      )}
                      <div>
                        <p className="font-medium">{device.deviceName}</p>
                        <p className="text-sm text-muted-foreground">
                          VID: {device.vendorId} | PID: {device.productId}
                        </p>
                        {device.serialNumber && (
                          <p className="text-xs text-muted-foreground">
                            Serial: {device.serialNumber}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant={device.deviceType === 'pinpad' ? 'default' : 'secondary'}>
                      {device.deviceType === 'pinpad' ? 'Pinpad' : 'Desconhecido'}
                    </Badge>
                  </div>
                  
                  <div className="flex gap-2">
                    {device.isConnected ? (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDisconnect(device)}
                      >
                        Desconectar
                      </Button>
                    ) : (
                      <Button 
                        size="sm"
                        onClick={() => handleConnect(device)}
                        disabled={device.deviceType !== 'pinpad'}
                      >
                        Conectar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* USB Configuration Guide */}
      <Card>
        <CardHeader>
          <CardTitle>Guia de Configuração USB</CardTitle>
          <CardDescription>
            Instruções para configurar conexões USB com terminais de pagamento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">Positivo L4:</h4>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
              <li>• Conecte o cabo USB do terminal ao tablet</li>
              <li>• Aguarde o sistema reconhecer o dispositivo</li>
              <li>• Use o botão "Buscar Dispositivos" para detectar</li>
              <li>• Conecte ao dispositivo encontrado</li>
            </ul>
          </div>
          
          <Separator />
          
          <div className="space-y-2">
            <h4 className="font-medium">Solução de Problemas:</h4>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
              <li>• Verifique se o cabo USB está funcionando</li>
              <li>• Certifique-se de que o terminal está ligado</li>
              <li>• Reinicie o tablet se necessário</li>
              <li>• Verifique as permissões USB nas configurações Android</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};