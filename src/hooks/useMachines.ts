import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Droplets, Wind } from 'lucide-react';

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

export const useMachines = () => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchMachines = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: machinesData, error: machinesError } = await supabase
        .from('machines')
        .select('*')
        .order('name');

      if (machinesError) {
        throw machinesError;
      }

      // Buscar status dos ESP32s para determinar IPs
      const { data: esp32Data } = await supabase
        .from('esp32_status')
        .select('esp32_id, ip_address, is_online');

      const esp32Map = new Map(
        esp32Data?.map(esp32 => [esp32.esp32_id, esp32]) || []
      );

      // Transformar dados para o formato esperado pelo componente
      const transformedMachines: Machine[] = machinesData?.map(machine => {
        const esp32 = esp32Map.get(machine.esp32_id || 'main');
        
        return {
          id: machine.id,
          name: machine.name,
          type: machine.type as 'lavadora' | 'secadora',
          title: machine.name,
          price: Number(machine.price_per_kg) || 18.00,
          duration: machine.cycle_time_minutes || 40,
          status: esp32?.is_online === false ? 'offline' : machine.status as any,
          icon: machine.type === 'lavadora' ? Droplets : Wind,
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
      .channel('machines-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'machines'
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
  }, []);

  return {
    machines,
    loading,
    error,
    refreshMachines: fetchMachines,
    updateMachineStatus
  };
};