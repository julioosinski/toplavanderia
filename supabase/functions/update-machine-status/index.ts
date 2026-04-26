import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-machine-control-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : "Unexpected error";
};

const isMachineControlAuthorized = (req: Request) => {
  const secret = Deno.env.get("MACHINE_CONTROL_SECRET");
  if (!secret) return true;

  return req.headers.get("x-machine-control-secret") === secret;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!isMachineControlAuthorized(req)) {
      return new Response(
        JSON.stringify({ error: "Machine control unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { machine_id, status } = await req.json();

    if (!machine_id || !status) {
      return new Response(
        JSON.stringify({ error: "machine_id and status are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only allow safe transitions
    const allowedStatuses = ["running", "available"];
    if (!allowedStatuses.includes(status)) {
      return new Response(
        JSON.stringify({ error: `Status '${status}' not allowed via this endpoint` }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate transition: only available → running or running → available
    const { data: machine, error: fetchErr } = await supabase
      .from("machines")
      .select("id, status, esp32_id, relay_pin, laundry_id")
      .eq("id", machine_id)
      .single();

    if (fetchErr || !machine) {
      return new Response(
        JSON.stringify({ error: "Machine not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Idempotente: totem pode reenviar "running" se já estiver em ciclo (evita 409 e toast falso de "RLS")
    if (status === "running" && machine.status !== "available" && machine.status !== "running") {
      return new Response(
        JSON.stringify({ error: `Cannot transition from '${machine.status}' to 'running'` }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (status === "available" && machine.status === "available") {
      return new Response(
        JSON.stringify({ success: true, machine_id, status, noop: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (status === "running" && machine.status === "running") {
      const now = new Date().toISOString();
      const { error: touchErr } = await supabase
        .from("machines")
        .update({ updated_at: now })
        .eq("id", machine_id);
      if (touchErr) {
        return new Response(
          JSON.stringify({ error: touchErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: true, machine_id, status, noop: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from("machines")
      .update({ status, updated_at: now })
      .eq("id", machine_id);

    if (updateErr) {
      return new Response(
        JSON.stringify({ error: updateErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, machine_id, status }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    return new Response(
      JSON.stringify({ error: getErrorMessage(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
