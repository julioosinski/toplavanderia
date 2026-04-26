import { createContext } from 'react';
import { Laundry, AppRole } from '@/types/laundry';

export interface LaundryContextType {
  currentLaundry: Laundry | null;
  userRole: AppRole | null;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isOperator: boolean;
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
