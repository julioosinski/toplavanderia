import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'status';

    // Buscar configurações do sistema
    const { data: settings } = await supabaseClient
      .from('system_settings')
      .select('*')
      .single();

    if (!settings?.esp32_configurations) {
      throw new Error('ESP32 configurations not found');
    }

    const esp32Configs = settings.esp32_configurations;

    if (action === 'heartbeat') {
      // Receber heartbeat do ESP32
      const heartbeatData = await req.json();
      
      console.log('Received heartbeat:', heartbeatData);

      // Atualizar status no banco
      const { error } = await supabaseClient
        .from('esp32_status')
        .upsert({
          esp32_id: heartbeatData.esp32_id || 'main',
          ip_address: heartbeatData.ip_address,
          signal_strength: heartbeatData.signal_strength,
          network_status: heartbeatData.network_status || 'connected',
          firmware_version: heartbeatData.firmware_version,
          uptime_seconds: heartbeatData.uptime_seconds,
          is_online: true,
          last_heartbeat: new Date().toISOString()
        });

      if (error) {
        console.error('Error updating ESP32 status:', error);
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Heartbeat received',
        next_interval: settings.heartbeat_interval_seconds
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'status') {
      // Verificar status de todos os ESP32s configurados
      const statusResults = [];
      
      for (const esp32Config of esp32Configs) {
        const esp32Url = `http://${esp32Config.host}:${esp32Config.port}/status`;
        
        try {
          const response = await fetch(esp32Url, {
            method: 'GET',
            signal: AbortSignal.timeout(5000) // 5 second timeout
          });

          if (!response.ok) {
            throw new Error(`ESP32 returned status: ${response.status}`);
          }

          const statusData = await response.json();
          
          // Atualizar status no banco
          await supabaseClient
            .from('esp32_status')
            .upsert({
              esp32_id: esp32Config.id,
              ip_address: statusData.ip_address || esp32Config.host,
              signal_strength: statusData.signal_strength,
              network_status: statusData.network_status || 'connected',
              firmware_version: statusData.firmware_version,
              uptime_seconds: statusData.uptime_seconds,
              location: esp32Config.location,
              machine_count: esp32Config.machines?.length || 0,
              relay_status: statusData.relay_status || {},
              is_online: true,
              last_heartbeat: new Date().toISOString()
            });

          statusResults.push({
            esp32_id: esp32Config.id,
            success: true,
            status: statusData
          });

        } catch (fetchError) {
          // ESP32 não está respondendo
          await supabaseClient
            .from('esp32_status')
            .upsert({
              esp32_id: esp32Config.id,
              ip_address: esp32Config.host,
              location: esp32Config.location,
              machine_count: esp32Config.machines?.length || 0,
              network_status: 'offline',
              is_online: false,
              last_heartbeat: new Date().toISOString()
            });

          statusResults.push({
            esp32_id: esp32Config.id,
            success: false,
            error: fetchError.message
          });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Status check completed for all ESP32s',
        results: statusResults
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid action',
      message: 'Action must be "status" or "heartbeat"'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ESP32 monitor:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      message: 'Error in ESP32 monitoring'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});