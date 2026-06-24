import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-machine-control-secret',
};

interface ESP32ControlRequest {
  esp32_id: string;
  relay_pin?: number;
  action: 'on' | 'off' | 'credito';
  machine_id: string;
  transaction_id?: string;
  payload?: Record<string, unknown>;
}

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : 'Erro inesperado';
};

const isAuthenticatedUser = async (req: Request, supabase: ReturnType<typeof createClient>) => {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return false;

  const { data: { user } } = await supabase.auth.getUser(token);
  return Boolean(user);
};

const isMachineControlAuthorized = async (req: Request, supabase: ReturnType<typeof createClient>) => {
  const secret = Deno.env.get('MACHINE_CONTROL_SECRET');
  if (!secret) return true;

  return req.headers.get('x-machine-control-secret') === secret ||
    await isAuthenticatedUser(req, supabase);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (!await isMachineControlAuthorized(req, supabase)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Controle de máquina não autorizado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { esp32_id, relay_pin, action, machine_id, transaction_id, payload } = await req.json() as ESP32ControlRequest;

    if (!esp32_id || !machine_id || !action) {
      return new Response(
        JSON.stringify({ success: false, error: 'esp32_id, machine_id e action são obrigatórios' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const resolvedRelayPin = action === 'credito' ? (relay_pin ?? 0) : (relay_pin ?? 1);
    const resolvedPayload = payload ?? {};

    console.log(`🎮 Controle ESP32: ${esp32_id} relay ${resolvedRelayPin} → ${action}`);

    // Inserir comando na fila - o ESP32 vai buscar via polling
    const { data, error } = await supabase.from('pending_commands').insert({
      esp32_id,
      relay_pin: resolvedRelayPin,
      action,
      machine_id,
      transaction_id,
      payload: resolvedPayload,
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

    // Registrar no audit log sem derrubar o fluxo principal caso o log falhe.
    const { error: auditError } = await supabase.from('audit_logs').insert({
      action: 'ESP32_CONTROL_QUEUED',
      table_name: 'pending_commands',
      record_id: data.id,
      new_values: { esp32_id, relay_pin, action, transaction_id, command_id: data.id }
    });
    if (auditError) {
      console.warn('⚠️ Falha ao registrar audit log (comando mantido na fila):', auditError.message);
    }

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
