import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LoadBalancerRequest {
  action: 'redistribute' | 'failover' | 'optimize';
  targetNode?: string;
  sourceNode?: string;
}

interface ESP32Config {
  id: string;
  name: string;
  host: string;
  port: number;
  location: string;
  machines: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const { action, targetNode, sourceNode }: LoadBalancerRequest = await req.json();

    console.log(`ESP32 Load Balancer: Executing ${action}`, { targetNode, sourceNode });

    // Buscar configurações atuais dos ESP32s
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('esp32_configurations')
      .single();

    if (settingsError) {
      throw new Error(`Error fetching settings: ${settingsError.message}`);
    }

    // Buscar status dos ESP32s
    const { data: statusData, error: statusError } = await supabase
      .from('esp32_status')
      .select('*');

    if (statusError) {
      throw new Error(`Error fetching ESP32 status: ${statusError.message}`);
    }

    const configurations: ESP32Config[] = settings?.esp32_configurations as ESP32Config[] || [];
    const statusMap = new Map(statusData?.map(s => [s.esp32_id, s]) || []);

    let result;

    switch (action) {
      case 'redistribute':
        result = await redistributeLoad(configurations, statusMap, supabase);
        break;
      case 'failover':
        result = await handleFailover(configurations, statusMap, sourceNode!, targetNode!, supabase);
        break;
      case 'optimize':
        result = await optimizeLoadDistribution(configurations, statusMap, supabase);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        action,
        result,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('ESP32 Load Balancer Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

async function redistributeLoad(
  configurations: ESP32Config[], 
  statusMap: Map<string, any>,
  supabase: any
): Promise<any> {
  console.log('Redistributing load across ESP32 nodes...');

  // Filtrar apenas nodes online
  const onlineNodes = configurations.filter(config => 
    statusMap.get(config.id)?.is_online === true
  );

  if (onlineNodes.length === 0) {
    throw new Error('No online ESP32 nodes available for redistribution');
  }

  // Coletar todas as máquinas
  const allMachines: string[] = [];
  configurations.forEach(config => {
    allMachines.push(...(config.machines || []));
  });

  // Calcular distribuição ideal
  const machinesPerNode = Math.ceil(allMachines.length / onlineNodes.length);
  const newConfigurations = [...configurations];

  // Redistribuir máquinas
  let machineIndex = 0;
  onlineNodes.forEach((node, nodeIndex) => {
    const configIndex = newConfigurations.findIndex(c => c.id === node.id);
    if (configIndex !== -1) {
      const startIndex = nodeIndex * machinesPerNode;
      const endIndex = Math.min(startIndex + machinesPerNode, allMachines.length);
      newConfigurations[configIndex].machines = allMachines.slice(startIndex, endIndex);
    }
  });

  // Limpar máquinas de nodes offline
  configurations.forEach((config, index) => {
    if (!statusMap.get(config.id)?.is_online) {
      newConfigurations[index].machines = [];
    }
  });

  // Atualizar configurações no banco
  const { error } = await supabase
    .from('system_settings')
    .update({ 
      esp32_configurations: newConfigurations,
      updated_at: new Date().toISOString()
    })
    .eq('id', (await supabase.from('system_settings').select('id').single()).data?.id);

  if (error) {
    throw new Error(`Error updating configurations: ${error.message}`);
  }

  return {
    redistributedNodes: onlineNodes.length,
    totalMachines: allMachines.length,
    machinesPerNode,
    newDistribution: newConfigurations.map(c => ({
      nodeId: c.id,
      machineCount: c.machines.length,
      machines: c.machines
    }))
  };
}

async function handleFailover(
  configurations: ESP32Config[],
  statusMap: Map<string, any>,
  sourceNodeId: string,
  targetNodeId: string,
  supabase: any
): Promise<any> {
  console.log(`Handling failover from ${sourceNodeId} to ${targetNodeId}...`);

  const sourceNode = configurations.find(c => c.id === sourceNodeId);
  const targetNode = configurations.find(c => c.id === targetNodeId);

  if (!sourceNode || !targetNode) {
    throw new Error('Source or target node not found');
  }

  // Verificar se o target node está online
  const targetStatus = statusMap.get(targetNodeId);
  if (!targetStatus?.is_online) {
    throw new Error('Target node is offline');
  }

  // Mover máquinas do source para o target
  const newConfigurations = [...configurations];
  const sourceIndex = newConfigurations.findIndex(c => c.id === sourceNodeId);
  const targetIndex = newConfigurations.findIndex(c => c.id === targetNodeId);

  if (sourceIndex !== -1 && targetIndex !== -1) {
    const machinesToMove = [...newConfigurations[sourceIndex].machines];
    newConfigurations[targetIndex].machines = [
      ...newConfigurations[targetIndex].machines,
      ...machinesToMove
    ];
    newConfigurations[sourceIndex].machines = [];

    // Atualizar no banco
    const { error } = await supabase
      .from('system_settings')
      .update({ 
        esp32_configurations: newConfigurations,
        updated_at: new Date().toISOString()
      })
      .eq('id', (await supabase.from('system_settings').select('id').single()).data?.id);

    if (error) {
      throw new Error(`Error updating configurations: ${error.message}`);
    }

    // Notificar ESP32s sobre a mudança
    await notifyESP32OfChange(targetNode.host, targetNode.port, {
      action: 'machines_added',
      machines: machinesToMove
    });

    return {
      sourceNode: sourceNodeId,
      targetNode: targetNodeId,
      machinesMoved: machinesToMove.length,
      machines: machinesToMove
    };
  }

  throw new Error('Failed to perform failover');
}

async function optimizeLoadDistribution(
  configurations: ESP32Config[],
  statusMap: Map<string, any>,
  supabase: any
): Promise<any> {
  console.log('Optimizing load distribution...');

  // Implementar algoritmo de otimização baseado em:
  // 1. Carga atual de cada node
  // 2. Latência de rede
  // 3. Capacidade de processamento
  // 4. Localização física das máquinas

  const onlineNodes = configurations.filter(config => 
    statusMap.get(config.id)?.is_online === true
  );

  if (onlineNodes.length === 0) {
    throw new Error('No online nodes available for optimization');
  }

  // Calcular métricas de carga
  const nodeMetrics = onlineNodes.map(node => {
    const status = statusMap.get(node.id);
    return {
      nodeId: node.id,
      currentLoad: node.machines.length,
      uptime: status?.uptime_seconds || 0,
      signalStrength: status?.signal_strength || 0,
      location: node.location
    };
  });

  // Algoritmo simples de balanceamento baseado em carga atual
  const totalMachines = configurations.reduce((sum, config) => sum + config.machines.length, 0);
  const optimalLoad = Math.ceil(totalMachines / onlineNodes.length);

  const newConfigurations = [...configurations];
  
  // Redistribuir com base na carga ótima
  const allMachines: string[] = [];
  configurations.forEach(config => allMachines.push(...config.machines));

  let machineIndex = 0;
  onlineNodes.forEach((node, index) => {
    const configIndex = newConfigurations.findIndex(c => c.id === node.id);
    if (configIndex !== -1) {
      const startIndex = index * optimalLoad;
      const endIndex = Math.min(startIndex + optimalLoad, allMachines.length);
      newConfigurations[configIndex].machines = allMachines.slice(startIndex, endIndex);
    }
  });

  // Atualizar configurações
  const { error } = await supabase
    .from('system_settings')
    .update({ 
      esp32_configurations: newConfigurations,
      updated_at: new Date().toISOString()
    })
    .eq('id', (await supabase.from('system_settings').select('id').single()).data?.id);

  if (error) {
    throw new Error(`Error updating optimized configurations: ${error.message}`);
  }

  return {
    optimizedNodes: onlineNodes.length,
    optimalLoadPerNode: optimalLoad,
    metrics: nodeMetrics,
    newDistribution: newConfigurations.map(c => ({
      nodeId: c.id,
      machineCount: c.machines.length
    }))
  };
}

async function notifyESP32OfChange(host: string, port: number, payload: any): Promise<void> {
  try {
    console.log(`Notifying ESP32 at ${host}:${port} of configuration change...`);
    
    // Em um ambiente real, enviaria uma notificação HTTP para o ESP32
    // Para simulação, apenas logamos a operação
    console.log(`Notification sent to ${host}:${port}:`, payload);
    
    // Simular chamada HTTP (descomentado para implementação real)
    /*
    const response = await fetch(`http://${host}:${port}/config-update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      console.error(`Failed to notify ESP32 at ${host}:${port}`);
    }
    */
  } catch (error) {
    console.error(`Error notifying ESP32 at ${host}:${port}:`, error);
  }
}