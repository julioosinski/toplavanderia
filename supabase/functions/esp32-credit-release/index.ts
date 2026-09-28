import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const creditReleaseSchema = z.object({
  transactionId: z.string().min(1).max(120),
  amount: z.number().positive().max(10_000),
  esp32Id: z.string().max(120).optional(),
  machineId: z.string().uuid().optional(),
  laundryId: z.string().uuid().optional(),
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message);
  return 'Erro inesperado';
};

/**
 * Liberação manual via painel.
 * Toda a regra de permissão (dono/super_admin livres; gerente/operador dependem de
 * operator_release_permissions + limites) fica na RPC admin_remote_release, chamada
 * com o JWT do próprio usuário — nunca com service_role.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ success: false, error: 'Não autorizado' }, 401);
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ success: false, error: 'Não autorizado' }, 401);
    }

    const parsed = creditReleaseSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return jsonResponse({ success: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, 400);
    }
    const { transactionId, amount, esp32Id, machineId, laundryId } = parsed.data;

    // Teste de conectividade sem máquina: não enfileira nada, só confirma a permissão.
    if (!machineId) {
      const { data: allowed, error: permError } = await userClient.rpc('can_manual_release', {
        _user_id: user.id,
        _laundry_id: laundryId ?? null,
      });
      if (permError || !allowed) {
        return jsonResponse({ success: false, error: 'Liberação manual não autorizada para este usuário' }, 403);
      }
      return jsonResponse({
        success: true,
        message: 'Teste de permissão concluído (nenhum comando enviado)',
        transaction_id: transactionId,
        amount,
        esp32_id: esp32Id ?? null,
        machine_id: null,
        operator_id: user.id,
        timestamp: new Date().toISOString(),
      });
    }

    const { data: commandId, error: releaseError } = await userClient.rpc('admin_remote_release', {
      _machine_id: machineId,
    });

    if (releaseError) {
      console.warn('Manual release refused:', { user: user.id, machineId, error: releaseError.message });
      return jsonResponse({ success: false, error: releaseError.message, message: releaseError.message }, 403);
    }

    const result = {
      success: true,
      message: 'Crédito liberado com sucesso',
      command_id: commandId,
      transaction_id: transactionId,
      amount,
      esp32_id: esp32Id ?? null,
      machine_id: machineId,
      operator_id: user.id,
      timestamp: new Date().toISOString(),
    };

    console.log('Credit release result:', result);
    return jsonResponse(result);
  } catch (error: unknown) {
    console.error('Error in credit release:', error);
    return jsonResponse({
      success: false,
      error: getErrorMessage(error),
      message: 'Falha na liberação de crédito',
    }, 500);
  }
});
