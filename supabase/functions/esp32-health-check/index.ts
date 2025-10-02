import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HealthCheckResult {
  esp32_id: string;
  host: string;
  port: number;
  is_online: boolean;
  response_time_ms: number | null;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[Health Check] Fetching ESP32 configurations...');

    // Buscar configurações dos ESP32s
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('esp32_configurations')
      .limit(1)
      .single();

    if (settingsError) throw settingsError;

    const esp32Configs = settings?.esp32_configurations || [];
    console.log(`[Health Check] Found ${esp32Configs.length} ESP32 configurations`);

    // Testar cada ESP32
    const healthCheckPromises = esp32Configs.map(async (config: any): Promise<HealthCheckResult> => {
      const startTime = Date.now();
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`http://${config.host}:${config.port}/status`, {
          method: 'GET',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;

        if (response.ok) {
          // Atualizar status no banco
          await supabase
            .from('esp32_status')
            .upsert({
              esp32_id: config.id,
              is_online: true,
              last_heartbeat: new Date().toISOString(),
              ip_address: config.host,
              network_status: 'connected',
            });

          return {
            esp32_id: config.id,
            host: config.host,
            port: config.port,
            is_online: true,
            response_time_ms: responseTime,
          };
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error: any) {
        console.error(`[Health Check] ESP32 ${config.id} failed:`, error.message);

        // Marcar como offline
        await supabase
          .from('esp32_status')
          .upsert({
            esp32_id: config.id,
            is_online: false,
            network_status: 'disconnected',
          });

        return {
          esp32_id: config.id,
          host: config.host,
          port: config.port,
          is_online: false,
          response_time_ms: null,
          error: error.message,
        };
      }
    });

    const results = await Promise.all(healthCheckPromises);

    const summary = {
      total: results.length,
      online: results.filter(r => r.is_online).length,
      offline: results.filter(r => !r.is_online).length,
      results,
    };

    console.log('[Health Check] Summary:', summary);

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        summary,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Health Check] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
