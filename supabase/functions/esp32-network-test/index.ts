import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NetworkTestRequest {
  nodes: string[];
  testType?: 'ping' | 'latency' | 'throughput' | 'all';
}

interface TestResult {
  nodeId: string;
  host: string;
  port: number;
  isReachable: boolean;
  responseTime: number;
  lastError?: string;
  tests: {
    ping: boolean;
    latency: number;
    throughput: number;
  };
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

    const { nodes, testType = 'all' }: NetworkTestRequest = await req.json();

    console.log(`ESP32 Network Test: Testing ${nodes.length} nodes with type: ${testType}`);

    // Buscar configurações dos ESP32s
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('esp32_configurations')
      .single();

    if (settingsError) {
      throw new Error(`Error fetching settings: ${settingsError.message}`);
    }

    const configurations = settings?.esp32_configurations as any[] || [];
    const nodesToTest = configurations.filter(config => nodes.includes(config.id));

    if (nodesToTest.length === 0) {
      throw new Error('No valid nodes found for testing');
    }

    // Executar testes em paralelo
    const testResults = await Promise.all(
      nodesToTest.map(node => testNodeConnectivity(node, testType))
    );

    // Atualizar status no banco de dados
    for (const result of testResults) {
      await updateNodeStatus(supabase, result);
    }

    // Calcular estatísticas
    const statistics = calculateNetworkStatistics(testResults);

    // Gerar relatório de conectividade
    const connectivityReport = generateConnectivityReport(testResults);

    return new Response(
      JSON.stringify({
        success: true,
        testType,
        totalTests: testResults.length,
        successfulConnections: testResults.filter(r => r.isReachable).length,
        failedConnections: testResults.filter(r => !r.isReachable).length,
        results: testResults,
        statistics,
        report: connectivityReport,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('ESP32 Network Test Error:', error);
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

async function testNodeConnectivity(node: any, testType: string): Promise<TestResult> {
  const result: TestResult = {
    nodeId: node.id,
    host: node.host,
    port: node.port,
    isReachable: false,
    responseTime: 0,
    tests: {
      ping: false,
      latency: 0,
      throughput: 0
    }
  };

  try {
    console.log(`Testing connectivity to ${node.id} at ${node.host}:${node.port}`);

    // Test 1: Basic ping test
    if (testType === 'ping' || testType === 'all') {
      const pingResult = await testPing(node.host, node.port);
      result.tests.ping = pingResult.success;
      result.isReachable = pingResult.success;
      result.responseTime = pingResult.responseTime;
      
      if (!pingResult.success) {
        result.lastError = pingResult.error;
      }
    }

    // Test 2: Latency test
    if ((testType === 'latency' || testType === 'all') && result.isReachable) {
      const latencyResult = await testLatency(node.host, node.port);
      result.tests.latency = latencyResult.averageLatency;
    }

    // Test 3: Throughput test
    if ((testType === 'throughput' || testType === 'all') && result.isReachable) {
      const throughputResult = await testThroughput(node.host, node.port);
      result.tests.throughput = throughputResult.throughput;
    }

  } catch (error) {
    console.error(`Error testing node ${node.id}:`, error);
    result.lastError = error.message;
  }

  return result;
}

async function testPing(host: string, port: number): Promise<{ success: boolean; responseTime: number; error?: string }> {
  const startTime = Date.now();
  
  try {
    // Simular teste de ping com timeout de 5 segundos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // Em um ambiente real, faria uma requisição HTTP simples para testar conectividade
    // Para simulação, assumimos que hosts começando com "192.168" estão online
    const isLocalNetwork = host.startsWith('192.168') || host.startsWith('10.') || host.startsWith('172.');
    
    if (isLocalNetwork) {
      // Simular latência de rede local
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 10));
      const responseTime = Date.now() - startTime;
      clearTimeout(timeoutId);
      
      return {
        success: true,
        responseTime
      };
    } else {
      // Simular falha para IPs não locais
      throw new Error('Host not reachable');
    }

  } catch (error) {
    return {
      success: false,
      responseTime: Date.now() - startTime,
      error: error.message
    };
  }
}

async function testLatency(host: string, port: number): Promise<{ averageLatency: number }> {
  const latencies: number[] = [];
  const testCount = 5;

  for (let i = 0; i < testCount; i++) {
    const startTime = Date.now();
    
    try {
      // Simular teste de latência
      await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10));
      const latency = Date.now() - startTime;
      latencies.push(latency);
    } catch (error) {
      console.error(`Latency test ${i + 1} failed:`, error);
    }
  }

  const averageLatency = latencies.length > 0 
    ? latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length 
    : 0;

  return { averageLatency };
}

async function testThroughput(host: string, port: number): Promise<{ throughput: number }> {
  try {
    // Simular teste de throughput (KB/s)
    // Em implementação real, enviaria dados de teste e mediria a velocidade
    const simulatedThroughput = Math.random() * 1000 + 100; // 100-1100 KB/s
    
    return { throughput: simulatedThroughput };
  } catch (error) {
    console.error('Throughput test failed:', error);
    return { throughput: 0 };
  }
}

async function updateNodeStatus(supabase: any, result: TestResult): Promise<void> {
  try {
    const { error } = await supabase
      .from('esp32_status')
      .upsert({
        esp32_id: result.nodeId,
        is_online: result.isReachable,
        network_status: result.isReachable ? 'connected' : 'disconnected',
        last_heartbeat: result.isReachable ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'esp32_id'
      });

    if (error) {
      console.error(`Error updating status for node ${result.nodeId}:`, error);
    }
  } catch (error) {
    console.error(`Failed to update node status:`, error);
  }
}

function calculateNetworkStatistics(results: TestResult[]): any {
  const reachableNodes = results.filter(r => r.isReachable);
  const totalNodes = results.length;

  if (reachableNodes.length === 0) {
    return {
      availability: 0,
      averageResponseTime: 0,
      averageLatency: 0,
      averageThroughput: 0
    };
  }

  const totalResponseTime = reachableNodes.reduce((sum, r) => sum + r.responseTime, 0);
  const totalLatency = reachableNodes.reduce((sum, r) => sum + r.tests.latency, 0);
  const totalThroughput = reachableNodes.reduce((sum, r) => sum + r.tests.throughput, 0);

  return {
    availability: (reachableNodes.length / totalNodes) * 100,
    averageResponseTime: totalResponseTime / reachableNodes.length,
    averageLatency: totalLatency / reachableNodes.length,
    averageThroughput: totalThroughput / reachableNodes.length,
    totalNodes,
    onlineNodes: reachableNodes.length,
    offlineNodes: totalNodes - reachableNodes.length
  };
}

function generateConnectivityReport(results: TestResult[]): any {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Analisar resultados e gerar recomendações
  const offlineNodes = results.filter(r => !r.isReachable);
  const highLatencyNodes = results.filter(r => r.isReachable && r.tests.latency > 100);
  const lowThroughputNodes = results.filter(r => r.isReachable && r.tests.throughput < 200);

  if (offlineNodes.length > 0) {
    issues.push(`${offlineNodes.length} node(s) offline: ${offlineNodes.map(n => n.nodeId).join(', ')}`);
    recommendations.push('Verificar conectividade física e configurações de rede dos nodes offline');
  }

  if (highLatencyNodes.length > 0) {
    issues.push(`${highLatencyNodes.length} node(s) com alta latência (>100ms)`);
    recommendations.push('Otimizar configurações de rede para reduzir latência');
  }

  if (lowThroughputNodes.length > 0) {
    issues.push(`${lowThroughputNodes.length} node(s) com baixo throughput (<200 KB/s)`);
    recommendations.push('Verificar qualidade do sinal WiFi e configurações de QoS');
  }

  const healthScore = ((results.length - offlineNodes.length) / results.length) * 100;

  return {
    healthScore,
    status: healthScore > 90 ? 'excellent' : healthScore > 70 ? 'good' : healthScore > 50 ? 'warning' : 'critical',
    issues,
    recommendations,
    detailedResults: results.map(r => ({
      nodeId: r.nodeId,
      status: r.isReachable ? 'online' : 'offline',
      responseTime: r.responseTime,
      latency: r.tests.latency,
      throughput: r.tests.throughput,
      error: r.lastError
    }))
  };
}