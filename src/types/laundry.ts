import { Json } from '@/integrations/supabase/types';

export interface Laundry {
  id: string;
  name: string;
  cnpj: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  email?: string | null;
  logo_url?: string | null;
  is_active: boolean;
  owner_id?: string | null;
  settings?: Json;
  created_at: string;
  updated_at: string;
}

export type AppRole = 'super_admin' | 'admin' | 'operator' | 'user' | 'totem_device';

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  laundry_id?: string;
  created_at: string;
}
