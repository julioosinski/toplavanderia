import { createContext } from 'react';
import { Laundry, AppRole } from '@/types/laundry';

export interface LaundryContextType {
  currentLaundry: Laundry | null;
  userRole: AppRole | null;
  isSuperAdmin: boolean;
  /** Acesso administrativo ao painel: super_admin, dono (admin) ou gerente (manager). */
  isAdmin: boolean;
  /** Dono da lavanderia ou super_admin (exclui gerente). */
  isOwner: boolean;
  isManager: boolean;
  isOperator: boolean;
  /** Pode abrir a tela de usuários e criar cadastros (super_admin, dono, gerente). */
  canManageUsers: boolean;
  /** Liberação manual depende de autorização explícita (gerente/operador). */
  requiresReleasePermission: boolean;
  /** Super admin com visão consolidada (todas as lavanderias) — use no dashboard */
  isViewingAllLaundries: boolean;
  /** Login com perfil sem acesso ao painel (ex.: user, totem_device) */
  panelAccessDenied: boolean;
  laundries: Laundry[];
  loading: boolean;
  error: string | null;
  switchLaundry: (laundryId: string) => Promise<void>;
  switchToAllLaundries: () => Promise<void>;
  refreshLaundries: () => Promise<void>;
  retry: () => void;
  configureTotemByCNPJ: (cnpj: string) => Promise<boolean>;
}

export const LaundryContext = createContext<LaundryContextType | undefined>(undefined);
