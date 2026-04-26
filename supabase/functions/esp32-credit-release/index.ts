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

interface UserRole {
  role: string;
  laundry_id: string | null;
}

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : 'Erro inesperado';
};

const canReleaseCredit = (roles: UserRole[], targetLaundryId?: string | null) => {
  if (roles.some((role) => role.role === 'super_admin')) return true;
  if (!targetLaundryId) return false;

  return roles.some((role) =>
    (role.role === 'admin' || role.role === 'operator') &&
    role.laundry_id === targetLaundryId
  );
};

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

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return new Response(JSON.stringify({ success: false, error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let targetESP32Id = esp32Id || 'main';
    let targetLaundryId = laundryId;
    let machineDuration: number | null = null;
    let machineRelayPin: number | null = null;

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
        machineRelayPin = machine.relay_pin || 1;
      } else {
        return new Response(JSON.stringify({ success: false, error: 'Máquina não encontrada' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const { data: roles, error: rolesError } = await supabaseClient
      .from('user_roles')
      .select('role, laundry_id')
      .eq('user_id', user.id)
      .returns<UserRole[]>();

    if (rolesError || !roles || !canReleaseCredit(roles, targetLaundryId)) {
      return new Response(JSON.stringify({ success: false, error: 'Sem permissão para liberar crédito' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (machineId) {
        // Create pending command for ESP32
        const { error: cmdError } = await supabaseClient
          .from('pending_commands')
          .insert({
            esp32_id: targetESP32Id,
            machine_id: machineId,
            relay_pin: machineRelayPin || 1,
            action: 'on',
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

    const now = new Date().toISOString();
    let createdTransactionId: string | null = null;

    if (machineId) {
      const { data: txData, error: txError } = await supabaseClient
        .from('transactions')
        .insert({
          machine_id: machineId,
          laundry_id: targetLaundryId,
          total_amount: amount,
          payment_method: 'manual_release',
          user_id: user.id,
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
        createdTransactionId = txData?.id ?? null;
        console.log('Transaction created:', createdTransactionId);
      }
    }

    const result = {
      success: true,
      message: 'Crédito liberado com sucesso',
      transaction_id: createdTransactionId || transactionId,
      amount,
      esp32_id: targetESP32Id,
      machine_id: machineId || null,
      operator_id: user.id,
      timestamp: now,
    };

    console.log('Credit release result:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in credit release:', error);
    return new Response(JSON.stringify({
      success: false,
      error: getErrorMessage(error),
      message: 'Falha na liberação de crédito'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
