export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      admin_config: {
        Row: {
          id: string
          last_updated: string | null
          pin_hash: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          last_updated?: string | null
          pin_hash: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          last_updated?: string | null
          pin_hash?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: unknown | null
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string
          timestamp: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name: string
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      authorized_devices: {
        Row: {
          created_at: string | null
          device_name: string
          device_uuid: string
          id: string
          is_active: boolean | null
          last_seen: string | null
          laundry_id: string | null
          location: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          device_name: string
          device_uuid: string
          id?: string
          is_active?: boolean | null
          last_seen?: string | null
          laundry_id?: string | null
          location?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          device_name?: string
          device_uuid?: string
          id?: string
          is_active?: boolean | null
          last_seen?: string | null
          laundry_id?: string | null
          location?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "authorized_devices_laundry_id_fkey"
            columns: ["laundry_id"]
            isOneToOne: false
            referencedRelation: "laundries"
            referencedColumns: ["id"]
          },
        ]
      }
      esp32_status: {
        Row: {
          created_at: string
          esp32_id: string
          firmware_version: string | null
          id: string
          ip_address: string | null
          is_online: boolean | null
          last_heartbeat: string | null
          laundry_id: string
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
          laundry_id: string
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
          laundry_id?: string
          machine_count?: number | null
          network_status?: string | null
          relay_status?: Json | null
          signal_strength?: number | null
          updated_at?: string
          uptime_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "esp32_status_laundry_id_fkey"
            columns: ["laundry_id"]
            isOneToOne: false
            referencedRelation: "laundries"
            referencedColumns: ["id"]
          },
        ]
      }
      laundries: {
        Row: {
          address: string | null
          city: string | null
          cnpj: string
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          owner_id: string | null
          phone: string | null
          settings: Json | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          cnpj: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          owner_id?: string | null
          phone?: string | null
          settings?: Json | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          cnpj?: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          phone?: string | null
          settings?: Json | null
          state?: string | null
          updated_at?: string | null
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
          laundry_id: string | null
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
          laundry_id?: string | null
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
          laundry_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "machines_laundry_id_fkey"
            columns: ["laundry_id"]
            isOneToOne: false
            referencedRelation: "laundries"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_commands: {
        Row: {
          action: string
          created_at: string | null
          error_message: string | null
          esp32_id: string
          id: string
          last_retry_at: string | null
          machine_id: string
          relay_pin: number
          retry_count: number | null
          status: string
          transaction_id: string | null
          updated_at: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          error_message?: string | null
          esp32_id: string
          id?: string
          last_retry_at?: string | null
          machine_id: string
          relay_pin: number
          retry_count?: number | null
          status?: string
          transaction_id?: string | null
          updated_at?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          error_message?: string | null
          esp32_id?: string
          id?: string
          last_retry_at?: string | null
          machine_id?: string
          relay_pin?: number
          retry_count?: number | null
          status?: string
          transaction_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_commands_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_commands_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "public_machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_commands_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
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
      security_events: {
        Row: {
          created_at: string | null
          details: Json | null
          device_uuid: string | null
          event_type: string
          id: string
          ip_address: unknown | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          timestamp: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          device_uuid?: string | null
          event_type: string
          id?: string
          ip_address?: unknown | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          device_uuid?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          auto_mode: boolean | null
          company_cnpj: string | null
          company_email: string | null
          company_name: string | null
          created_at: string
          default_cycle_time: number | null
          default_price: number | null
          enable_esp32_monitoring: boolean | null
          esp32_configurations: Json | null
          esp32_host: string | null
          esp32_port: number | null
          heartbeat_interval_seconds: number | null
          id: string
          laundry_id: string
          max_offline_duration_minutes: number | null
          nfse_enabled: boolean | null
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
          zapier_webhook_url: string | null
        }
        Insert: {
          auto_mode?: boolean | null
          company_cnpj?: string | null
          company_email?: string | null
          company_name?: string | null
          created_at?: string
          default_cycle_time?: number | null
          default_price?: number | null
          enable_esp32_monitoring?: boolean | null
          esp32_configurations?: Json | null
          esp32_host?: string | null
          esp32_port?: number | null
          heartbeat_interval_seconds?: number | null
          id?: string
          laundry_id: string
          max_offline_duration_minutes?: number | null
          nfse_enabled?: boolean | null
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
          zapier_webhook_url?: string | null
        }
        Update: {
          auto_mode?: boolean | null
          company_cnpj?: string | null
          company_email?: string | null
          company_name?: string | null
          created_at?: string
          default_cycle_time?: number | null
          default_price?: number | null
          enable_esp32_monitoring?: boolean | null
          esp32_configurations?: Json | null
          esp32_host?: string | null
          esp32_port?: number | null
          heartbeat_interval_seconds?: number | null
          id?: string
          laundry_id?: string
          max_offline_duration_minutes?: number | null
          nfse_enabled?: boolean | null
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
          zapier_webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_laundry_id_fkey"
            columns: ["laundry_id"]
            isOneToOne: true
            referencedRelation: "laundries"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_minutes: number | null
          id: string
          laundry_id: string | null
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
          laundry_id?: string | null
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
          laundry_id?: string | null
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
            foreignKeyName: "transactions_laundry_id_fkey"
            columns: ["laundry_id"]
            isOneToOne: false
            referencedRelation: "laundries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "public_machines"
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
          laundry_id: string | null
          transaction_id: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          laundry_id?: string | null
          transaction_id?: string | null
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          laundry_id?: string | null
          transaction_id?: string | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_credits_laundry_id_fkey"
            columns: ["laundry_id"]
            isOneToOne: false
            referencedRelation: "laundries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_credits_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          laundry_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          laundry_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          laundry_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_laundry_id_fkey"
            columns: ["laundry_id"]
            isOneToOne: false
            referencedRelation: "laundries"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_machines: {
        Row: {
          capacity_kg: number | null
          cycle_time_minutes: number | null
          esp32_id: string | null
          id: string | null
          last_maintenance: string | null
          location: string | null
          name: string | null
          price_per_kg: number | null
          status: string | null
          temperature: number | null
          type: string | null
        }
        Insert: {
          capacity_kg?: number | null
          cycle_time_minutes?: number | null
          esp32_id?: string | null
          id?: string | null
          last_maintenance?: string | null
          location?: string | null
          name?: string | null
          price_per_kg?: number | null
          status?: string | null
          temperature?: number | null
          type?: string | null
        }
        Update: {
          capacity_kg?: number | null
          cycle_time_minutes?: number | null
          esp32_id?: string | null
          id?: string | null
          last_maintenance?: string | null
          location?: string | null
          name?: string | null
          price_per_kg?: number | null
          status?: string | null
          temperature?: number | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_old_logs: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_default_system_settings: {
        Args: { _laundry_id: string }
        Returns: string
      }
      get_user_laundry_id: {
        Args: { _user_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _laundry_id?: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: {
        Args: { _user_id: string }
        Returns: boolean
      }
      log_security_event: {
        Args: {
          _details?: Json
          _device_uuid?: string
          _event_type: string
          _severity: string
          _user_id?: string
        }
        Returns: string
      }
      validate_admin_pin: {
        Args: { _pin: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "operator" | "user" | "totem_device" | "super_admin"
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
    Enums: {
      app_role: ["admin", "operator", "user", "totem_device", "super_admin"],
    },
  },
} as const
