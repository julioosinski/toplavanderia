import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-totem-settings-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : 'Erro inesperado';
};

const isTotemSettingsAuthorized = (req: Request) => {
  const secret = Deno.env.get('TOTEM_SETTINGS_SECRET');
  if (!secret) return true;

  return req.headers.get('x-totem-settings-secret') === secret;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!isTotemSettingsAuthorized(req)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Totem settings não autorizado',
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { laundry_id } = await req.json();

    if (!laundry_id) {
      return new Response(JSON.stringify({ success: false, error: 'laundry_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data, error } = await supabaseClient
      .rpc('get_totem_settings', { _laundry_id: laundry_id });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, settings: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error fetching totem settings:', error);
    return new Response(JSON.stringify({
      success: false, error: getErrorMessage(error)
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
