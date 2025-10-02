import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Droplets, Wind } from 'lucide-react';
import { useMachineAutoStatus } from './useMachineAutoStatus';

export interface Machine {
  id: string;
  name: string;
  type: 'lavadora' | 'secadora';
  title: string;
  price: number;
  duration: number;
  status: 'available' | 'running' | 'maintenance' | 'offline';
  icon: any;
  timeRemaining?: number;
  esp32_id?: string;
  relay_pin?: number;
  location?: string;
  ip_address?: string;
}

export const useMachines = (laundryId?: string | null) => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Hook para atualização automática de status
  useMachineAutoStatus();

  const fetchMachines = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Buscando máquinas do Supabase...', { laundryId });
      
      let query = supabase
        .from('machines')
        .select('*');
      
      // Filtrar por lavanderia se fornecido
      if (laundryId) {
        query = query.eq('laundry_id', laundryId);
      }
      
      const { data: machinesData, error: machinesError } = await query.order('name');

      if (machinesError) {
        console.error('❌ Erro ao buscar máquinas:', machinesError);
        throw machinesError;
      }

      console.log('✅ Máquinas carregadas:', machinesData?.length || 0);

      // Buscar status dos ESP32s para determinar IPs e status de relés
      console.log('🔍 Buscando status ESP32...');
      const { data: esp32Data, error: esp32Error } = await supabase
        .from('esp32_status')
        .select('esp32_id, ip_address, is_online, relay_status');

      if (esp32Error) {
        console.warn('⚠️ Erro ao buscar ESP32 status:', esp32Error);
      } else {
        console.log('✅ ESP32 status carregado:', esp32Data?.length || 0);
      }

      const esp32Map = new Map(
        esp32Data?.map(esp32 => [esp32.esp32_id, esp32]) || []
      );

      // Transformar dados para o formato esperado pelo componente
      const transformedMachines: Machine[] = machinesData?.map(machine => {
        const esp32 = esp32Map.get(machine.esp32_id || 'main');
        
        // Map database types to frontend types
        const typeMapping: Record<string, 'lavadora' | 'secadora'> = {
          'washing': 'lavadora',
          'drying': 'secadora',
          'lavadora': 'lavadora',
          'secadora': 'secadora'
        };
        
        const mappedType = typeMapping[machine.type] || 'lavadora';
        
        // Determinar status inteligente baseado em ESP32 e status da máquina
        let machineStatus = machine.status as any;
        
        // Verificar status do ESP32
        if (machine.esp32_id) {
          const esp32Status = esp32Map.get(machine.esp32_id);
          
          // Se ESP32 está offline ou não existe, marcar máquina como offline
          if (!esp32Status || !esp32Status.is_online) {
            machineStatus = 'offline';
          } else {
            // ESP32 está online, verificar status do relé
            if (esp32Status.relay_status && typeof esp32Status.relay_status === 'object') {
              const relayKey = `relay_${machine.relay_pin || 1}`;
              const relayStatus = (esp32Status.relay_status as any)[relayKey];
              
              // Se relé está ativo, máquina está rodando
              if (relayStatus === 'on' || relayStatus === true || relayStatus === 1) {
                machineStatus = 'running';
              } else if (machine.status !== 'running' && machine.status !== 'maintenance') {
                // Se relé está desligado e não está em manutenção, está disponível
                machineStatus = 'available';
              }
            } else if (machine.status !== 'running' && machine.status !== 'maintenance') {
              // Se não há dados de relé mas ESP32 está online, considerar disponível
              machineStatus = 'available';
            }
          }
        }
        
        // Se máquina está "running", verificar se passou do tempo esperado
        if (machineStatus === 'running' && machine.updated_at) {
          const lastUpdate = new Date(machine.updated_at);
          const now = new Date();
          const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
          const cycleTime = machine.cycle_time_minutes || 40;
          
          // Se passou mais tempo que o ciclo + 10 minutos de margem, marcar como disponível
          if (minutesSinceUpdate > cycleTime + 10) {
            machineStatus = 'available';
          }
        }
        
        return {
          id: machine.id,
          name: machine.name,
          type: mappedType,
          title: machine.name,
          price: Number(machine.price_per_kg) || 18.00,
          duration: machine.cycle_time_minutes || 40,
          status: machineStatus,
          icon: mappedType === 'lavadora' ? Droplets : Wind,
          esp32_id: machine.esp32_id,
          relay_pin: machine.relay_pin,
          location: machine.location,
          ip_address: esp32?.ip_address
        };
      }) || [];

      setMachines(transformedMachines);
    } catch (error) {
      console.error('Erro ao buscar máquinas:', error);
      setError('Erro ao carregar máquinas');
      toast({
        title: "Erro",
        description: "Não foi possível carregar as máquinas. Usando dados padrão.",
        variant: "destructive"
      });
      
      // Fallback para dados básicos se houver erro
      setMachines([
        {
          id: 'fallback-1',
          name: 'Lavadora 1',
          type: 'lavadora',
          title: 'Lavadora 1',
          price: 18.00,
          duration: 35,
          status: 'available',
          icon: Droplets,
          ip_address: '192.168.0.101'
        },
        {
          id: 'fallback-2',
          name: 'Secadora 1',
          type: 'secadora',
          title: 'Secadora 1',
          price: 18.00,
          duration: 40,
          status: 'available',
          icon: Wind,
          ip_address: '192.168.0.101'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const updateMachineStatus = async (machineId: string, status: Machine['status']) => {
    try {
      const { error } = await supabase
        .from('machines')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', machineId);

      if (error) throw error;

      // Atualizar estado local
      setMachines(prev => 
        prev.map(machine => 
          machine.id === machineId 
            ? { ...machine, status }
            : machine
        )
      );
    } catch (error) {
      console.error('Erro ao atualizar status da máquina:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status da máquina",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchMachines();

    // Configurar realtime para máquinas
    const machinesChannel = supabase
      .channel(`machines-changes-${laundryId || 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'machines',
          filter: laundryId ? `laundry_id=eq.${laundryId}` : undefined
        },
        () => {
          fetchMachines();
        }
      )
      .subscribe();

    // Configurar realtime para ESP32 status
    const esp32Channel = supabase
      .channel('esp32-status-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'esp32_status'
        },
        () => {
          fetchMachines();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(machinesChannel);
      supabase.removeChannel(esp32Channel);
    };
  }, [laundryId]);

  return {
    machines,
    loading,
    error,
    refreshMachines: fetchMachines,
    updateMachineStatus
  };
};