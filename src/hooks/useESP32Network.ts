import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ESP32Node {
  id: string;
  name: string;
  host: string;
  port: number;
  location: string;
  machines: string[];
  isOnline: boolean;
  load: number;
  lastHeartbeat?: string;
}

interface NetworkTopology {
  nodes: ESP32Node[];
  connections: { from: string; to: string; strength: number }[];
  totalMachines: number;
  onlineNodes: number;
}

export const useESP32Network = () => {
  const [topology, setTopology] = useState<NetworkTopology>({
    nodes: [],
    connections: [],
    totalMachines: 0,
    onlineNodes: 0
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadNetworkTopology = async () => {
    try {
      // Buscar configurações dos ESP32s
      const { data: settings, error: settingsError } = await supabase
        .from('system_settings')
        .select('esp32_configurations')
        .single();

      if (settingsError) throw settingsError;

      // Buscar status dos ESP32s
      const { data: statusData, error: statusError } = await supabase
        .from('esp32_status')
        .select('*');

      if (statusError) throw statusError;

      const configurations = settings?.esp32_configurations as any[];
      const statusMap = new Map(statusData?.map(s => [s.esp32_id, s]) || []);

      const nodes: ESP32Node[] = configurations.map(config => {
        const status = statusMap.get(config.id);
        return {
          id: config.id,
          name: config.name,
          host: config.host,
          port: config.port,
          location: config.location,
          machines: config.machines || [],
          isOnline: status?.is_online || false,
          load: calculateNodeLoad(config.machines?.length || 0),
          lastHeartbeat: status?.last_heartbeat
        };
      });

      // Simular conexões entre nodes (em uma implementação real, isso viria do ESP32)
      const connections = generateNetworkConnections(nodes);

      setTopology({
        nodes,
        connections,
        totalMachines: nodes.reduce((sum, node) => sum + node.machines.length, 0),
        onlineNodes: nodes.filter(node => node.isOnline).length
      });

    } catch (error) {
      console.error('Error loading network topology:', error);
      toast({
        title: "Erro de Rede",
        description: "Falha ao carregar topologia da rede ESP32",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateNodeLoad = (machineCount: number): number => {
    // Calcular carga baseada no número de máquinas (0-100%)
    const maxMachinesPerNode = 4; // Assumindo máximo de 4 máquinas por ESP32
    return Math.min((machineCount / maxMachinesPerNode) * 100, 100);
  };

  const generateNetworkConnections = (nodes: ESP32Node[]) => {
    const connections: { from: string; to: string; strength: number }[] = [];
    
    // Conectar nodes adjacentes (em uma implementação real, isso seria descoberto dinamicamente)
    for (let i = 0; i < nodes.length - 1; i++) {
      if (nodes[i].isOnline && nodes[i + 1].isOnline) {
        connections.push({
          from: nodes[i].id,
          to: nodes[i + 1].id,
          strength: Math.random() * 100 // Simular força da conexão
        });
      }
    }

    return connections;
  };

  const redistributeMachines = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('esp32-load-balancer', {
        body: { action: 'redistribute' }
      });

      if (error) throw error;

      toast({
        title: "Redistribuição Iniciada",
        description: "Balanceamento de carga em andamento",
      });

      // Recarregar dados após redistribuição
      setTimeout(loadNetworkTopology, 2000);

    } catch (error) {
      console.error('Error redistributing machines:', error);
      toast({
        title: "Erro na Redistribuição",
        description: "Falha ao redistribuir máquinas",
        variant: "destructive"
      });
    }
  };

  const testNetworkConnectivity = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('esp32-network-test', {
        body: { nodes: topology.nodes.map(n => n.id) }
      });

      if (error) throw error;

      toast({
        title: "Teste de Conectividade",
        description: `${data.successfulConnections}/${data.totalTests} conexões bem-sucedidas`,
        variant: data.successfulConnections === data.totalTests ? "default" : "destructive"
      });

    } catch (error) {
      console.error('Error testing network:', error);
      toast({
        title: "Erro no Teste",
        description: "Falha ao testar conectividade da rede",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    loadNetworkTopology();

    // Configurar atualizações em tempo real
    const channel = supabase
      .channel('esp32-network-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'esp32_status'
      }, () => {
        loadNetworkTopology();
      })
      .subscribe();

    // Atualizar a cada 30 segundos
    const interval = setInterval(loadNetworkTopology, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  return {
    topology,
    loading,
    loadNetworkTopology,
    redistributeMachines,
    testNetworkConnectivity
  };
};