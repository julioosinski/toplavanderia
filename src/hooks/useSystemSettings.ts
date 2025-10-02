import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { toast } from 'sonner';

export interface SystemSettings {
  id: string;
  // ESP32 Settings
  esp32_port: number;
  esp32_host: string | null;
  enable_esp32_monitoring: boolean;
  heartbeat_interval_seconds: number;
  max_offline_duration_minutes: number;
  signal_threshold_warning: number;
  
  // Machine Settings
  default_cycle_time: number;
  default_price: number;
  auto_mode: boolean;
  
  // PayGO Settings
  paygo_enabled: boolean;
  paygo_host: string | null;
  paygo_port: number;
  paygo_timeout: number;
  paygo_retry_attempts: number;
  paygo_retry_delay: number;
  paygo_automation_key: string | null;
  paygo_cnpj_cpf: string | null;
  
  // TEF Settings
  tef_config: string | null;
  tef_terminal_id: string | null;
  
  // NF-e Settings
  nfse_enabled: boolean;
  company_cnpj: string | null;
  company_name: string | null;
  company_email: string | null;
  
  // WiFi Settings
  wifi_ssid: string | null;
  wifi_password: string | null;
  
  // Other
  notifications_enabled: boolean;
  zapier_webhook_url: string | null;
  created_at: string;
  updated_at: string;
}

// Hook para buscar configurações do sistema
export const useSystemSettings = () => {
  const queryClient = useQueryClient();

  // Query para buscar settings
  const { data: settings, isLoading, error, refetch } = useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching system settings:', error);
        throw error;
      }

      return data as SystemSettings | null;
    },
    staleTime: 1000 * 60 * 5, // Cache por 5 minutos
    retry: 2,
  });

  // Mutation para atualizar settings
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<SystemSettings>) => {
      if (!settings?.id) {
        throw new Error('Settings ID not found');
      }

      const { data, error } = await supabase
        .from('system_settings')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settings.id)
        .select()
        .single();

      if (error) throw error;
      return data as SystemSettings;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['system-settings'], data);
      toast.success('Configurações atualizadas com sucesso');
    },
    onError: (error) => {
      console.error('Error updating settings:', error);
      toast.error('Erro ao atualizar configurações');
    },
  });

  // Realtime updates via Supabase
  useEffect(() => {
    const channel = supabase
      .channel('system-settings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_settings',
        },
        (payload) => {
          console.log('System settings updated:', payload);
          queryClient.invalidateQueries({ queryKey: ['system-settings'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    settings,
    isLoading,
    error,
    refetch,
    updateSettings: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
};

// Hook para configurações PayGO específicas
export const usePayGOConfig = () => {
  const { settings, isLoading } = useSystemSettings();

  return {
    paygoConfig: settings
      ? {
          enabled: settings.paygo_enabled,
          host: settings.paygo_host || 'localhost',
          port: settings.paygo_port,
          timeout: settings.paygo_timeout,
          retryAttempts: settings.paygo_retry_attempts,
          retryDelay: settings.paygo_retry_delay,
          automationKey: settings.paygo_automation_key || '',
          cnpjCpf: settings.paygo_cnpj_cpf || '',
        }
      : null,
    isLoading,
  };
};

// Hook para configurações TEF específicas
export const useTEFConfig = () => {
  const { settings, isLoading } = useSystemSettings();

  return {
    tefConfig: settings?.tef_config 
      ? JSON.parse(settings.tef_config) 
      : null,
    terminalId: settings?.tef_terminal_id,
    isLoading,
  };
};

// Hook para configurações ESP32 específicas
export const useESP32Config = () => {
  const { settings, isLoading } = useSystemSettings();

  return {
    esp32Config: settings
      ? {
          host: settings.esp32_host || 'localhost',
          port: settings.esp32_port,
          enabled: settings.enable_esp32_monitoring,
          heartbeatInterval: settings.heartbeat_interval_seconds,
          maxOfflineDuration: settings.max_offline_duration_minutes,
          signalThreshold: settings.signal_threshold_warning,
        }
      : null,
    isLoading,
  };
};
