import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TransactionWebhookPayload {
  transaction_id: string;
  machine_id: string;
  user_id: string;
  status: 'pending' | 'completed' | 'failed';
  payment_method?: string;
  total_amount: number;
  device_uuid?: string;
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

    const payload: TransactionWebhookPayload = await req.json();
    console.log('[Transaction Webhook] Received:', payload);

    // Validar dados obrigatórios
    if (!payload.transaction_id || !payload.machine_id || !payload.status) {
      throw new Error('Missing required fields: transaction_id, machine_id, status');
    }

    // Atualizar transação
    const { data: transaction, error: updateError } = await supabase
      .from('transactions')
      .update({
        status: payload.status,
        payment_method: payload.payment_method,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.transaction_id)
      .select()
      .single();

    if (updateError) throw updateError;

    console.log('[Transaction Webhook] Updated transaction:', transaction);

    // Se transação foi completada, atualizar estatísticas da máquina
    if (payload.status === 'completed') {
      const { data: machine, error: machineError } = await supabase
        .from('machines')
        .select('total_uses, total_revenue')
        .eq('id', payload.machine_id)
        .single();

      if (!machineError && machine) {
        await supabase
          .from('machines')
          .update({
            total_uses: (machine.total_uses || 0) + 1,
            total_revenue: Number(machine.total_revenue || 0) + Number(payload.total_amount),
            updated_at: new Date().toISOString(),
          })
          .eq('id', payload.machine_id);

        console.log('[Transaction Webhook] Updated machine stats');
      }
    }

    // Registrar log de auditoria
    await supabase
      .from('audit_logs')
      .insert({
        action: 'UPDATE',
        table_name: 'transactions',
        record_id: payload.transaction_id,
        new_values: { status: payload.status, payment_method: payload.payment_method },
        timestamp: new Date().toISOString(),
      });

    return new Response(
      JSON.stringify({
        success: true,
        transaction,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Transaction Webhook] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
