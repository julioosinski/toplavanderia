import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature',
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

const toHex = (buffer: ArrayBuffer) => {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : 'Unexpected error';
};

const verifyWebhookSignature = async (req: Request, rawBody: string) => {
  const secret = Deno.env.get('TRANSACTION_WEBHOOK_SECRET');
  if (!secret) return true;

  const signature = req.headers.get('x-webhook-signature')?.replace(/^sha256=/, '');
  if (!signature) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));

  return toHex(digest) === signature.toLowerCase();
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const rawBody = await req.text();
    const isSignatureValid = await verifyWebhookSignature(req, rawBody);

    if (!isSignatureValid) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid webhook signature' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const payload = JSON.parse(rawBody) as TransactionWebhookPayload;
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
  } catch (error: unknown) {
    console.error('[Transaction Webhook] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: getErrorMessage(error) }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
