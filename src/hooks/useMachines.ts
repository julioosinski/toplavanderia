import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Droplets, Wind } from 'lucide-react';
import { useMachineAutoStatus } from './useMachineAutoStatus';
import { nativeStorage } from '@/utils/nativeStorage';

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

const CACHE_KEY_PREFIX = 'machines_cache_';

export const useMachines = (laundryId?: string | null) => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const { toast } = useToast();
  
  useMachineAutoStatus();

  const cacheKey = `${CACHE_KEY_PREFIX}${laundryId || 'all'}`;

  const calculateTimeRemaining = (updatedAt: string, cycleMinutes: number): number => {
    const elapsed = (Date.now() - new Date(updatedAt).getTime()) / 60000;
    return Math.max(0, Math.round(cycleMinutes - elapsed));
  };

  const transformMachine = (machine: any, esp32Map: Map<string, any>): Machine => {
    const esp32 = esp32Map.get(machine.esp32_id || 'main');
    
    const typeMapping: Record<string, 'lavadora' | 'secadora'> = {
      'washing': 'lavadora', 'drying': 'secadora',
      'lavadora': 'lavadora', 'secadora': 'secadora'
    };
    const mappedType = typeMapping[machine.type] || 'lavadora';
    
    let machineStatus = machine.status as any;
    
    if (machine.esp32_id) {
      const esp32Status = esp32Map.get(machine.esp32_id);
      const now = new Date();
      const lastHeartbeat = esp32Status?.last_heartbeat ? new Date(esp32Status.last_heartbeat) : null;
      const minutesSinceHeartbeat = lastHeartbeat 
        ? (now.getTime() - lastHeartbeat.getTime()) / (1000 * 60) : 999999;
      const maxOfflineMinutes = 5;
      
      if (!esp32Status || !esp32Status.is_online || minutesSinceHeartbeat > maxOfflineMinutes) {
        machineStatus = 'offline';
      } else {
        if (esp32Status.relay_status && typeof esp32Status.relay_status === 'object') {
          const relayObj = esp32Status.relay_status as any;
          const relayKey = `relay_${machine.relay_pin || 1}`;
          let relayStatus: string | boolean | number | undefined;
          
          if (relayObj[relayKey] !== undefined) relayStatus = relayObj[relayKey];
          else if (relayObj.status && typeof relayObj.status === 'object') relayStatus = relayObj.status[relayKey];
          else if (relayObj.status !== undefined) relayStatus = relayObj.status;
          
          if (relayStatus === 'on' || relayStatus === true || relayStatus === 1) {
            machineStatus = 'running';
          } else if (machine.status !== 'running' && machine.status !== 'maintenance') {
            machineStatus = 'available';
          }
        } else if (machine.status !== 'running' && machine.status !== 'maintenance') {
          machineStatus = 'available';
        }
      }
    }
    
    // Verificar timeout do ciclo
    let timeRemaining: number | undefined;
    if (machineStatus === 'running' && machine.updated_at) {
      const cycleTime = machine.cycle_time_minutes || 40;
      timeRemaining = calculateTimeRemaining(machine.updated_at, cycleTime);
      
      // Se passou do ciclo + margem, marcar disponível
      if (timeRemaining <= 0) {
        const lastUpdate = new Date(machine.updated_at);
        const minutesSinceUpdate = (Date.now() - lastUpdate.getTime()) / 60000;
        if (minutesSinceUpdate > cycleTime + 10) {
          machineStatus = 'available';
          timeRemaining = undefined;
        }
      }
    }
    
    return {
      id: machine.id,
      name: machine.name,
      type: mappedType,
      title: machine.name,
      price: Number(machine.price_per_cycle) || 18.00,
      duration: machine.cycle_time_minutes || 40,
      status: machineStatus,
      icon: mappedType === 'lavadora' ? Droplets : Wind,
      timeRemaining,
      esp32_id: machine.esp32_id,
      relay_pin: machine.relay_pin,
      location: machine.location,
      ip_address: esp32?.ip_address
    };
  };

  const fetchMachines = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase.from('machines').select('*');
      if (laundryId) query = query.eq('laundry_id', laundryId);
      const { data: machinesData, error: machinesError } = await query.order('name');

      if (machinesError) throw machinesError;

      let esp32Query = supabase
        .from('esp32_status')
        .select('esp32_id, ip_address, is_online, relay_status, last_heartbeat, laundry_id');
      if (laundryId) esp32Query = esp32Query.eq('laundry_id', laundryId);
      const { data: esp32Data } = await esp32Query;

      const esp32Map = new Map(esp32Data?.map(e => [e.esp32_id, e]) || []);
      const transformedMachines = machinesData?.map(m => transformMachine(m, esp32Map)) || [];

      setMachines(transformedMachines);
      setIsOffline(false);

      // Cache para uso offline
      try {
        await nativeStorage.setItem(cacheKey, JSON.stringify(
          transformedMachines.map(({ icon, ...rest }) => rest)
        ));
      } catch { /* ignore cache errors */ }
    } catch (error) {
      console.error('Erro ao buscar máquinas:', error);
      setError('Erro ao carregar máquinas');

      // Tentar carregar do cache
      try {
        const cached = await nativeStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as Omit<Machine, 'icon'>[];
          const restored = parsed.map(m => ({
            ...m,
            icon: m.type === 'lavadora' ? Droplets : Wind
          })) as Machine[];
          setMachines(restored);
          setIsOffline(true);
          toast({
            title: "Modo Offline",
            description: "Exibindo dados em cache. Conexão indisponível.",
          });
          return;
        }
      } catch { /* ignore */ }

      toast({
        title: "Erro",
        description: "Não foi possível carregar as máquinas.",
        variant: "destructive"
      });
      setMachines([]);
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
      setMachines(prev => prev.map(m => m.id === machineId ? { ...m, status } : m));
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast({ title: "Erro", description: "Não foi possível atualizar o status da máquina", variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchMachines();

    const machinesChannel = supabase
      .channel(`machines-changes-${laundryId || 'all'}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'machines',
        filter: laundryId ? `laundry_id=eq.${laundryId}` : undefined
      }, () => fetchMachines())
      .subscribe();

    const esp32Channel = supabase
      .channel('esp32-status-changes')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'esp32_status'
      }, () => fetchMachines())
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
    isOffline,
    refreshMachines: fetchMachines,
    updateMachineStatus
  };
};
