import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ESP32ControlRequest {
  esp32_id: string;
  relay_pin: number;
  action: 'on' | 'off';
  machine_id: string;
  transaction_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { esp32_id, relay_pin, action, machine_id, transaction_id } = await req.json() as ESP32ControlRequest;

    console.log(`🎮 Controle ESP32: ${esp32_id} relay ${relay_pin} → ${action}`);

    // Verificar se ESP32 está online
    const { data: esp32Status, error: statusError } = await supabase
      .from('esp32_status')
      .select('is_online, ip_address, last_heartbeat')
      .eq('esp32_id', esp32_id)
      .single();

    if (statusError || !esp32Status) {
      console.error('❌ ESP32 não encontrado:', statusError);
      
      // Adicionar à fila de comandos pendentes
      await supabase.from('pending_commands').insert({
        esp32_id,
        relay_pin,
        action,
        machine_id,
        transaction_id,
        status: 'pending'
      });

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'ESP32 offline - comando adicionado à fila',
          queued: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 }
      );
    }

    if (!esp32Status.is_online) {
      console.warn('⚠️ ESP32 offline, adicionando à fila');
      
      await supabase.from('pending_commands').insert({
        esp32_id,
        relay_pin,
        action,
        machine_id,
        transaction_id,
        status: 'pending'
      });

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'ESP32 offline - comando adicionado à fila',
          queued: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 }
      );
    }

    // Enviar comando HTTP direto para ESP32
    const esp32Url = `http://${esp32Status.ip_address}/relay/${relay_pin}/${action}`;
    console.log(`🌐 Enviando comando: ${esp32Url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const response = await fetch(esp32Url, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`ESP32 respondeu com status ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ ESP32 respondeu:', result);

      // Atualizar status da máquina
      await supabase
        .from('machines')
        .update({ 
          status: action === 'on' ? 'running' : 'available',
          updated_at: new Date().toISOString()
        })
        .eq('id', machine_id);

      // Atualizar relay_status no esp32_status
      const relayKey = `relay_${relay_pin}`;
      const { data: currentStatus } = await supabase
        .from('esp32_status')
        .select('relay_status, laundry_id')
        .eq('esp32_id', esp32_id)
        .single();

      const updatedRelayStatus = {
        ...(currentStatus?.relay_status || {}),
        [relayKey]: action === 'on' ? 'on' : 'off'
      };

      await supabase
        .from('esp32_status')
        .update({ 
          relay_status: updatedRelayStatus,
          updated_at: new Date().toISOString()
        })
        .eq('esp32_id', esp32_id);

      console.log(`✅ Relay status atualizado: ${esp32_id} -> ${JSON.stringify(updatedRelayStatus)}`);

      // Registrar no audit log
      await supabase.from('audit_logs').insert({
        action: 'ESP32_CONTROL',
        table_name: 'machines',
        record_id: machine_id,
        new_values: { esp32_id, relay_pin, action, transaction_id, relay_status: updatedRelayStatus }
      });

      return new Response(
        JSON.stringify({ success: true, result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
      clearTimeout(timeoutId);
      console.error('❌ Erro ao comunicar com ESP32:', error);

      // Adicionar à fila para retry
      await supabase.from('pending_commands').insert({
        esp32_id,
        relay_pin,
        action,
        machine_id,
        transaction_id,
        status: 'pending',
        retry_count: 0
      });

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Timeout ao comunicar com ESP32',
          queued: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 504 }
      );
    }

  } catch (error) {
    console.error('❌ Erro no edge function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
