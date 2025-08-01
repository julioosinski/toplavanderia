import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wifi, WifiOff, Signal, Clock, AlertTriangle, CheckCircle, RefreshCw, Zap, TestTube, MapPin, Cpu } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';
import ESP32NetworkTopology from './ESP32NetworkTopology';

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
  location?: string;
  machine_count?: number;
  relay_status?: Json;
  updated_at: string;
}

const ESP32MonitorTab: React.FC = () => {
  const [esp32Status, setEsp32Status] = useState<ESP32Status[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [testingCredit, setTestingCredit] = useState(false);
  const [testAmount, setTestAmount] = useState<number>(10);
  const [selectedESP32, setSelectedESP32] = useState<string>('main');
  const { toast } = useToast();

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

  const testCreditRelease = async () => {
    setTestingCredit(true);
    try {
      const { data, error } = await supabase.functions.invoke('esp32-credit-release', {
        body: {
          transactionId: `test-${Date.now()}`,
          amount: testAmount,
          esp32Id: selectedESP32
        }
      });

      if (error) throw error;

      toast({
        title: data.success ? "Teste Concluído" : "Teste Falhou",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    } catch (error) {
      console.error('Error testing credit release:', error);
      toast({
        title: "Erro no Teste",
        description: "Falha ao testar liberação de crédito",
        variant: "destructive",
      });
    } finally {
      setTestingCredit(false);
    }
  };

  const simulateESP32Data = async () => {
    try {
      const mockData = [
        {
          esp32_id: 'main',
          ip_address: '192.168.1.100',
          signal_strength: -45,
          network_status: 'connected',
          firmware_version: '1.2.3',
          uptime_seconds: 3600,
          location: 'Conjunto A',
          machine_count: 2,
          relay_status: { relay_1: true, relay_2: false },
          is_online: true,
          last_heartbeat: new Date().toISOString()
        },
        {
          esp32_id: 'secondary',
          ip_address: '192.168.1.101',
          signal_strength: -55,
          network_status: 'connected',
          firmware_version: '1.2.3',
          uptime_seconds: 2400,
          location: 'Conjunto B',
          machine_count: 2,
          relay_status: { relay_1: false, relay_2: true },
          is_online: true,
          last_heartbeat: new Date().toISOString()
        },
        {
          esp32_id: 'esp32-A',
          ip_address: '192.168.1.102',
          signal_strength: -62,
          network_status: 'connected',
          firmware_version: '1.2.4',
          uptime_seconds: 1800,
          location: 'Conjunto C',
          machine_count: 3,
          relay_status: { relay_1: true, relay_2: true, relay_3: false },
          is_online: true,
          last_heartbeat: new Date().toISOString()
        },
        {
          esp32_id: 'esp32-B',
          ip_address: '192.168.1.103',
          signal_strength: -48,
          network_status: 'connected',
          firmware_version: '1.2.4',
          uptime_seconds: 5400,
          location: 'Conjunto D',
          machine_count: 2,
          relay_status: { relay_1: false, relay_2: false },
          is_online: true,
          last_heartbeat: new Date().toISOString()
        },
        {
          esp32_id: 'esp32-C',
          ip_address: '192.168.1.104',
          signal_strength: -68,
          network_status: 'weak_signal',
          firmware_version: '1.2.3',
          uptime_seconds: 7200,
          location: 'Conjunto E',
          machine_count: 2,
          relay_status: { relay_1: true, relay_2: true },
          is_online: Math.random() > 0.3,
          last_heartbeat: new Date(Date.now() - (Math.random() * 300000)).toISOString()
        }
      ];

      const { error } = await supabase
        .from('esp32_status')
        .upsert(mockData);

      if (error) throw error;

      toast({
        title: "Dados Simulados",
        description: `${mockData.length} dispositivos ESP32 de teste foram adicionados`,
      });

      await loadESP32Status();
    } catch (error) {
      console.error('Error simulating ESP32 data:', error);
      toast({
        title: "Erro",
        description: "Falha ao simular dados do ESP32",
        variant: "destructive",
      });
    }
  };

  const testIndividualESP32 = async (esp32Id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('esp32-monitor', {
        body: { test_esp32: esp32Id }
      });

      if (error) throw error;

      toast({
        title: "Teste Individual",
        description: data.success ? 
          `ESP32 ${esp32Id}: ${data.message}` : 
          `ESP32 ${esp32Id}: ${data.error || 'Falha no teste'}`,
        variant: data.success ? "default" : "destructive"
      });

      await loadESP32Status();
    } catch (error) {
      console.error('Error testing individual ESP32:', error);
      toast({
        title: "Erro no Teste",
        description: `Falha ao testar ESP32 ${esp32Id}`,
        variant: "destructive"
      });
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
      {/* Topologia da Rede */}
      <ESP32NetworkTopology />
      
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="esp32-select">ESP32 Alvo</Label>
              <Select value={selectedESP32} onValueChange={setSelectedESP32}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o ESP32" />
                </SelectTrigger>
                <SelectContent>
                  {esp32Status.map((status) => (
                    <SelectItem key={status.esp32_id} value={status.esp32_id}>
                      ESP32 {status.esp32_id} {status.location && `(${status.location})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
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
            <div className="flex items-end">
              <Button 
                onClick={testCreditRelease}
                disabled={testingCredit || esp32Status.length === 0}
                className="w-full"
              >
                <Zap className={`w-4 h-4 mr-2 ${testingCredit ? 'animate-pulse' : ''}`} />
                {testingCredit ? 'Testando...' : 'Testar Liberação'}
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Teste a comunicação e liberação de crédito com o ESP32 selecionado
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
                  <div>
                    <CardTitle className="text-base">
                      ESP32 {status.esp32_id}
                    </CardTitle>
                    {status.location && (
                      <div className="flex items-center text-sm text-muted-foreground mt-1">
                        <MapPin className="w-3 h-3 mr-1" />
                        {status.location}
                        {status.machine_count && (
                          <>
                            <Cpu className="w-3 h-3 ml-2 mr-1" />
                            {status.machine_count} máquinas
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(status)}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testIndividualESP32(status.esp32_id)}
                    >
                      Testar
                    </Button>
                  </div>
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