import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wifi, WifiOff, Signal, Clock, AlertTriangle, CheckCircle, RefreshCw, Zap, TestTube } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useESP32CreditRelease } from '@/hooks/useESP32CreditRelease';

interface ESP32Status {
  id: string;
  esp32_id: string;
  ip_address?: string;
  signal_strength?: number;
  network_status: string;
  last_heartbeat?: string;
  firmware_version?: string;
  uptime_seconds?: number;
  is_online: boolean;
  updated_at: string;
}

const ESP32MonitorTab: React.FC = () => {
  const [esp32Status, setEsp32Status] = useState<ESP32Status[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [testingCredit, setTestingCredit] = useState(false);
  const [testAmount, setTestAmount] = useState<number>(10);
  const { toast } = useToast();
  const { releaseCredit } = useESP32CreditRelease();

  const loadESP32Status = async () => {
    try {
      const { data, error } = await supabase
        .from('esp32_status')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setEsp32Status(data || []);
    } catch (error) {
      console.error('Error loading ESP32 status:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar status do ESP32",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshStatus = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('esp32-monitor', {
        body: { action: 'status' }
      });

      if (error) throw error;

      toast({
        title: data.success ? "Sucesso" : "Erro",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });

      if (data.success) {
        await loadESP32Status();
      }
    } catch (error) {
      console.error('Error refreshing status:', error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar status",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const getSignalIcon = (strength?: number) => {
    if (!strength) return <WifiOff className="w-4 h-4" />;
    if (strength > -50) return <Wifi className="w-4 h-4 text-green-500" />;
    if (strength > -70) return <Signal className="w-4 h-4 text-yellow-500" />;
    return <Signal className="w-4 h-4 text-red-500" />;
  };

  const getStatusBadge = (status: ESP32Status) => {
    if (status.is_online) {
      return <Badge variant="secondary" className="bg-green-100 text-green-800">Online</Badge>;
    }
    return <Badge variant="destructive">Offline</Badge>;
  };

  const formatUptime = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatLastSeen = (timestamp?: string) => {
    if (!timestamp) return 'Nunca';
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}m atrás`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h atrás`;
    return `${Math.floor(hours / 24)}d atrás`;
  };

  const simulateESP32Data = async () => {
    try {
      const mockStatus = {
        esp32_id: 'SIM001',
        ip_address: '192.168.1.100',
        signal_strength: -45,
        network_status: 'connected',
        last_heartbeat: new Date().toISOString(),
        firmware_version: 'v2.1.0',
        uptime_seconds: 3665,
        is_online: true
      };

      const { error } = await supabase
        .from('esp32_status')
        .upsert(mockStatus, { onConflict: 'esp32_id' });

      if (error) throw error;

      toast({
        title: "Simulação Criada",
        description: "Dados do ESP32 simulado foram inseridos",
      });

      await loadESP32Status();
    } catch (error) {
      console.error('Error simulating ESP32 data:', error);
      toast({
        title: "Erro na Simulação",
        description: "Falha ao criar dados simulados",
        variant: "destructive",
      });
    }
  };

  const testCreditRelease = async () => {
    setTestingCredit(true);
    try {
      const testTransactionId = `test-${Date.now()}`;
      await releaseCredit({
        transactionId: testTransactionId,
        amount: testAmount,
        esp32Id: 'main'
      });
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setTestingCredit(false);
    }
  };

  useEffect(() => {
    loadESP32Status();

    // Configurar realtime para updates
    const channel = supabase
      .channel('esp32-status-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'esp32_status'
        },
        () => {
          loadESP32Status();
        }
      )
      .subscribe();

    // Auto-refresh a cada 30 segundos
    const interval = setInterval(loadESP32Status, 30000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-muted animate-pulse rounded-lg"></div>
        <div className="h-48 bg-muted animate-pulse rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Monitoramento ESP32</h3>
        <div className="flex gap-2">
          <Button 
            onClick={simulateESP32Data} 
            variant="outline"
            size="sm"
          >
            <TestTube className="w-4 h-4 mr-2" />
            Simular ESP32
          </Button>
          <Button 
            onClick={refreshStatus} 
            disabled={refreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar Status
          </Button>
        </div>
      </div>

      {/* Credit Release Test Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="text-primary" />
            <span>Teste de Liberação de Crédito</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <Label htmlFor="test-amount">Valor do Teste (R$)</Label>
              <Input
                id="test-amount"
                type="number"
                min="1"
                max="100"
                value={testAmount}
                onChange={(e) => setTestAmount(Number(e.target.value))}
                className="mt-1"
              />
            </div>
            <Button 
              onClick={testCreditRelease}
              disabled={testingCredit}
              className="mt-6"
            >
              <Zap className={`w-4 h-4 mr-2 ${testingCredit ? 'animate-pulse' : ''}`} />
              {testingCredit ? 'Testando...' : 'Testar Liberação'}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Teste a comunicação e liberação de crédito com o ESP32
          </p>
        </CardContent>
      </Card>

      {esp32Status.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              Nenhum ESP32 configurado ou detectado
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Configure o host ESP32 nas configurações ou use o botão "Simular ESP32" para testar
            </p>
            <Button onClick={simulateESP32Data} variant="outline">
              <TestTube className="w-4 h-4 mr-2" />
              Simular ESP32 para Teste
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {esp32Status.map((status) => (
            <Card key={status.id}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base">
                    ESP32 {status.esp32_id}
                  </CardTitle>
                  {getStatusBadge(status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Wifi className="w-4 h-4 mr-1" />
                      IP Address
                    </div>
                    <p className="text-sm font-medium">
                      {status.ip_address || 'N/A'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center text-sm text-muted-foreground">
                      {getSignalIcon(status.signal_strength)}
                      <span className="ml-1">Sinal WiFi</span>
                    </div>
                    <p className="text-sm font-medium">
                      {status.signal_strength ? `${status.signal_strength} dBm` : 'N/A'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Clock className="w-4 h-4 mr-1" />
                      Uptime
                    </div>
                    <p className="text-sm font-medium">
                      {formatUptime(status.uptime_seconds)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Último Contato
                    </div>
                    <p className="text-sm font-medium">
                      {formatLastSeen(status.last_heartbeat)}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Status da Rede:</span>
                      <span className="ml-2 font-medium capitalize">
                        {status.network_status}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Firmware:</span>
                      <span className="ml-2 font-medium">
                        {status.firmware_version || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ESP32MonitorTab;