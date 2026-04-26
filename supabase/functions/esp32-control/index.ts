import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-machine-control-secret',
};

interface ESP32ControlRequest {
  esp32_id: string;
  relay_pin: number;
  action: 'on' | 'off';
  machine_id: string;
  transaction_id?: string;
}

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : 'Erro inesperado';
};

const isMachineControlAuthorized = (req: Request) => {
  const secret = Deno.env.get('MACHINE_CONTROL_SECRET');
  if (!secret) return true;

  return req.headers.get('x-machine-control-secret') === secret;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!isMachineControlAuthorized(req)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Controle de máquina não autorizado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { esp32_id, relay_pin, action, machine_id, transaction_id } = await req.json() as ESP32ControlRequest;

    console.log(`🎮 Controle ESP32: ${esp32_id} relay ${relay_pin} → ${action}`);

    // Inserir comando na fila - o ESP32 vai buscar via polling
    const { data, error } = await supabase.from('pending_commands').insert({
      esp32_id,
      relay_pin,
      action,
      machine_id,
      transaction_id,
      status: 'pending'
    }).select().single();

    if (error) {
      console.error('❌ Erro ao inserir comando:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`✅ Comando enfileirado: ${data.id} - ESP32 vai executar em até 5s`);

    // Registrar no audit log
    await supabase.from('audit_logs').insert({
      action: 'ESP32_CONTROL_QUEUED',
      table_name: 'pending_commands',
      record_id: data.id,
      new_values: { esp32_id, relay_pin, action, transaction_id, command_id: data.id }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        queued: true, 
        command_id: data.id,
        message: 'Comando enfileirado. ESP32 executará em até 5 segundos.' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('❌ Erro no edge function:', error);
    return new Response(
      JSON.stringify({ success: false, error: getErrorMessage(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
