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

    // Buscar configurações do sistema
    const { data: settings } = await supabaseClient
      .from('system_settings')
      .select('esp32_host, esp32_port')
      .single();

    if (!settings?.esp32_host) {
      throw new Error('ESP32 host not configured in system settings');
    }

    // Buscar status do ESP32
    const { data: esp32Status } = await supabaseClient
      .from('esp32_status')
      .select('*')
      .eq('esp32_id', esp32Id || 'main')
      .single();

    if (!esp32Status?.is_online) {
      throw new Error('ESP32 is offline or not responding');
    }

    // Enviar comando de liberação de crédito para o ESP32
    const esp32Url = `http://${settings.esp32_host}:${settings.esp32_port}/release-credit`;
    
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

    const esp32Result = await esp32Response.json();
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