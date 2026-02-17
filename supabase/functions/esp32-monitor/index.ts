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

      return new Response(JSON.stringify({
        success: true,
        commands: commands || [],
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

      // Mark as executed
      await supabaseClient
        .from('pending_commands')
        .update({ status: 'executed', executed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', command_id);

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
          return new Response(JSON.stringify({
            success: false, message: 'Device rejected',
            status: 'rejected', next_interval: 300,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // Process relay_status
      let relayStatusToSave: Record<string, unknown> = {};
      if (heartbeatData.relay_status) {
        relayStatusToSave = typeof heartbeatData.relay_status === 'object' 
          ? heartbeatData.relay_status 
          : { status: heartbeatData.relay_status };
      }

      // Detect relay changes for transactions
      const { data: currentStatus } = await supabaseClient
        .from('esp32_status')
        .select('relay_status, laundry_id')
        .eq('esp32_id', heartbeatData.esp32_id || 'main')
        .eq('laundry_id', heartbeatData.laundry_id)
        .single();
      
      if (currentStatus && typeof relayStatusToSave === 'object') {
        for (const [key, value] of Object.entries(relayStatusToSave)) {
          const currentValue = (currentStatus.relay_status as Record<string, string>)?.[key];
          
          if (currentValue === 'off' && value === 'on') {
            const relayNumber = key.match(/\d+/)?.[0];
            const { data: machine } = await supabaseClient
              .from('machines')
              .select('id, price_per_kg, capacity_kg, cycle_time_minutes')
              .eq('esp32_id', heartbeatData.esp32_id || 'main')
              .eq('relay_pin', relayNumber ? parseInt(relayNumber) : 1)
              .eq('laundry_id', heartbeatData.laundry_id)
              .single();
            
            if (machine) {
              const estimatedWeight = machine.capacity_kg * 0.8;
              const totalAmount = estimatedWeight * machine.price_per_kg;
              await supabaseClient.from('transactions').insert({
                machine_id: machine.id, laundry_id: heartbeatData.laundry_id,
                status: 'pending', weight_kg: estimatedWeight,
                duration_minutes: machine.cycle_time_minutes, total_amount: totalAmount,
                payment_method: 'credit', started_at: new Date().toISOString()
              });
            }
          }
          
          if (currentValue === 'on' && value === 'off') {
            const relayNumber = key.match(/\d+/)?.[0];
            const { data: machine } = await supabaseClient
              .from('machines').select('id')
              .eq('esp32_id', heartbeatData.esp32_id || 'main')
              .eq('relay_pin', relayNumber ? parseInt(relayNumber) : 1)
              .eq('laundry_id', heartbeatData.laundry_id)
              .single();
            
            if (machine) {
              await supabaseClient.from('transactions')
                .update({ status: 'completed', completed_at: new Date().toISOString() })
                .eq('machine_id', machine.id).eq('status', 'pending')
                .order('started_at', { ascending: false }).limit(1);
            }
          }
        }
      }
      
      const { error } = await supabaseClient.from('esp32_status').upsert({
        esp32_id: heartbeatData.esp32_id || 'main',
        laundry_id: heartbeatData.laundry_id,
        ip_address: heartbeatData.ip_address,
        signal_strength: heartbeatData.signal_strength,
        network_status: heartbeatData.network_status || 'connected',
        firmware_version: heartbeatData.firmware_version,
        uptime_seconds: heartbeatData.uptime_seconds,
        relay_status: relayStatusToSave,
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

      return new Response(JSON.stringify({
        success: true, message: 'Heartbeat received', next_interval: 30
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

  } catch (error) {
    console.error('Error in ESP32 monitor:', error);
    return new Response(JSON.stringify({
      success: false, error: error.message, message: 'Error in ESP32 monitoring'
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
