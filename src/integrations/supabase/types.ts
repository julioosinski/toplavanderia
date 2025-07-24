export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      esp32_status: {
        Row: {
          created_at: string
          esp32_id: string
          firmware_version: string | null
          id: string
          ip_address: string | null
          is_online: boolean | null
          last_heartbeat: string | null
          location: string | null
          machine_count: number | null
          network_status: string | null
          relay_status: Json | null
          signal_strength: number | null
          updated_at: string
          uptime_seconds: number | null
        }
        Insert: {
          created_at?: string
          esp32_id: string
          firmware_version?: string | null
          id?: string
          ip_address?: string | null
          is_online?: boolean | null
          last_heartbeat?: string | null
          location?: string | null
          machine_count?: number | null
          network_status?: string | null
          relay_status?: Json | null
          signal_strength?: number | null
          updated_at?: string
          uptime_seconds?: number | null
        }
        Update: {
          created_at?: string
          esp32_id?: string
          firmware_version?: string | null
          id?: string
          ip_address?: string | null
          is_online?: boolean | null
          last_heartbeat?: string | null
          location?: string | null
          machine_count?: number | null
          network_status?: string | null
          relay_status?: Json | null
          signal_strength?: number | null
          updated_at?: string
          uptime_seconds?: number | null
        }
        Relationships: []
      }
      machines: {
        Row: {
          capacity_kg: number
          created_at: string
          cycle_time_minutes: number | null
          esp32_id: string | null
          id: string
          last_maintenance: string | null
          location: string | null
          name: string
          price_per_kg: number
          relay_pin: number | null
          status: string
          temperature: number | null
          total_revenue: number | null
          total_uses: number | null
          type: string
          updated_at: string
        }
        Insert: {
          capacity_kg?: number
          created_at?: string
          cycle_time_minutes?: number | null
          esp32_id?: string | null
          id?: string
          last_maintenance?: string | null
          location?: string | null
          name: string
          price_per_kg?: number
          relay_pin?: number | null
          status?: string
          temperature?: number | null
          total_revenue?: number | null
          total_uses?: number | null
          type: string
          updated_at?: string
        }
        Update: {
          capacity_kg?: number
          created_at?: string
          cycle_time_minutes?: number | null
          esp32_id?: string | null
          id?: string
          last_maintenance?: string | null
          location?: string | null
          name?: string
          price_per_kg?: number
          relay_pin?: number | null
          status?: string
          temperature?: number | null
          total_revenue?: number | null
          total_uses?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          auto_mode: boolean | null
          created_at: string
          default_cycle_time: number | null
          default_price: number | null
          enable_esp32_monitoring: boolean | null
          esp32_configurations: Json | null
          esp32_host: string | null
          esp32_port: number | null
          heartbeat_interval_seconds: number | null
          id: string
          max_offline_duration_minutes: number | null
          notifications_enabled: boolean | null
          paygo_automation_key: string | null
          paygo_cnpj_cpf: string | null
          paygo_enabled: boolean | null
          paygo_host: string | null
          paygo_port: number | null
          paygo_retry_attempts: number | null
          paygo_retry_delay: number | null
          paygo_timeout: number | null
          signal_threshold_warning: number | null
          tef_config: string | null
          tef_terminal_id: string | null
          updated_at: string
          wifi_password: string | null
          wifi_ssid: string | null
        }
        Insert: {
          auto_mode?: boolean | null
          created_at?: string
          default_cycle_time?: number | null
          default_price?: number | null
          enable_esp32_monitoring?: boolean | null
          esp32_configurations?: Json | null
          esp32_host?: string | null
          esp32_port?: number | null
          heartbeat_interval_seconds?: number | null
          id?: string
          max_offline_duration_minutes?: number | null
          notifications_enabled?: boolean | null
          paygo_automation_key?: string | null
          paygo_cnpj_cpf?: string | null
          paygo_enabled?: boolean | null
          paygo_host?: string | null
          paygo_port?: number | null
          paygo_retry_attempts?: number | null
          paygo_retry_delay?: number | null
          paygo_timeout?: number | null
          signal_threshold_warning?: number | null
          tef_config?: string | null
          tef_terminal_id?: string | null
          updated_at?: string
          wifi_password?: string | null
          wifi_ssid?: string | null
        }
        Update: {
          auto_mode?: boolean | null
          created_at?: string
          default_cycle_time?: number | null
          default_price?: number | null
          enable_esp32_monitoring?: boolean | null
          esp32_configurations?: Json | null
          esp32_host?: string | null
          esp32_port?: number | null
          heartbeat_interval_seconds?: number | null
          id?: string
          max_offline_duration_minutes?: number | null
          notifications_enabled?: boolean | null
          paygo_automation_key?: string | null
          paygo_cnpj_cpf?: string | null
          paygo_enabled?: boolean | null
          paygo_host?: string | null
          paygo_port?: number | null
          paygo_retry_attempts?: number | null
          paygo_retry_delay?: number | null
          paygo_timeout?: number | null
          signal_threshold_warning?: number | null
          tef_config?: string | null
          tef_terminal_id?: string | null
          updated_at?: string
          wifi_password?: string | null
          wifi_ssid?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_minutes: number | null
          id: string
          machine_id: string
          payment_method: string | null
          started_at: string | null
          status: string
          total_amount: number
          updated_at: string
          user_id: string | null
          weight_kg: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          machine_id: string
          payment_method?: string | null
          started_at?: string | null
          status?: string
          total_amount: number
          updated_at?: string
          user_id?: string | null
          weight_kg?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          machine_id?: string
          payment_method?: string | null
          started_at?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          user_id?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      user_credits: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          transaction_id: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          transaction_id?: string | null
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          transaction_id?: string | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_credits_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
