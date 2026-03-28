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

    // Extract user_id from JWT if present
    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseClient.auth.getUser(token);
      if (user) userId = user.id;
    }

    let targetESP32Id = esp32Id || 'main';
    let targetLaundryId = laundryId;
    let machineDuration: number | null = null;

    // Get machine info
    if (machineId) {
      const { data: machine, error: machineError } = await supabaseClient
        .from('machines')
        .select('esp32_id, laundry_id, relay_pin, cycle_time_minutes, price_per_cycle')
        .eq('id', machineId)
        .single();

      if (!machineError && machine) {
        if (machine.esp32_id) targetESP32Id = machine.esp32_id;
        if (machine.laundry_id) targetLaundryId = machine.laundry_id;
        machineDuration = machine.cycle_time_minutes;

        // Create pending command for ESP32
        const { error: cmdError } = await supabaseClient
          .from('pending_commands')
          .insert({
            esp32_id: machine.esp32_id || targetESP32Id,
            machine_id: machineId,
            relay_pin: machine.relay_pin || 1,
            action: 'turn_on',
            status: 'pending',
          });

        if (cmdError) {
          console.error('Error creating pending command:', cmdError);
        } else {
          console.log('Pending command created for machine:', machineId);
        }

        // Update machine status to running
        await supabaseClient
          .from('machines')
          .update({ status: 'running', updated_at: new Date().toISOString() })
          .eq('id', machineId);
      }
    }

    // Create transaction record for reporting
    const now = new Date().toISOString();
    const { data: txData, error: txError } = await supabaseClient
      .from('transactions')
      .insert({
        machine_id: machineId!,
        laundry_id: targetLaundryId,
        total_amount: amount,
        payment_method: 'manual_release',
        user_id: userId,
        status: 'completed',
        started_at: now,
        completed_at: now,
        duration_minutes: machineDuration,
      })
      .select('id')
      .single();

    if (txError) {
      console.error('Error creating transaction:', txError);
    } else {
      console.log('Transaction created:', txData?.id);
    }

    const result = {
      success: true,
      message: 'Crédito liberado com sucesso',
      transaction_id: txData?.id || transactionId,
      amount,
      esp32_id: targetESP32Id,
      machine_id: machineId || null,
      operator_id: userId,
      timestamp: now,
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
