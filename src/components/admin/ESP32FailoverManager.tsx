import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  AlertTriangle, 
  RefreshCw, 
  Shield, 
  ArrowRight, 
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FailoverRule {
  id: string;
  sourceNode: string;
  targetNode: string;
  condition: 'offline' | 'high_load' | 'manual';
  isActive: boolean;
  lastTriggered?: string;
}

interface ESP32Node {
  id: string;
  name: string;
  isOnline: boolean;
  load: number;
  machineCount: number;
}

const ESP32FailoverManager: React.FC = () => {
  const [nodes, setNodes] = useState<ESP32Node[]>([]);
  const [failoverRules, setFailoverRules] = useState<FailoverRule[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
    
    // Verificar regras de failover a cada 30 segundos
    const interval = setInterval(checkFailoverRules, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      // Carregar configurações dos ESP32s
      const { data: settings, error: settingsError } = await supabase
        .from('system_settings')
        .select('esp32_configurations')
        .single();

      if (settingsError) throw settingsError;

      // Carregar status dos ESP32s
      const { data: statusData, error: statusError } = await supabase
        .from('esp32_status')
        .select('*');

      if (statusError) throw statusError;

      const configurations = settings?.esp32_configurations as any[] || [];
      const statusMap = new Map(statusData?.map(s => [s.esp32_id, s]) || []);

      const loadedNodes: ESP32Node[] = configurations.map(config => {
        const status = statusMap.get(config.id);
        return {
          id: config.id,
          name: config.name,
          isOnline: status?.is_online || false,
          load: calculateLoad(config.machines?.length || 0),
          machineCount: config.machines?.length || 0
        };
      });

      setNodes(loadedNodes);
      loadFailoverRules();

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar dados do sistema",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadFailoverRules = () => {
    // Em uma implementação real, isso viria do banco de dados
    const rules: FailoverRule[] = [
      {
        id: '1',
        sourceNode: 'main',
        targetNode: 'secondary',
        condition: 'offline',
        isActive: true
      },
      {
        id: '2',
        sourceNode: 'secondary',
        targetNode: 'main',
        condition: 'offline',
        isActive: true
      }
    ];
    setFailoverRules(rules);
  };

  const calculateLoad = (machineCount: number): number => {
    const maxMachines = 4;
    return Math.min((machineCount / maxMachines) * 100, 100);
  };

  const checkFailoverRules = async () => {
    for (const rule of failoverRules) {
      if (!rule.isActive) continue;

      const sourceNode = nodes.find(n => n.id === rule.sourceNode);
      const targetNode = nodes.find(n => n.id === rule.targetNode);

      if (!sourceNode || !targetNode) continue;

      let shouldTrigger = false;

      switch (rule.condition) {
        case 'offline':
          shouldTrigger = !sourceNode.isOnline && targetNode.isOnline;
          break;
        case 'high_load':
          shouldTrigger = sourceNode.load > 90 && targetNode.load < 70;
          break;
      }

      if (shouldTrigger) {
        await triggerFailover(rule.sourceNode, rule.targetNode, rule.condition);
      }
    }
  };

  const triggerFailover = async (sourceNode: string, targetNode: string, reason: string) => {
    try {
      setTriggering(true);

      const { data, error } = await supabase.functions.invoke('esp32-load-balancer', {
        body: {
          action: 'failover',
          sourceNode,
          targetNode
        }
      });

      if (error) throw error;

      toast({
        title: "Failover Executado",
        description: `Máquinas transferidas de ${sourceNode} para ${targetNode} (Motivo: ${reason})`,
      });

      // Atualizar regra
      setFailoverRules(prev => prev.map(rule => 
        rule.sourceNode === sourceNode && rule.targetNode === targetNode
          ? { ...rule, lastTriggered: new Date().toISOString() }
          : rule
      ));

      // Recarregar dados
      setTimeout(loadData, 2000);

    } catch (error) {
      console.error('Error triggering failover:', error);
      toast({
        title: "Erro no Failover",
        description: "Falha ao executar failover automático",
        variant: "destructive"
      });
    } finally {
      setTriggering(false);
    }
  };

  const manualFailover = async () => {
    if (!selectedSource || !selectedTarget) {
      toast({
        title: "Seleção Incompleta",
        description: "Selecione os nós de origem e destino",
        variant: "destructive"
      });
      return;
    }

    if (selectedSource === selectedTarget) {
      toast({
        title: "Seleção Inválida",
        description: "Nó de origem e destino devem ser diferentes",
        variant: "destructive"
      });
      return;
    }

    await triggerFailover(selectedSource, selectedTarget, 'manual');
  };

  const getNodeStatusColor = (node: ESP32Node) => {
    if (!node.isOnline) return 'bg-red-500';
    if (node.load > 80) return 'bg-orange-500';
    return 'bg-green-500';
  };

  const getConditionLabel = (condition: string) => {
    switch (condition) {
      case 'offline': return 'Node Offline';
      case 'high_load': return 'Alta Carga';
      case 'manual': return 'Manual';
      default: return condition;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gerenciamento de Failover</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            Carregando sistema de failover...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status dos Nodes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Status dos Nodes ESP32
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {nodes.map(node => (
              <div key={node.id} className="relative border rounded-lg p-4">
                <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${getNodeStatusColor(node)}`} />
                
                <div className="space-y-2">
                  <div className="font-semibold">{node.name}</div>
                  <div className="text-sm text-muted-foreground">ID: {node.id}</div>
                  
                  <div className="flex items-center gap-2">
                    {node.isOnline ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm">
                      {node.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  
                  <div className="text-sm">
                    <span className="text-muted-foreground">Máquinas: </span>
                    <span className="font-medium">{node.machineCount}</span>
                  </div>
                  
                  <div className="text-sm">
                    <span className="text-muted-foreground">Carga: </span>
                    <span className="font-medium">{node.load.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Failover Manual */}
      <Card>
        <CardHeader>
          <CardTitle>Failover Manual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Execute failover manual para transferir máquinas entre nodes ESP32.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nó de Origem</Label>
              <Select value={selectedSource} onValueChange={setSelectedSource}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar nó de origem" />
                </SelectTrigger>
                <SelectContent>
                  {nodes.map(node => (
                    <SelectItem key={node.id} value={node.id}>
                      {node.name} ({node.machineCount} máquinas)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nó de Destino</Label>
              <Select value={selectedTarget} onValueChange={setSelectedTarget}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar nó de destino" />
                </SelectTrigger>
                <SelectContent>
                  {nodes.filter(n => n.isOnline && n.id !== selectedSource).map(node => (
                    <SelectItem key={node.id} value={node.id}>
                      {node.name} (Online)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            onClick={manualFailover} 
            disabled={!selectedSource || !selectedTarget || triggering}
            className="w-full"
          >
            {triggering ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4 mr-2" />
            )}
            Executar Failover
          </Button>
        </CardContent>
      </Card>

      {/* Regras de Failover Automático */}
      <Card>
        <CardHeader>
          <CardTitle>Regras de Failover Automático</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {failoverRules.map(rule => (
              <div key={rule.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{rule.sourceNode}</span>
                    <ArrowRight className="h-4 w-4" />
                    <span className="font-medium">{rule.targetNode}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Condição: {getConditionLabel(rule.condition)}
                  </div>
                  {rule.lastTriggered && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Último acionamento: {new Date(rule.lastTriggered).toLocaleString('pt-BR')}
                    </div>
                  )}
                </div>
                
                <Badge variant={rule.isActive ? "default" : "secondary"}>
                  {rule.isActive ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ESP32FailoverManager;