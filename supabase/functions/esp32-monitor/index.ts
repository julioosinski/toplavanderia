import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'status';

    // ==================== POLL COMMANDS ====================
    if (action === 'poll_commands') {
      const esp32_id = url.searchParams.get('esp32_id');
      if (!esp32_id) {
        return new Response(JSON.stringify({ success: false, error: 'esp32_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: commands, error } = await supabaseClient
        .from('pending_commands')
        .select('id, relay_pin, action, machine_id, transaction_id')
        .eq('esp32_id', esp32_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(10);

      if (error) {
        console.error('Error fetching commands:', error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Enrich ON commands with cycle_time_minutes from machines table
      const enrichedCommands = [];
      for (const cmd of (commands || [])) {
        if (cmd.action === 'on' || cmd.action === 'activate' || cmd.action === 'turn_on') {
          const { data: machine } = await supabaseClient
            .from('machines')
            .select('cycle_time_minutes')
            .eq('id', cmd.machine_id)
            .single();
          enrichedCommands.push({ ...cmd, cycle_time_minutes: machine?.cycle_time_minutes ?? null });
        } else {
          enrichedCommands.push(cmd);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        commands: enrichedCommands,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==================== CONFIRM COMMAND ====================
    if (action === 'confirm_command') {
      const body = await req.json();
      const { command_id, esp32_id } = body;

      if (!command_id || !esp32_id) {
        return new Response(JSON.stringify({ success: false, error: 'command_id and esp32_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get command details
      const { data: command, error: cmdError } = await supabaseClient
        .from('pending_commands')
        .select('*')
        .eq('id', command_id)
        .eq('esp32_id', esp32_id)
        .single();

      if (cmdError || !command) {
        return new Response(JSON.stringify({ success: false, error: 'Command not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // CHECK (status) permite completed, não "executed"
      const { error: updErr } = await supabaseClient
        .from('pending_commands')
        .update({
          status: 'completed',
          executed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', command_id);

      if (updErr) {
        console.error('pending_commands update failed:', updErr);
        return new Response(JSON.stringify({ success: false, error: updErr.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update machine status
      const newStatus = command.action === 'on' ? 'running' : 'available';
      await supabaseClient
        .from('machines')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', command.machine_id);

      // Update relay_status in esp32_status
      const relayKey = `relay_${command.relay_pin}`;
      const { data: currentStatus } = await supabaseClient
        .from('esp32_status')
        .select('relay_status')
        .eq('esp32_id', esp32_id)
        .single();

      const updatedRelayStatus = {
        ...(currentStatus?.relay_status as Record<string, string> || {}),
        [relayKey]: command.action === 'on' ? 'on' : 'off'
      };

      await supabaseClient
        .from('esp32_status')
        .update({ relay_status: updatedRelayStatus, updated_at: new Date().toISOString() })
        .eq('esp32_id', esp32_id);

      console.log(`✅ Command ${command_id} confirmed by ${esp32_id}: relay_${command.relay_pin} → ${command.action}`);

      // Audit log
      await supabaseClient.from('audit_logs').insert({
        action: 'ESP32_COMMAND_EXECUTED',
        table_name: 'pending_commands',
        record_id: command_id,
        new_values: { esp32_id, relay_pin: command.relay_pin, action: command.action, machine_id: command.machine_id }
      });

      return new Response(JSON.stringify({ success: true, message: 'Command confirmed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==================== HEARTBEAT ====================
    if (action === 'heartbeat') {
      const heartbeatData = await req.json();
      console.log('Received heartbeat:', heartbeatData);

      // === AUTO-REGISTRO ===
      if (heartbeatData.auto_register) {
        const { data: existing } = await supabaseClient
          .from('esp32_status')
          .select('id, registration_status')
          .eq('esp32_id', heartbeatData.esp32_id)
          .eq('laundry_id', heartbeatData.laundry_id)
          .maybeSingle();

        if (!existing) {
          console.log(`🆕 Novo ESP32 detectado: ${heartbeatData.esp32_id}`);
          
          await supabaseClient.from('esp32_status').insert({
            esp32_id: heartbeatData.esp32_id,
            laundry_id: heartbeatData.laundry_id,
            ip_address: heartbeatData.ip_address,
            signal_strength: heartbeatData.signal_strength,
            network_status: heartbeatData.network_status || 'connected',
            firmware_version: heartbeatData.firmware_version,
            uptime_seconds: heartbeatData.uptime_seconds,
            device_name: heartbeatData.device_name || null,
            registration_status: 'pending',
            is_online: true,
            last_heartbeat: new Date().toISOString(),
            relay_status: heartbeatData.relay_status || {},
          });

          return new Response(JSON.stringify({
            success: true, message: 'Auto-registered as pending',
            status: 'pending_approval', next_interval: 30,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (existing.registration_status === 'rejected') {
          // Allow re-registration: reset to pending so admin can re-approve
          console.log(`🔄 Rejected ESP32 ${heartbeatData.esp32_id} re-connecting, resetting to pending`);
          await supabaseClient
            .from('esp32_status')
            .update({
              registration_status: 'pending',
              is_online: true,
              last_heartbeat: new Date().toISOString(),
              ip_address: heartbeatData.ip_address,
              signal_strength: heartbeatData.signal_strength,
              firmware_version: heartbeatData.firmware_version,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          return new Response(JSON.stringify({
            success: true, message: 'Re-registered as pending',
            status: 'pending_approval', next_interval: 30,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // Process relay_status — remap firmware keys to DB relay_pin
      let rawRelayStatus: Record<string, unknown> = {};
      if (heartbeatData.relay_status) {
        rawRelayStatus = typeof heartbeatData.relay_status === 'object' 
          ? heartbeatData.relay_status 
          : { status: heartbeatData.relay_status };
      }

      // Fetch machines for this ESP32 to build firmware→DB relay mapping
      const esp32Id = heartbeatData.esp32_id || 'main';
      const { data: esp32Machines } = await supabaseClient
        .from('machines')
        .select('id, relay_pin, capacity_kg, price_per_cycle, cycle_time_minutes')
        .eq('esp32_id', esp32Id)
        .eq('laundry_id', heartbeatData.laundry_id);

      // Build mapping: firmware relay key → DB relay_pin
      // If ESP32 controls 1 machine, relay_1 from firmware maps to whatever relay_pin is in DB
      // If multiple machines, map by index (relay_1→first machine, relay_2→second, etc.)
      const firmwareToDB: Record<string, number> = {};
      if (esp32Machines && esp32Machines.length === 1) {
        // Single machine: any relay_N from firmware maps to the DB relay_pin
        const dbPin = esp32Machines[0].relay_pin ?? 1;
        for (const key of Object.keys(rawRelayStatus)) {
          const match = key.match(/^relay_(\d+)$/);
          if (match) {
            firmwareToDB[key] = dbPin;
          }
        }
      } else if (esp32Machines && esp32Machines.length > 1) {
        // Multiple machines: assume firmware relay_N matches DB relay_pin N
        for (const m of esp32Machines) {
          firmwareToDB[`relay_${m.relay_pin}`] = m.relay_pin ?? 1;
        }
      }

      // Remap relay_status keys from firmware numbering to DB numbering
      const remappedRelayStatus: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rawRelayStatus)) {
        const dbPin = firmwareToDB[key];
        if (dbPin !== undefined) {
          remappedRelayStatus[`relay_${dbPin}`] = value;
        } else {
          // Keep non-relay keys or unmapped keys as-is
          remappedRelayStatus[key] = value;
        }
      }

      console.log(`🔄 Relay remap for ${esp32Id}: firmware=${JSON.stringify(rawRelayStatus)} → db=${JSON.stringify(remappedRelayStatus)}`);

      // Get current status for change detection and merge
      const { data: currentStatus } = await supabaseClient
        .from('esp32_status')
        .select('relay_status, laundry_id')
        .eq('esp32_id', esp32Id)
        .eq('laundry_id', heartbeatData.laundry_id)
        .single();

      const currentRelayStatus = (currentStatus?.relay_status as Record<string, string>) || {};

      // Detect relay changes for transactions (using remapped keys)
      if (currentStatus) {
        for (const [key, value] of Object.entries(remappedRelayStatus)) {
          const currentValue = currentRelayStatus[key];
          const relayNumber = key.match(/\d+/)?.[0];
          
          if (currentValue === 'off' && value === 'on') {
            const machine = esp32Machines?.find(m => m.relay_pin === (relayNumber ? parseInt(relayNumber) : 1));
            if (machine) {
              const estimatedWeight = machine.capacity_kg * 0.8;
              const totalAmount = estimatedWeight * machine.price_per_cycle;
              await supabaseClient.from('transactions').insert({
                machine_id: machine.id, laundry_id: heartbeatData.laundry_id,
                status: 'pending', weight_kg: estimatedWeight,
                duration_minutes: machine.cycle_time_minutes, total_amount: totalAmount,
                payment_method: 'credit', started_at: new Date().toISOString()
              });
            }
          }
          
          if (currentValue === 'on' && value === 'off') {
            const machine = esp32Machines?.find(m => m.relay_pin === (relayNumber ? parseInt(relayNumber) : 1));
            if (machine) {
              await supabaseClient.from('transactions')
                .update({ status: 'completed', completed_at: new Date().toISOString() })
                .eq('machine_id', machine.id).eq('status', 'pending')
                .order('started_at', { ascending: false }).limit(1);
            }
          }
        }
      }

      // Merge: keep existing relay states, overlay with new remapped values
      const mergedRelayStatus = { ...currentRelayStatus, ...remappedRelayStatus };
      
      const { error } = await supabaseClient.from('esp32_status').upsert({
        esp32_id: esp32Id,
        laundry_id: heartbeatData.laundry_id,
        ip_address: heartbeatData.ip_address,
        signal_strength: heartbeatData.signal_strength,
        network_status: heartbeatData.network_status || 'connected',
        firmware_version: heartbeatData.firmware_version,
        uptime_seconds: heartbeatData.uptime_seconds,
        relay_status: mergedRelayStatus,
        device_name: heartbeatData.device_name || null,
        is_online: true,
        last_heartbeat: new Date().toISOString()
      }, { onConflict: 'esp32_id,laundry_id' });

      if (error) {
        console.error('Error updating ESP32 status:', error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Auto-mark stale ESP32s as offline (heartbeat older than 3 minutes)
      const staleThreshold = new Date(Date.now() - 3 * 60 * 1000).toISOString();
      await supabaseClient
        .from('esp32_status')
        .update({ is_online: false, updated_at: new Date().toISOString() })
        .eq('is_online', true)
        .lt('last_heartbeat', staleThreshold);

      // Fetch machine config (cycle_time_minutes) for this ESP32
      const { data: machineConfigs } = await supabaseClient
        .from('machines')
        .select('relay_pin, cycle_time_minutes')
        .eq('esp32_id', heartbeatData.esp32_id || 'main')
        .eq('laundry_id', heartbeatData.laundry_id);

      const config: Record<string, unknown> = {};
      if (machineConfigs && machineConfigs.length > 0) {
        // If single machine, flat field; if multiple, keyed by relay_pin
        if (machineConfigs.length === 1) {
          config.cycle_time_minutes = machineConfigs[0].cycle_time_minutes;
        } else {
          const perRelay: Record<string, number | null> = {};
          for (const m of machineConfigs) {
            perRelay[`relay_${m.relay_pin}`] = m.cycle_time_minutes;
          }
          config.cycle_time_per_relay = perRelay;
        }
      }

      return new Response(JSON.stringify({
        success: true, message: 'Heartbeat received', next_interval: 30, config
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ==================== STATUS ====================
    if (action === 'status') {
      const { data: allStatus, error } = await supabaseClient
        .from('esp32_status')
        .select('*');

      if (error) {
        throw error;
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Status check completed',
        results: allStatus || []
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      success: false, error: 'Invalid action',
      message: 'Action must be "status", "heartbeat", "poll_commands", or "confirm_command"'
    }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('Error in ESP32 monitor:', error);
    return new Response(JSON.stringify({
      success: false, error: error.message, message: 'Error in ESP32 monitoring'
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
