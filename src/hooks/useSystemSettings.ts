import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SystemSettings {
  id: string;
  wifi_ssid?: string;
  wifi_password?: string;
  esp32_host?: string;
  esp32_port: number;
  tef_terminal_id?: string;
  tef_config?: string;
  default_cycle_time: number;
  default_price: number;
  auto_mode: boolean;
  notifications_enabled: boolean;
  heartbeat_interval_seconds?: number;
  max_offline_duration_minutes?: number;
  signal_threshold_warning?: number;
  enable_esp32_monitoring?: boolean;
  esp32_configurations?: any[];
  zapier_webhook_url?: string;
  nfse_enabled?: boolean;
  company_cnpj?: string;
  company_name?: string;
  company_email?: string;
  paygo_enabled?: boolean;
  paygo_host?: string;
  paygo_port?: number;
  paygo_automation_key?: string;
  paygo_cnpj_cpf?: string;
  paygo_timeout?: number;
  paygo_retry_attempts?: number;
  paygo_retry_delay?: number;
}

export const useSystemSettings = () => {
  return useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        // Return default settings if none exist
        return {
          id: '',
          esp32_port: 80,
          default_cycle_time: 40,
          default_price: 5.00,
          auto_mode: false,
          notifications_enabled: true,
          heartbeat_interval_seconds: 30,
          max_offline_duration_minutes: 5,
          signal_threshold_warning: -70,
          enable_esp32_monitoring: true,
          esp32_configurations: [],
          nfse_enabled: false,
          paygo_enabled: false,
          paygo_port: 8080,
          paygo_timeout: 30000,
          paygo_retry_attempts: 3,
          paygo_retry_delay: 2000,
        } as SystemSettings;
      }

      return data as SystemSettings;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
  });
};
