import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRACE_MINUTES = 2;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find machines that are 'running' past their cycle time + grace
    const { data: runningMachines, error } = await supabase
      .from("machines")
      .select("id, updated_at, cycle_time_minutes, esp32_id, relay_pin, laundry_id")
      .eq("status", "running");

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date();
    const released: string[] = [];

    for (const machine of runningMachines || []) {
      if (!machine.updated_at) continue;

      const lastUpdate = new Date(machine.updated_at);
      const minutesSince = (now.getTime() - lastUpdate.getTime()) / 60000;
      const cycleTime = machine.cycle_time_minutes || 40;

      if (minutesSince >= cycleTime + GRACE_MINUTES) {
        // Release machine
        const { error: upErr } = await supabase
          .from("machines")
          .update({ status: "available", updated_at: now.toISOString() })
          .eq("id", machine.id);

        if (upErr) {
          console.error(`Failed to release machine ${machine.id}:`, upErr);
          continue;
        }

        released.push(machine.id);

        // Mirror relay_status OFF in esp32_status
        if (machine.esp32_id && machine.laundry_id) {
          const pin = machine.relay_pin ?? 1;
          const relayKey = `relay_${pin}`;

          const { data: row } = await supabase
            .from("esp32_status")
            .select("relay_status")
            .eq("esp32_id", machine.esp32_id)
            .eq("laundry_id", machine.laundry_id)
            .maybeSingle();

          if (row) {
            const prev = (row.relay_status as Record<string, string> | null) || {};
            const next = { ...prev, [relayKey]: "off" };

            await supabase
              .from("esp32_status")
              .update({ relay_status: next, updated_at: now.toISOString() })
              .eq("esp32_id", machine.esp32_id)
              .eq("laundry_id", machine.laundry_id);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ released, count: released.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
