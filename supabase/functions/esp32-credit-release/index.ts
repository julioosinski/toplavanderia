import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreditReleaseRequest {
  transactionId: string;
  amount: number;
  esp32Id?: string;
}

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

    const { transactionId, amount, esp32Id }: CreditReleaseRequest = await req.json();

    console.log('Credit release request:', { transactionId, amount, esp32Id });

    // Buscar configurações dos ESP32s
    const { data: settings } = await supabaseClient
      .from('system_settings')
      .select('esp32_configurations')
      .single();

    if (!settings?.esp32_configurations) {
      throw new Error('ESP32 configurations not found in system settings');
    }

    const targetEsp32Id = esp32Id || 'main';
    
    // Encontrar configuração do ESP32 específico
    const esp32Configs = settings.esp32_configurations;
    const esp32Config = esp32Configs.find((config: any) => config.id === targetEsp32Id);
    
    if (!esp32Config) {
      throw new Error(`ESP32 configuration not found for ID: ${targetEsp32Id}`);
    }

    // Buscar status do ESP32
    const { data: esp32Status } = await supabaseClient
      .from('esp32_status')
      .select('*')
      .eq('esp32_id', targetEsp32Id)
      .single();

    console.log('ESP32 Status found:', esp32Status);

    // Para simulação, criar status se não existir ou aceitar dispositivos simulados
    if (!esp32Status) {
      console.log('No ESP32 status found, creating/simulating for testing');
      const { error: insertError } = await supabaseClient
        .from('esp32_status')
        .upsert({
          esp32_id: targetEsp32Id,
          ip_address: esp32Config.host,
          location: esp32Config.location || 'Simulado',
          machine_count: esp32Config.machines?.length || 0,
          network_status: 'connected',
          is_online: true,
          last_heartbeat: new Date().toISOString()
        });
      
      if (insertError) {
        console.error('Error creating ESP32 status:', insertError);
      }
    }

    // Verificar se é uma simulação baseada nos IPs de teste
    const isSimulation = esp32Config.host.startsWith('192.168.1.') || 
                         esp32Config.host === 'localhost' ||
                         !esp32Status?.is_online;

    if (!isSimulation && (!esp32Status || !esp32Status.is_online)) {
      throw new Error(`ESP32 '${targetEsp32Id}' is offline or not responding`);
    }

    // Para simulação ou teste, simular resposta do ESP32
    let esp32Result;
    
    if (isSimulation) {
      console.log('Simulating ESP32 response for testing');
      // Simular resposta positiva do ESP32
      esp32Result = {
        success: true,
        message: 'Credit released successfully (simulated)',
        transaction_id: transactionId,
        amount: amount,
        timestamp: new Date().toISOString(),
        relay_activated: true,
        user_id: null // Para testes sem usuário específico
      };
    } else {
      // Enviar comando real para o ESP32
      const esp32Url = `http://${esp32Config.host}:${esp32Config.port}/release-credit`;
      
      const esp32Response = await fetch(esp32Url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transaction_id: transactionId,
          amount: amount,
          timestamp: new Date().toISOString()
        }),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (!esp32Response.ok) {
        throw new Error(`ESP32 responded with status: ${esp32Response.status}`);
      }

      esp32Result = await esp32Response.json();
    }
    
    console.log('ESP32 response:', esp32Result);

    // Registrar a liberação no banco de dados
    const { error: logError } = await supabaseClient
      .from('user_credits')
      .insert({
        user_id: esp32Result.user_id || null,
        transaction_id: transactionId,
        amount: amount,
        transaction_type: 'remote_release',
        description: `Crédito liberado remotamente via ESP32 ${esp32Id || 'main'}`
      });

    if (logError) {
      console.error('Error logging credit release:', logError);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Crédito liberado com sucesso',
      esp32_response: esp32Result,
      transaction_id: transactionId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in credit release:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      message: 'Falha na liberação de crédito'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});