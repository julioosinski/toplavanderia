import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface CreditReleaseRequest {
  transactionId: string;
  amount: number;
  esp32Id?: string;
  machineId?: string;
  laundryId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { transactionId, amount, esp32Id, machineId, laundryId }: CreditReleaseRequest = await req.json();

    if (!transactionId || !amount) {
      return new Response(JSON.stringify({ success: false, error: 'transactionId and amount are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Credit release request:', { transactionId, amount, esp32Id, machineId, laundryId });

    let targetESP32Id = esp32Id || 'main';
    let targetLaundryId = laundryId;

    // Se machineId fornecido, buscar esp32_id e laundry_id da máquina
    if (machineId) {
      const { data: machine, error: machineError } = await supabaseClient
        .from('machines')
        .select('esp32_id, laundry_id')
        .eq('id', machineId)
        .single();

      if (!machineError && machine) {
        if (machine.esp32_id) targetESP32Id = machine.esp32_id;
        if (machine.laundry_id) targetLaundryId = machine.laundry_id;
      }
    }

    // Buscar configurações do ESP32 filtrando por laundry_id
    let settingsQuery = supabaseClient
      .from('system_settings')
      .select('esp32_configurations');

    if (targetLaundryId) {
      settingsQuery = settingsQuery.eq('laundry_id', targetLaundryId);
    }

    const { data: settings, error: settingsError } = await settingsQuery.limit(1).single();

    if (settingsError || !settings?.esp32_configurations) {
      console.warn('ESP32 configurations not found, proceeding with defaults');
    }

    // Encontrar configuração do ESP32 específico
    let esp32Config: any = null;
    if (settings?.esp32_configurations) {
      const configs = settings.esp32_configurations as any[];
      esp32Config = configs.find((c: any) => c.id === targetESP32Id);
    }

    // Buscar status do ESP32
    const { data: esp32Status } = await supabaseClient
      .from('esp32_status')
      .select('*')
      .eq('esp32_id', targetESP32Id)
      .limit(1)
      .single();

    // Usar abordagem via pending_commands (arquitetura pull)
    // Em vez de chamar HTTP diretamente no ESP32, enfileirar comando
    if (machineId) {
      // Buscar relay_pin da máquina
      const { data: machineData } = await supabaseClient
        .from('machines')
        .select('relay_pin, esp32_id')
        .eq('id', machineId)
        .single();

      if (machineData) {
        const { error: cmdError } = await supabaseClient
          .from('pending_commands')
          .insert({
            esp32_id: machineData.esp32_id || targetESP32Id,
            machine_id: machineId,
            relay_pin: machineData.relay_pin || 1,
            action: 'turn_on',
            status: 'pending',
            transaction_id: null, // transactionId é string, não UUID
          });

        if (cmdError) {
          console.error('Error creating pending command:', cmdError);
        } else {
          console.log('Pending command created for machine:', machineId);
        }

        // Atualizar status da máquina para running
        await supabaseClient
          .from('machines')
          .update({ status: 'running', updated_at: new Date().toISOString() })
          .eq('id', machineId);
      }
    }

    const result = {
      success: true,
      message: 'Crédito liberado com sucesso',
      transaction_id: transactionId,
      amount,
      esp32_id: targetESP32Id,
      machine_id: machineId || null,
      timestamp: new Date().toISOString(),
    };

    console.log('Credit release result:', result);

    return new Response(JSON.stringify(result), {
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
