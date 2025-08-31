import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useBluetoothIntegration, BluetoothDevice } from '@/hooks/useBluetoothIntegration';
import { useToast } from '@/hooks/use-toast';
import { 
  Bluetooth, 
  Search, 
  Loader2, 
  Smartphone, 
  Wifi, 
  WifiOff, 
  CheckCircle, 
  AlertCircle,
  Settings
} from 'lucide-react';

export const BluetoothConfig: React.FC = () => {
  const { toast } = useToast();
  const [selectedDevice, setSelectedDevice] = useState<BluetoothDevice | null>(null);
  const [testAmount, setTestAmount] = useState<number>(5.00);
  
  const {
    isNative,
    isEnabled,
    isConnected,
    connectedDevice,
    availableDevices,
    isScanning,
    checkBluetoothEnabled,
    enableBluetooth,
    scanDevices,
    getPairedDevices,
    connectToDevice,
    disconnect,
    processPayment
  } = useBluetoothIntegration();

  const [pairedDevices, setPairedDevices] = useState<BluetoothDevice[]>([]);

  // Carregar dispositivos pareados ao inicializar
  useEffect(() => {
    if (isEnabled) {
      loadPairedDevices();
    }
  }, [isEnabled]);

  const loadPairedDevices = async () => {
    try {
      const devices = await getPairedDevices();
      setPairedDevices(devices);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao carregar dispositivos pareados",
        variant: "destructive"
      });
    }
  };

  const handleEnableBluetooth = async () => {
    try {
      const enabled = await enableBluetooth();
      if (enabled) {
        toast({
          title: "Sucesso",
          description: "Bluetooth habilitado com sucesso"
        });
        await loadPairedDevices();
      } else {
        toast({
          title: "Erro",
          description: "Falha ao habilitar Bluetooth",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao habilitar Bluetooth",
        variant: "destructive"
      });
    }
  };

  const handleScanDevices = async () => {
    try {
      await scanDevices();
      toast({
        title: "Sucesso",
        description: `${availableDevices.length} dispositivos encontrados`
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha na busca por dispositivos",
        variant: "destructive"
      });
    }
  };

  const handleConnect = async (device: BluetoothDevice) => {
    try {
      const connected = await connectToDevice(device.address);
      if (connected) {
        toast({
          title: "Conectado",
          description: `Conectado a ${device.name}`
        });
        setSelectedDevice(device);
      } else {
        toast({
          title: "Erro",
          description: `Falha ao conectar a ${device.name}`,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro na conexão",
        variant: "destructive"
      });
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      toast({
        title: "Desconectado",
        description: "Dispositivo desconectado"
      });
      setSelectedDevice(null);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao desconectar",
        variant: "destructive"
      });
    }
  };

  const handleTestPayment = async () => {
    if (!isConnected || !connectedDevice) {
      toast({
        title: "Erro",
        description: "Nenhum dispositivo conectado",
        variant: "destructive"
      });
      return;
    }

    try {
      const result = await processPayment({
        amount: testAmount,
        type: 'credit',
        orderId: `TEST_${Date.now()}`
      });

      if (result.success) {
        toast({
          title: "Teste Bem-sucedido",
          description: "Pagamento de teste processado com sucesso"
        });
      } else {
        toast({
          title: "Teste Falhou",
          description: result.error || "Falha no teste de pagamento",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Erro no Teste",
        description: "Erro ao processar teste de pagamento",
        variant: "destructive"
      });
    }
  };

  const DeviceCard: React.FC<{ device: BluetoothDevice; onConnect: () => void }> = ({ device, onConnect }) => (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center gap-3">
        <Smartphone className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="font-medium">{device.name}</p>
          <p className="text-sm text-muted-foreground">{device.address}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {device.paired && <Badge variant="secondary">Pareado</Badge>}
        {device.connected ? (
          <Badge variant="default" className="bg-success text-success-foreground">Conectado</Badge>
        ) : (
          <Button size="sm" onClick={onConnect}>
            Conectar
          </Button>
        )}
      </div>
    </div>
  );

  if (!isNative) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Configuração Bluetooth
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm">
              Bluetooth só está disponível em dispositivos móveis nativos.
              Para testar, compile o app para Android/iOS.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status do Bluetooth */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bluetooth className="h-5 w-5" />
            Status do Bluetooth
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isEnabled ? (
                <Wifi className="h-5 w-5 text-success" />
              ) : (
                <WifiOff className="h-5 w-5 text-destructive" />
              )}
              <span>Bluetooth {isEnabled ? 'Habilitado' : 'Desabilitado'}</span>
            </div>
            {!isEnabled && (
              <Button onClick={handleEnableBluetooth} size="sm">
                Habilitar
              </Button>
            )}
          </div>

          {connectedDevice && (
            <div className="flex items-center justify-between p-3 bg-success/10 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span className="text-sm">Conectado a {connectedDevice.name}</span>
              </div>
              <Button onClick={handleDisconnect} variant="outline" size="sm">
                Desconectar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dispositivos Pareados */}
      {isEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Dispositivos Pareados</span>
              <Button onClick={loadPairedDevices} variant="outline" size="sm">
                Atualizar
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pairedDevices.length > 0 ? (
              <div className="space-y-2">
                {pairedDevices.map((device) => (
                  <DeviceCard
                    key={device.address}
                    device={device}
                    onConnect={() => handleConnect(device)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                Nenhum dispositivo pareado encontrado
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Buscar Novos Dispositivos */}
      {isEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Buscar Dispositivos</span>
              <Button 
                onClick={handleScanDevices} 
                disabled={isScanning}
                size="sm"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Buscar
                  </>
                )}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {availableDevices.length > 0 ? (
              <div className="space-y-2">
                {availableDevices.map((device) => (
                  <DeviceCard
                    key={device.address}
                    device={device}
                    onConnect={() => handleConnect(device)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                Nenhum dispositivo encontrado
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Teste de Pagamento */}
      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Teste de Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="test-amount">Valor do Teste (R$)</Label>
              <Input
                id="test-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={testAmount}
                onChange={(e) => setTestAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
            <Button onClick={handleTestPayment} className="w-full">
              Executar Teste de Pagamento
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};