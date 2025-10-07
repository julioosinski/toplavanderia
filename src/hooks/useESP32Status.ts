import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLaundry } from '@/contexts/LaundryContext';

export interface ESP32StatusData {
  esp32_id: string;
  is_online: boolean;
  last_heartbeat: string | null;
  ip_address: string | null;
  signal_strength: number | null;
}

export const useESP32Status = () => {
  const [esp32StatusList, setEsp32StatusList] = useState<ESP32StatusData[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentLaundry } = useLaundry();

  const fetchESP32Status = async () => {
    if (!currentLaundry?.id) return;

    const { data, error } = await supabase
      .from('esp32_status')
      .select('esp32_id, is_online, last_heartbeat, ip_address, signal_strength')
      .eq('laundry_id', currentLaundry.id);

    if (error) {
      console.error('Error fetching ESP32 status:', error);
      return;
    }

    setEsp32StatusList(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchESP32Status();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('esp32-status-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'esp32_status',
          filter: `laundry_id=eq.${currentLaundry?.id}`,
        },
        () => {
          fetchESP32Status();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentLaundry?.id]);

  const getStatus = (esp32Id: string): ESP32StatusData | null => {
    return esp32StatusList.find(s => s.esp32_id === esp32Id) || null;
  };

  const isOnline = (esp32Id: string): boolean => {
    const status = getStatus(esp32Id);
    if (!status) return false;

    const lastHeartbeat = status.last_heartbeat ? new Date(status.last_heartbeat) : null;
    const now = new Date();
    const minutesAgo = lastHeartbeat ? (now.getTime() - lastHeartbeat.getTime()) / 60000 : 999999;

    return status.is_online && minutesAgo < 5;
  };

  return {
    esp32StatusList,
    loading,
    getStatus,
    isOnline,
    refresh: fetchESP32Status,
  };
};
