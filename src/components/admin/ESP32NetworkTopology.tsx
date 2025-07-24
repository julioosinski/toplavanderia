import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Wifi, 
  WifiOff, 
  Cpu, 
  MapPin, 
  Activity, 
  RefreshCw,
  RotateCcw,
  TestTube,
  AlertTriangle
} from 'lucide-react';
import { useESP32Network } from '@/hooks/useESP32Network';

const ESP32NetworkTopology: React.FC = () => {
  const { 
    topology, 
    loading, 
    loadNetworkTopology, 
    redistributeMachines, 
    testNetworkConnectivity 
  } = useESP32Network();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Topologia da Rede ESP32</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            Carregando topologia da rede...
          </div>
        </CardContent>
      </Card>
    );
  }

  const getNodeHealthColor = (node: any) => {
    if (!node.isOnline) return 'bg-red-500';
    if (node.load > 80) return 'bg-orange-500';
    if (node.load > 60) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getConnectionStrengthColor = (strength: number) => {
    if (strength > 80) return 'border-green-500';
    if (strength > 60) return 'border-yellow-500';
    if (strength > 40) return 'border-orange-500';
    return 'border-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Resumo da Rede */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Visão Geral da Rede ESP32
            </CardTitle>
            <div className="flex gap-2">
              <Button 
                onClick={testNetworkConnectivity} 
                variant="outline" 
                size="sm"
              >
                <TestTube className="h-4 w-4 mr-1" />
                Testar Conectividade
              </Button>
              <Button 
                onClick={redistributeMachines} 
                variant="outline" 
                size="sm"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Redistribuir Carga
              </Button>
              <Button 
                onClick={loadNetworkTopology} 
                variant="outline" 
                size="sm"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{topology.nodes.length}</div>
              <div className="text-sm text-muted-foreground">Total de Nós</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{topology.onlineNodes}</div>
              <div className="text-sm text-muted-foreground">Nós Online</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{topology.totalMachines}</div>
              <div className="text-sm text-muted-foreground">Total de Máquinas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{topology.connections.length}</div>
              <div className="text-sm text-muted-foreground">Conexões Ativas</div>
            </div>
          </div>

          {/* Alertas de Saúde da Rede */}
          {topology.onlineNodes < topology.nodes.length && (
            <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg mb-4">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <span className="text-sm text-orange-800">
                {topology.nodes.length - topology.onlineNodes} nó(s) offline detectado(s)
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Visualização dos Nós */}
      <Card>
        <CardHeader>
          <CardTitle>Nós da Rede</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {topology.nodes.map((node) => (
              <div 
                key={node.id} 
                className="relative border rounded-lg p-4 bg-card hover:shadow-md transition-shadow"
              >
                {/* Indicador de Status */}
                <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${getNodeHealthColor(node)}`} />

                <div className="space-y-3">
                  {/* Cabeçalho do Nó */}
                  <div className="flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-primary" />
                    <div>
                      <div className="font-semibold">{node.name}</div>
                      <div className="text-sm text-muted-foreground">ID: {node.id}</div>
                    </div>
                  </div>

                  {/* Informações de Conectividade */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      {node.isOnline ? (
                        <Wifi className="h-4 w-4 text-green-500" />
                      ) : (
                        <WifiOff className="h-4 w-4 text-red-500" />
                      )}
                      <span>{node.host}:{node.port}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-blue-500" />
                      <span>{node.location}</span>
                    </div>
                  </div>

                  {/* Carga do Nó */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Carga:</span>
                      <span>{node.load.toFixed(1)}%</span>
                    </div>
                    <Progress value={node.load} className="h-2" />
                  </div>

                  {/* Máquinas Conectadas */}
                  <div>
                    <div className="text-sm font-medium mb-1">
                      Máquinas ({node.machines.length}):
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {node.machines.map((machine, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {machine}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <Badge 
                    variant={node.isOnline ? "default" : "destructive"}
                    className="w-full justify-center"
                  >
                    {node.isOnline ? "Online" : "Offline"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Mapa de Conexões */}
      <Card>
        <CardHeader>
          <CardTitle>Mapa de Conexões</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topology.connections.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma conexão ativa detectada
              </div>
            ) : (
              topology.connections.map((connection, index) => (
                <div 
                  key={index}
                  className={`flex items-center justify-between p-3 border rounded-lg ${getConnectionStrengthColor(connection.strength)}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium">
                      {topology.nodes.find(n => n.id === connection.from)?.name} 
                      ↔ 
                      {topology.nodes.find(n => n.id === connection.to)?.name}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={connection.strength} className="w-20 h-2" />
                    <span className="text-sm font-medium w-12">
                      {connection.strength.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ESP32NetworkTopology;