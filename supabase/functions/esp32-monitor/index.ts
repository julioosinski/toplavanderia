import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'status';

    if (action === 'heartbeat') {
      // Receber heartbeat do ESP32
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
          // Novo ESP32 detectado - criar com status pending
          console.log(`🆕 Novo ESP32 detectado: ${heartbeatData.esp32_id} - criando registro pendente`);
          
          const { error: insertError } = await supabaseClient
            .from('esp32_status')
            .insert({
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

          if (insertError) {
            console.error('Error auto-registering ESP32:', insertError);
          } else {
            console.log(`✅ ESP32 ${heartbeatData.esp32_id} registrado como pendente`);
          }

          return new Response(JSON.stringify({
            success: true,
            message: 'Auto-registered as pending',
            status: 'pending_approval',
            next_interval: 30,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Se já existe mas está rejeitado, não atualizar
        if (existing.registration_status === 'rejected') {
          return new Response(JSON.stringify({
            success: false,
            message: 'Device rejected',
            status: 'rejected',
            next_interval: 300, // Esperar mais antes de tentar novamente
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // Atualizar status no banco
      // Processar relay_status para salvar corretamente
      let relayStatusToSave = {};
      if (heartbeatData.relay_status) {
        // Se já é objeto, usar direto
        if (typeof heartbeatData.relay_status === 'object') {
          relayStatusToSave = heartbeatData.relay_status;
        } else {
          // Se é string, converter para objeto simples
          relayStatusToSave = { status: heartbeatData.relay_status };
        }
      }
      
      console.log('💾 Salvando relay_status:', relayStatusToSave);
      
      // Verificar mudança de status de relay para criar/finalizar transações
      const { data: currentStatus } = await supabaseClient
        .from('esp32_status')
        .select('relay_status, laundry_id')
        .eq('esp32_id', heartbeatData.esp32_id || 'main')
        .eq('laundry_id', heartbeatData.laundry_id)
        .single();
      
      // Processar cada relay para detectar mudanças ON/OFF
      if (currentStatus && typeof relayStatusToSave === 'object') {
        for (const [key, value] of Object.entries(relayStatusToSave)) {
          const currentValue = currentStatus.relay_status?.[key];
          
          // Detectar mudança de OFF -> ON (iniciar transação)
          if (currentValue === 'off' && value === 'on') {
            console.log(`🟢 Relay ${key} ligado, criando transação...`);
            
            // Buscar máquina correspondente
            const relayNumber = key.match(/\d+/)?.[0];
            const { data: machine } = await supabaseClient
              .from('machines')
              .select('id, price_per_kg, capacity_kg, cycle_time_minutes')
              .eq('esp32_id', heartbeatData.esp32_id || 'main')
              .eq('relay_pin', relayNumber ? parseInt(relayNumber) : 1)
              .eq('laundry_id', heartbeatData.laundry_id)
              .single();
            
            if (machine) {
              const estimatedWeight = machine.capacity_kg * 0.8; // 80% da capacidade
              const totalAmount = estimatedWeight * machine.price_per_kg;
              
              await supabaseClient
                .from('transactions')
                .insert({
                  machine_id: machine.id,
                  laundry_id: heartbeatData.laundry_id,
                  status: 'pending',
                  weight_kg: estimatedWeight,
                  duration_minutes: machine.cycle_time_minutes,
                  total_amount: totalAmount,
                  payment_method: 'credit',
                  started_at: new Date().toISOString()
                });
              
              console.log(`✅ Transação criada para máquina ${machine.id}`);
            }
          }
          
          // Detectar mudança de ON -> OFF (finalizar transação)
          if (currentValue === 'on' && value === 'off') {
            console.log(`🔴 Relay ${key} desligado, finalizando transação...`);
            
            const relayNumber = key.match(/\d+/)?.[0];
            const { data: machine } = await supabaseClient
              .from('machines')
              .select('id')
              .eq('esp32_id', heartbeatData.esp32_id || 'main')
              .eq('relay_pin', relayNumber ? parseInt(relayNumber) : 1)
              .eq('laundry_id', heartbeatData.laundry_id)
              .single();
            
            if (machine) {
              await supabaseClient
                .from('transactions')
                .update({
                  status: 'completed',
                  completed_at: new Date().toISOString()
                })
                .eq('machine_id', machine.id)
                .eq('status', 'pending')
                .order('started_at', { ascending: false })
                .limit(1);
              
              console.log(`✅ Transação finalizada para máquina ${machine.id}`);
            }
          }
        }
      }
      
      const { data, error } = await supabaseClient
        .from('esp32_status')
        .upsert({
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
        }, {
          onConflict: 'esp32_id,laundry_id'
        });

      if (error) {
        console.error('Error updating ESP32 status:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('ESP32 status updated successfully:', data);

      return new Response(JSON.stringify({
        success: true,
        message: 'Heartbeat received',
        next_interval: 30
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar configurações do sistema para ação 'status'
    const { data: settings } = await supabaseClient
      .from('system_settings')
      .select('*')
      .single();

    if (!settings?.esp32_configurations) {
      throw new Error('ESP32 configurations not found');
    }

    const esp32Configs = settings.esp32_configurations;

    if (action === 'status') {
      // Verificar status de todos os ESP32s configurados
      const statusResults = [];
      
      for (const esp32Config of esp32Configs) {
        const esp32Url = `http://${esp32Config.host}:${esp32Config.port}/status`;
        
        try {
          const response = await fetch(esp32Url, {
            method: 'GET',
            signal: AbortSignal.timeout(5000) // 5 second timeout
          });

          if (!response.ok) {
            throw new Error(`ESP32 returned status: ${response.status}`);
          }

          const statusData = await response.json();
          
          // Atualizar status no banco
          await supabaseClient
            .from('esp32_status')
            .upsert({
              esp32_id: esp32Config.id,
              ip_address: statusData.ip_address || esp32Config.host,
              signal_strength: statusData.signal_strength,
              network_status: statusData.network_status || 'connected',
              firmware_version: statusData.firmware_version,
              uptime_seconds: statusData.uptime_seconds,
              location: esp32Config.location,
              machine_count: esp32Config.machines?.length || 0,
              relay_status: statusData.relay_status || {},
              is_online: true,
              last_heartbeat: new Date().toISOString()
            });

          statusResults.push({
            esp32_id: esp32Config.id,
            success: true,
            status: statusData
          });

        } catch (fetchError) {
          // ESP32 não está respondendo
          await supabaseClient
            .from('esp32_status')
            .upsert({
              esp32_id: esp32Config.id,
              ip_address: esp32Config.host,
              location: esp32Config.location,
              machine_count: esp32Config.machines?.length || 0,
              network_status: 'offline',
              is_online: false,
              last_heartbeat: new Date().toISOString()
            });

          statusResults.push({
            esp32_id: esp32Config.id,
            success: false,
            error: fetchError.message
          });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Status check completed for all ESP32s',
        results: statusResults
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid action',
      message: 'Action must be "status" or "heartbeat"'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ESP32 monitor:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      message: 'Error in ESP32 monitoring'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});