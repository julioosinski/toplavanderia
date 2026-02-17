import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { useLaundry } from '@/contexts/LaundryContext';

export interface SystemSettings {
  id: string;
  
  // ESP32 Settings
  esp32_port: number;
  esp32_host: string | null;
  enable_esp32_monitoring: boolean;
  heartbeat_interval_seconds: number;
  max_offline_duration_minutes: number;
  signal_threshold_warning: number;
  esp32_configurations?: any[];
  
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
  const { currentLaundry } = useLaundry();

  // Query para buscar settings filtradas por lavanderia
  const { data: settings, isLoading, error, refetch } = useQuery({
    queryKey: ['system-settings', currentLaundry?.id],
    queryFn: async () => {
      if (!currentLaundry?.id) {
        return null;
      }

      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('laundry_id', currentLaundry.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching system settings:', error);
        throw error;
      }

      // Se não existir configuração para esta lavanderia, criar uma padrão
      if (!data) {
        const defaultSettings = {
          laundry_id: currentLaundry.id,
          esp32_port: 80,
          default_cycle_time: 40,
          default_price: 5.00,
          auto_mode: false,
          notifications_enabled: true,
          heartbeat_interval_seconds: 30,
          max_offline_duration_minutes: 5,
          signal_threshold_warning: -70,
          enable_esp32_monitoring: true,
          paygo_enabled: false,
          paygo_port: 8080,
          paygo_timeout: 30000,
          paygo_retry_attempts: 3,
          paygo_retry_delay: 2000,
          nfse_enabled: false,
        };

        const { data: newSettings, error: createError } = await supabase
          .from('system_settings')
          .insert(defaultSettings)
          .select()
          .single();

        if (createError) {
          console.error('Error creating default settings:', createError);
          throw createError;
        }

        return newSettings as SystemSettings;
      }

      return data as SystemSettings;
    },
    staleTime: 1000 * 60 * 5, // Cache por 5 minutos
    retry: 2,
    enabled: !!currentLaundry?.id,
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
      queryClient.setQueryData(['system-settings', currentLaundry?.id], data);
      toast.success('Configurações atualizadas com sucesso');
    },
    onError: (error) => {
      console.error('Error updating settings:', error);
      toast.error('Erro ao atualizar configurações');
    },
  });

  // Realtime updates via Supabase
  useEffect(() => {
    if (!currentLaundry?.id) return;

    const channel = supabase
      .channel('system-settings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_settings',
          filter: `laundry_id=eq.${currentLaundry.id}`,
        },
        (payload) => {
          console.log('System settings updated:', payload);
          queryClient.invalidateQueries({ queryKey: ['system-settings', currentLaundry.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, currentLaundry?.id]);

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
