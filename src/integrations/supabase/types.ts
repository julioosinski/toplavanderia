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
          ip_address: unknown
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
          ip_address?: unknown
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
          ip_address?: unknown
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
      coffee_products: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          laundry_id: string
          machine_id: string
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          laundry_id: string
          machine_id: string
          name: string
          price: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          laundry_id?: string
          machine_id?: string
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coffee_products_laundry_id_fkey"
            columns: ["laundry_id"]
            isOneToOne: false
            referencedRelation: "laundries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_products_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machine_status_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_products_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_products_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "public_machines"
            referencedColumns: ["id"]
          },
        ]
      }
      esp32_ota_jobs: {
        Row: {
          checksum_sha256: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_message: string | null
          esp32_id: string
          file_size: number | null
          firmware_version: string
          id: string
          laundry_id: string
          started_at: string | null
          status: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          checksum_sha256?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          esp32_id: string
          file_size?: number | null
          firmware_version: string
          id?: string
          laundry_id: string
          started_at?: string | null
          status?: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          checksum_sha256?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          esp32_id?: string
          file_size?: number | null
          firmware_version?: string
          id?: string
          laundry_id?: string
          started_at?: string | null
          status?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "esp32_ota_jobs_laundry_id_fkey"
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
          device_name: string | null
          esp32_id: string
          firmware_version: string | null
          id: string
          ip_address: string | null
          is_online: boolean | null
          last_heartbeat: string | null
          laundry_id: string
          machine_count: number | null
          network_status: string | null
          registration_status: string | null
          relay_status: Json | null
          signal_strength: number | null
          updated_at: string
          uptime_seconds: number | null
        }
        Insert: {
          created_at?: string
          device_name?: string | null
          esp32_id: string
          firmware_version?: string | null
          id?: string
          ip_address?: string | null
          is_online?: boolean | null
          last_heartbeat?: string | null
          laundry_id: string
          machine_count?: number | null
          network_status?: string | null
          registration_status?: string | null
          relay_status?: Json | null
          signal_strength?: number | null
          updated_at?: string
          uptime_seconds?: number | null
        }
        Update: {
          created_at?: string
          device_name?: string | null
          esp32_id?: string
          firmware_version?: string | null
          id?: string
          ip_address?: string | null
          is_online?: boolean | null
          last_heartbeat?: string | null
          laundry_id?: string
          machine_count?: number | null
          network_status?: string | null
          registration_status?: string | null
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
          device_profile: string
          esp32_id: string | null
          id: string
          last_maintenance: string | null
          laundry_id: string | null
          location: string | null
          metadata: Json
          name: string
          price_per_cycle: number
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
          device_profile?: string
          esp32_id?: string | null
          id?: string
          last_maintenance?: string | null
          laundry_id?: string | null
          location?: string | null
          metadata?: Json
          name: string
          price_per_cycle?: number
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
          device_profile?: string
          esp32_id?: string | null
          id?: string
          last_maintenance?: string | null
          laundry_id?: string | null
          location?: string | null
          metadata?: Json
          name?: string
          price_per_cycle?: number
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
      operator_release_permissions: {
        Row: {
          can_release: boolean
          created_at: string
          daily_limit_cents: number | null
          granted_by: string | null
          id: string
          laundry_id: string
          monthly_limit_cents: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          can_release?: boolean
          created_at?: string
          daily_limit_cents?: number | null
          granted_by?: string | null
          id?: string
          laundry_id: string
          monthly_limit_cents?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          can_release?: boolean
          created_at?: string
          daily_limit_cents?: number | null
          granted_by?: string | null
          id?: string
          laundry_id?: string
          monthly_limit_cents?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_release_permissions_laundry_id_fkey"
            columns: ["laundry_id"]
            isOneToOne: false
            referencedRelation: "laundries"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_sessions: {
        Row: {
          amount_cents: number
          authorized_at: string | null
          cielo_order_id: string | null
          cielo_payment_id: string | null
          created_at: string
          expires_at: string | null
          external_reference: string | null
          id: string
          laundry_id: string
          machine_id: string | null
          metadata: Json
          payment_method: string | null
          provider: string
          released_at: string | null
          state: string
          stone_transaction_id: string | null
          terminal_id: string | null
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          authorized_at?: string | null
          cielo_order_id?: string | null
          cielo_payment_id?: string | null
          created_at?: string
          expires_at?: string | null
          external_reference?: string | null
          id?: string
          laundry_id: string
          machine_id?: string | null
          metadata?: Json
          payment_method?: string | null
          provider: string
          released_at?: string | null
          state?: string
          stone_transaction_id?: string | null
          terminal_id?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          authorized_at?: string | null
          cielo_order_id?: string | null
          cielo_payment_id?: string | null
          created_at?: string
          expires_at?: string | null
          external_reference?: string | null
          id?: string
          laundry_id?: string
          machine_id?: string | null
          metadata?: Json
          payment_method?: string | null
          provider?: string
          released_at?: string | null
          state?: string
          stone_transaction_id?: string | null
          terminal_id?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_sessions_laundry_id_fkey"
            columns: ["laundry_id"]
            isOneToOne: false
            referencedRelation: "laundries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_sessions_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machine_status_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_sessions_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_sessions_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "public_machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_sessions_terminal_id_fkey"
            columns: ["terminal_id"]
            isOneToOne: false
            referencedRelation: "payment_terminals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_sessions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_terminals: {
        Row: {
          created_at: string
          device_serial: string | null
          id: string
          is_active: boolean
          label: string
          laundry_id: string
          metadata: Json
          provider: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_serial?: string | null
          id?: string
          is_active?: boolean
          label?: string
          laundry_id: string
          metadata?: Json
          provider: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_serial?: string | null
          id?: string
          is_active?: boolean
          label?: string
          laundry_id?: string
          metadata?: Json
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_terminals_laundry_id_fkey"
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
          executed_at: string | null
          id: string
          last_retry_at: string | null
          machine_id: string
          payload: Json
          relay_pin: number | null
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
          executed_at?: string | null
          id?: string
          last_retry_at?: string | null
          machine_id: string
          payload?: Json
          relay_pin?: number | null
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
          executed_at?: string | null
          id?: string
          last_retry_at?: string | null
          machine_id?: string
          payload?: Json
          relay_pin?: number | null
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
            referencedRelation: "machine_status_view"
            referencedColumns: ["id"]
          },
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
          ip_address: unknown
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
          ip_address?: unknown
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
          ip_address?: unknown
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
          cielo_access_token: string | null
          cielo_client_id: string | null
          cielo_environment: string | null
          cielo_merchant_code: string | null
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
          paygo_provedor: string | null
          paygo_retry_attempts: number | null
          paygo_retry_delay: number | null
          paygo_timeout: number | null
          signal_threshold_warning: number | null
          stone_app_key: string | null
          stone_code: string | null
          stone_device_serial: string | null
          stone_environment: string | null
          tef_config: string | null
          tef_terminal_id: string | null
          updated_at: string
          wifi_password: string | null
          wifi_ssid: string | null
          zapier_webhook_url: string | null
        }
        Insert: {
          auto_mode?: boolean | null
          cielo_access_token?: string | null
          cielo_client_id?: string | null
          cielo_environment?: string | null
          cielo_merchant_code?: string | null
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
          paygo_provedor?: string | null
          paygo_retry_attempts?: number | null
          paygo_retry_delay?: number | null
          paygo_timeout?: number | null
          signal_threshold_warning?: number | null
          stone_app_key?: string | null
          stone_code?: string | null
          stone_device_serial?: string | null
          stone_environment?: string | null
          tef_config?: string | null
          tef_terminal_id?: string | null
          updated_at?: string
          wifi_password?: string | null
          wifi_ssid?: string | null
          zapier_webhook_url?: string | null
        }
        Update: {
          auto_mode?: boolean | null
          cielo_access_token?: string | null
          cielo_client_id?: string | null
          cielo_environment?: string | null
          cielo_merchant_code?: string | null
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
          paygo_provedor?: string | null
          paygo_retry_attempts?: number | null
          paygo_retry_delay?: number | null
          paygo_timeout?: number | null
          signal_threshold_warning?: number | null
          stone_app_key?: string | null
          stone_code?: string | null
          stone_device_serial?: string | null
          stone_environment?: string | null
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
          coffee_product_id: string | null
          completed_at: string | null
          created_at: string
          duration_minutes: number | null
          id: string
          laundry_id: string | null
          machine_id: string
          metadata: Json
          payment_method: string | null
          started_at: string | null
          status: string
          total_amount: number
          updated_at: string
          user_id: string | null
          weight_kg: number | null
        }
        Insert: {
          coffee_product_id?: string | null
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          laundry_id?: string | null
          machine_id: string
          metadata?: Json
          payment_method?: string | null
          started_at?: string | null
          status?: string
          total_amount: number
          updated_at?: string
          user_id?: string | null
          weight_kg?: number | null
        }
        Update: {
          coffee_product_id?: string | null
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          laundry_id?: string | null
          machine_id?: string
          metadata?: Json
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
            foreignKeyName: "transactions_coffee_product_id_fkey"
            columns: ["coffee_product_id"]
            isOneToOne: false
            referencedRelation: "coffee_products"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "machine_status_view"
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
      machine_status_view: {
        Row: {
          capacity_kg: number | null
          computed_status: string | null
          cycle_time_minutes: number | null
          esp32_id: string | null
          id: string | null
          ip_address: string | null
          is_online: boolean | null
          last_heartbeat: string | null
          laundry_id: string | null
          location: string | null
          name: string | null
          price_per_cycle: number | null
          relay_pin: number | null
          relay_status: Json | null
          signal_strength: number | null
          type: string | null
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
      public_machines: {
        Row: {
          capacity_kg: number | null
          cycle_time_minutes: number | null
          esp32_id: string | null
          id: string | null
          last_maintenance: string | null
          laundry_id: string | null
          location: string | null
          name: string | null
          price_per_cycle: number | null
          relay_pin: number | null
          status: string | null
          temperature: number | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          capacity_kg?: number | null
          cycle_time_minutes?: number | null
          esp32_id?: string | null
          id?: string | null
          last_maintenance?: string | null
          laundry_id?: string | null
          location?: string | null
          name?: string | null
          price_per_cycle?: number | null
          relay_pin?: number | null
          status?: string | null
          temperature?: number | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          capacity_kg?: number | null
          cycle_time_minutes?: number | null
          esp32_id?: string | null
          id?: string | null
          last_maintenance?: string | null
          laundry_id?: string | null
          location?: string | null
          name?: string | null
          price_per_cycle?: number | null
          relay_pin?: number | null
          status?: string | null
          temperature?: number | null
          type?: string | null
          updated_at?: string | null
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
    }
    Functions: {
      _payment_session_blocks_machine: {
        Args: { _machine_id: string }
        Returns: boolean
      }
      admin_remote_release: {
        Args: {
          _machine_id: string
          _product_id?: string
          _valor_centavos?: number
        }
        Returns: string
      }
      begin_totem_payment_session: {
        Args: {
          _coffee_product_id?: string
          _duration_minutes?: number
          _external_reference?: string
          _laundry_id?: string
          _machine_id?: string
          _payment_method?: string
          _provider?: string
          _total_amount?: number
        }
        Returns: Json
      }
      cancel_stale_off_commands: {
        Args: { _esp32_id: string; _relay_pin?: number }
        Returns: number
      }
      cancel_totem_transaction_by_id: {
        Args: { _transaction_id: string }
        Returns: boolean
      }
      claim_pending_esp32_commands: {
        Args: { _esp32_id: string; _limit?: number }
        Returns: {
          action: string
          cycle_time_minutes: number
          id: string
          machine_id: string
          payload: Json
          relay_pin: number
          transaction_id: string
        }[]
      }
      cleanup_esp32_ota_jobs: { Args: never; Returns: undefined }
      cleanup_old_logs: { Args: never; Returns: undefined }
      cleanup_orphan_esp32_status: { Args: never; Returns: undefined }
      cleanup_pending_commands: { Args: never; Returns: undefined }
      reclaim_stale_processing_esp32_commands: { Args: never; Returns: number }
      cleanup_stale_pending_transactions: { Args: never; Returns: undefined }
      complete_totem_transaction_by_id: {
        Args: { _payment_method?: string; _transaction_id: string }
        Returns: boolean
      }
      complete_transaction_on_esp_confirm: {
        Args: { _transaction_id: string }
        Returns: boolean
      }
      create_default_system_settings: {
        Args: { _laundry_id: string }
        Returns: string
      }
      create_totem_coffee_transaction: {
        Args: {
          _laundry_id: string
          _payment_method: string
          _product_id: string
        }
        Returns: string
      }
      create_totem_transaction: {
        Args: {
          _duration_minutes: number
          _laundry_id: string
          _machine_id: string
          _payment_method: string
          _total_amount: number
        }
        Returns: string
      }
      enqueue_coffee_credit_command: {
        Args: { _laundry_id: string; _transaction_id: string }
        Returns: boolean
      }
      enqueue_totem_machine_release: {
        Args: { _transaction_id: string }
        Returns: string
      }
      expire_stale_payment_sessions: {
        Args: { _max_age_minutes?: number }
        Returns: number
      }
      fail_pending_commands_for_transaction: {
        Args: { _transaction_id: string }
        Returns: number
      }
      get_coffee_products: {
        Args: { _laundry_id: string }
        Returns: {
          id: string
          machine_id: string
          name: string
          price: number
          price_cents: number
          sort_order: number
        }[]
      }
      get_esp32_heartbeats: {
        Args: { _laundry_id: string }
        Returns: {
          esp32_id: string
          ip_address: string
          is_online: boolean
          last_heartbeat: string
          relay_status: Json
        }[]
      }
      get_laundry_by_cnpj: {
        Args: { _cnpj: string }
        Returns: {
          cnpj: string
          id: string
          logo_url: string
          name: string
        }[]
      }
      get_laundry_by_id: {
        Args: { _laundry_id: string }
        Returns: {
          cnpj: string
          id: string
          logo_url: string
          name: string
        }[]
      }
      get_operator_release_usage: {
        Args: { _laundry_id: string; _user_id: string }
        Returns: Json
      }
      get_public_machines: {
        Args: { _laundry_id?: string }
        Returns: {
          capacity_kg: number
          cycle_time_minutes: number
          esp32_id: string
          id: string
          last_maintenance: string
          laundry_id: string
          location: string
          name: string
          price_per_cycle: number
          relay_pin: number
          status: string
          temperature: number
          type: string
          updated_at: string
        }[]
      }
      get_totem_command_status: {
        Args: { _command_id?: string; _transaction_id?: string }
        Returns: {
          action: string
          created_at: string
          error_message: string
          id: string
          status: string
          updated_at: string
        }[]
      }
      get_totem_credit_command_status: {
        Args: { _transaction_id: string }
        Returns: {
          action: string
          created_at: string
          error_message: string
          id: string
          status: string
          updated_at: string
        }[]
      }
      get_totem_settings: { Args: { _laundry_id: string }; Returns: Json }
      get_user_laundry_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _laundry_id?: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      list_orphan_totem_releases: {
        Args: { _max_age_minutes?: number; _min_age_seconds?: number }
        Returns: {
          cielo_payment_id: string
          created_at: string
          cycle_time_minutes: number
          esp32_id: string
          has_in_flight_command: boolean
          machine_id: string
          payment_method: string
          relay_pin: number
          total_amount: number
          transaction_id: string
        }[]
      }
      list_payment_diagnostics_admin: {
        Args: { _hours?: number; _laundry_id: string; _limit?: number }
        Returns: {
          amount_cents: number
          authorized_at: string
          cielo_order_id: string
          cielo_payment_id: string
          created_at: string
          esp_command_status: string
          external_reference: string
          has_in_flight_command: boolean
          machine_id: string
          machine_name: string
          needs_refund: boolean
          payment_authorized: boolean
          payment_method: string
          provider: string
          reconciliation_pending: boolean
          released_at: string
          session_id: string
          session_state: string
          transaction_id: string
          transaction_status: string
        }[]
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
      mark_stale_esp32_offline: { Args: never; Returns: undefined }
      mark_totem_payment_authorized: {
        Args: {
          _amount_cents?: number
          _cielo_auth_code?: string
          _cielo_payment_id?: string
          _extra?: Json
          _payment_method?: string
          _transaction_id: string
        }
        Returns: boolean
      }
      mark_totem_payment_needs_refund: {
        Args: { _reason?: string; _transaction_id: string }
        Returns: boolean
      }
      run_payment_reconcile_local: { Args: never; Returns: Json }
      update_payment_session: {
        Args: {
          _cielo_order_id?: string
          _cielo_payment_id?: string
          _external_reference?: string
          _extra?: Json
          _payment_method?: string
          _session_id: string
          _state: string
          _stone_transaction_id?: string
        }
        Returns: boolean
      }
      user_belongs_to_laundry: {
        Args: { _laundry_id: string; _user_id: string }
        Returns: boolean
      }
      validate_admin_pin: { Args: { _pin: string }; Returns: boolean }
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
