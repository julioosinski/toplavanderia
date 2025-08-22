import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NFSeData {
  companyName: string;
  companyCnpj: string;
  companyEmail: string;
  customerName?: string;
  customerEmail?: string;
  customerDocument?: string;
  serviceDescription: string;
  serviceValue: number;
  transactionId: string;
  machineId: string;
  machineName: string;
  startedAt: string;
  completedAt: string;
  paymentMethod: string;
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

    const { transactionId } = await req.json();

    if (!transactionId) {
      throw new Error('Transaction ID is required');
    }

    console.log('Processing NFSe for transaction:', transactionId);

    // Get transaction details
    const { data: transaction, error: transactionError } = await supabaseClient
      .from('transactions')
      .select(`
        *,
        machines (
          id,
          name,
          type
        )
      `)
      .eq('id', transactionId)
      .eq('status', 'completed')
      .single();

    if (transactionError || !transaction) {
      console.error('Transaction not found or not completed:', transactionError);
      return new Response(
        JSON.stringify({ error: 'Transaction not found or not completed' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get system settings for NFSe configuration
    const { data: settings, error: settingsError } = await supabaseClient
      .from('system_settings')
      .select('nfse_enabled, zapier_webhook_url, company_name, company_cnpj, company_email')
      .single();

    if (settingsError || !settings?.nfse_enabled) {
      console.log('NFSe not enabled or settings not found');
      return new Response(
        JSON.stringify({ message: 'NFSe not enabled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!settings.zapier_webhook_url) {
      console.error('Zapier webhook URL not configured');
      return new Response(
        JSON.stringify({ error: 'Zapier webhook URL not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare NFSe data
    const serviceDescription = `Hospedagem - ${transaction.machines?.name || 'Serviço'} (${transaction.machines?.type === 'washing' ? 'Lavanderia' : 'Secagem'})`;
    
    const nfseData: NFSeData = {
      companyName: settings.company_name || '',
      companyCnpj: settings.company_cnpj || '',
      companyEmail: settings.company_email || '',
      customerName: 'Cliente', // Para pousada, geralmente não temos dados específicos do cliente
      customerEmail: '',
      customerDocument: '',
      serviceDescription,
      serviceValue: Number(transaction.total_amount),
      transactionId: transaction.id,
      machineId: transaction.machine_id,
      machineName: transaction.machines?.name || '',
      startedAt: transaction.started_at || transaction.created_at,
      completedAt: transaction.completed_at || transaction.created_at,
      paymentMethod: transaction.payment_method || 'unknown',
    };

    console.log('Sending NFSe data to Zapier:', nfseData);

    // Send to Zapier webhook
    const zapierResponse = await fetch(settings.zapier_webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...nfseData,
        timestamp: new Date().toISOString(),
        triggered_from: 'supabase_edge_function',
      }),
    });

    if (!zapierResponse.ok) {
      throw new Error(`Zapier webhook failed: ${zapierResponse.status}`);
    }

    console.log('NFSe data sent successfully to Zapier');

    // Log the NFSe request in the database for tracking
    const { error: logError } = await supabaseClient
      .from('transactions')
      .update({
        updated_at: new Date().toISOString(),
        // Add a metadata field to track NFSe status if needed
      })
      .eq('id', transactionId);

    if (logError) {
      console.error('Error updating transaction log:', logError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'NFSe data sent to Zapier successfully',
        transactionId 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in NFSe automation:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});