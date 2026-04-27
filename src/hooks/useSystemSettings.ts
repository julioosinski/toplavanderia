import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { toast } from "@/hooks/use-toast";
import { useLaundry } from '@/hooks/useLaundry';
import { nativeStorage } from '@/utils/nativeStorage';

export interface ESP32Configuration {
  id: string;
  name?: string;
  host: string;
  port: number;
  location?: string;
  machines?: string[];
}

export interface SystemSettings {
  id: string;
  
  // ESP32 Settings
  esp32_port: number;
  esp32_host: string | null;
  enable_esp32_monitoring: boolean;
  heartbeat_interval_seconds: number;
  max_offline_duration_minutes: number;
  signal_threshold_warning: number;
  esp32_configurations?: ESP32Configuration[];
  
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
  paygo_provedor: string | null;

  // Cielo LIO Settings
  cielo_client_id: string | null;
  cielo_access_token: string | null;
  cielo_merchant_code: string | null;
  cielo_environment: string | null;
  
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

const SYSTEM_SETTINGS_QUERY_TIMEOUT_MS = 15000;
const SETTINGS_CACHE_PREFIX = 'system_settings_cache:';

const settingsCacheKey = (laundryId: string) => `${SETTINGS_CACHE_PREFIX}${laundryId}`;

const totemSettingsDefaults = (laundryId: string): SystemSettings => ({
  id: `totem-${laundryId}`,
  esp32_port: 80,
  esp32_host: null,
  enable_esp32_monitoring: true,
  heartbeat_interval_seconds: 30,
  max_offline_duration_minutes: 5,
  signal_threshold_warning: -70,
  esp32_configurations: [],
  default_cycle_time: 40,
  default_price: 5,
  auto_mode: false,
  paygo_enabled: false,
  paygo_host: null,
  paygo_port: 8080,
  paygo_timeout: 30000,
  paygo_retry_attempts: 3,
  paygo_retry_delay: 2000,
  paygo_automation_key: null,
  paygo_cnpj_cpf: null,
  paygo_provedor: null,
  cielo_client_id: null,
  cielo_access_token: null,
  cielo_merchant_code: null,
  cielo_environment: 'sandbox',
  tef_config: null,
  tef_terminal_id: null,
  nfse_enabled: false,
  company_cnpj: null,
  company_name: null,
  company_email: null,
  wifi_ssid: null,
  wifi_password: null,
  notifications_enabled: true,
  zapier_webhook_url: null,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
});

async function readCachedSettings(laundryId: string): Promise<SystemSettings | null> {
  try {
    const raw = await nativeStorage.getItem(settingsCacheKey(laundryId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SystemSettings;
    if (!parsed?.id) return null;
    return parsed;
  } catch (e) {
    console.warn('[useSystemSettings] cache read failed:', e);
    return null;
  }
}

async function writeCachedSettings(laundryId: string, data: SystemSettings): Promise<void> {
  try {
    await nativeStorage.setItem(settingsCacheKey(laundryId), JSON.stringify(data));
  } catch (e) {
    console.warn('[useSystemSettings] cache write failed:', e);
  }
}

async function fetchTotemSettingsViaRpc(laundryId: string): Promise<SystemSettings | null> {
  try {
    const { data, error } = await supabase.rpc('get_totem_settings', { _laundry_id: laundryId });
    if (error || !data) return null;

    const base = totemSettingsDefaults(laundryId);
    const rpcData = data as Partial<SystemSettings>;
    return {
      ...base,
      ...rpcData,
      // keep deterministic synthetic id for cache/query stability
      id: base.id,
      updated_at: new Date().toISOString(),
    };
  } catch (e) {
    console.warn('[useSystemSettings] RPC get_totem_settings failed:', e);
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('system_settings_timeout')), ms);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e);
      });
  });
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

      const run = async (): Promise<SystemSettings | null> => {
        const { data, error } = await supabase
          .from('system_settings')
          .select('*')
          .eq('laundry_id', currentLaundry.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching system settings:', error);
          // Public totem flow may not have direct SELECT due to RLS.
          const rpcSettings = await fetchTotemSettingsViaRpc(currentLaundry.id);
          if (rpcSettings) {
            await writeCachedSettings(currentLaundry.id, rpcSettings);
            return rpcSettings;
          }
          throw error;
        }

        // Se não existir configuração para esta lavanderia, criar uma padrão
        if (!data) {
          const rpcSettings = await fetchTotemSettingsViaRpc(currentLaundry.id);
          if (rpcSettings) {
            await writeCachedSettings(currentLaundry.id, rpcSettings);
            return rpcSettings;
          }

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
            // RLS ou permissão: não travar a app; totem usa defaults locais
            console.error('Error creating default settings:', createError);
            return await readCachedSettings(currentLaundry.id);
          }

          const created = newSettings as SystemSettings;
          await writeCachedSettings(currentLaundry.id, created);
          return created;
        }

        const current = data as SystemSettings;
        await writeCachedSettings(currentLaundry.id, current);
        return current;
      };

      try {
        return await withTimeout(run(), SYSTEM_SETTINGS_QUERY_TIMEOUT_MS);
      } catch (e) {
        if (e instanceof Error && e.message === 'system_settings_timeout') {
          console.warn('system_settings: timeout — usando cache local');
          const rpcSettings = await fetchTotemSettingsViaRpc(currentLaundry.id);
          if (rpcSettings) {
            await writeCachedSettings(currentLaundry.id, rpcSettings);
            return rpcSettings;
          }
          return await readCachedSettings(currentLaundry.id);
        }
        console.error('system_settings: erro remoto — fallback para cache local', e);
        const rpcSettings = await fetchTotemSettingsViaRpc(currentLaundry.id);
        if (rpcSettings) {
          await writeCachedSettings(currentLaundry.id, rpcSettings);
          return rpcSettings;
        }
        return await readCachedSettings(currentLaundry.id);
      }
    },
    staleTime: 1000 * 60 * 5, // Cache por 5 minutos
    retry: 1,
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
      if (currentLaundry?.id) {
        void writeCachedSettings(currentLaundry.id, data);
      }
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
