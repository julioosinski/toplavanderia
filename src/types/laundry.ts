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

/**
 * super_admin = administrador do sistema; admin = dono da lavanderia;
 * manager = gerente (painel como o dono, mas só cadastra operadores).
 */
export type AppRole = 'super_admin' | 'admin' | 'manager' | 'operator' | 'user' | 'totem_device';

/** Perfis que podem usar o painel web /admin */
export const ADMIN_PANEL_ROLES: AppRole[] = ['super_admin', 'admin', 'manager', 'operator'];

/** Maior privilégio primeiro — usado para escolher o papel ativo quando há mais de um. */
export const ROLE_PRIORITY: AppRole[] = ['super_admin', 'admin', 'manager', 'operator', 'user', 'totem_device'];

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Administrador do sistema',
  admin: 'Dono da lavanderia',
  manager: 'Gerente',
  operator: 'Operador',
  user: 'Usuário',
  totem_device: 'Dispositivo totem',
};

/** Perfis cuja liberação manual de máquinas depende de autorização do dono/gerente. */
export const RELEASE_PERMISSION_ROLES: AppRole[] = ['manager', 'operator'];

/**
 * Perfis que cada papel pode cadastrar (espelha public.can_manage_user_role).
 * Operador/usuário não cadastram ninguém.
 */
export const CREATABLE_ROLES_BY_ROLE: Partial<Record<AppRole, AppRole[]>> = {
  super_admin: ['super_admin', 'admin', 'manager', 'operator', 'user', 'totem_device'],
  admin: ['manager', 'operator', 'user', 'totem_device'],
  manager: ['operator'],
};

/** Quem pode ligar/desligar a liberação manual de quem (espelha public.can_manage_release_permission). */
export const RELEASE_MANAGEABLE_BY_ROLE: Partial<Record<AppRole, AppRole[]>> = {
  super_admin: ['manager', 'operator'],
  admin: ['manager', 'operator'],
  manager: ['operator'],
};

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  laundry_id?: string;
  created_at: string;
}
