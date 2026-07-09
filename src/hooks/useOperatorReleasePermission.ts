import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLaundry } from '@/hooks/useLaundry';

export interface OperatorReleaseUsage {
  canRelease: boolean;
  dayCents: number;
  monthCents: number;
  dayLimitCents: number | null;
  monthLimitCents: number | null;
  isOperator: boolean;
  loading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Retorna o estado de autorização e uso do usuário logado para libração manual.
 * - Admin/super_admin: canRelease=true, isOperator=false, sem limites.
 * - Operator: consulta operator_release_permissions + uso do dia/mês.
 */
export function useOperatorReleasePermission(): OperatorReleaseUsage {
  const { currentLaundry, userRole, isSuperAdmin, isAdmin } = useLaundry();
  const [state, setState] = useState({
    canRelease: false,
    dayCents: 0,
    monthCents: 0,
    dayLimitCents: null as number | null,
    monthLimitCents: null as number | null,
    loading: true,
  });

  const isOperator = userRole === 'operator' && !isAdmin && !isSuperAdmin;

  const fetchUsage = useCallback(async () => {
    if (isSuperAdmin || isAdmin) {
      setState({
        canRelease: true,
        dayCents: 0,
        monthCents: 0,
        dayLimitCents: null,
        monthLimitCents: null,
        loading: false,
      });
      return;
    }
    if (!isOperator || !currentLaundry?.id) {
      setState((s) => ({ ...s, loading: false, canRelease: false }));
      return;
    }
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) {
        setState((s) => ({ ...s, loading: false, canRelease: false }));
        return;
      }
      const { data, error } = await supabase.rpc('get_operator_release_usage', {
        _user_id: uid,
        _laundry_id: currentLaundry.id,
      });
      if (error) throw error;
      const d = (data ?? {}) as Record<string, unknown>;
      setState({
        canRelease: Boolean(d.can_release),
        dayCents: Number(d.day_cents ?? 0),
        monthCents: Number(d.month_cents ?? 0),
        dayLimitCents: d.day_limit_cents == null ? null : Number(d.day_limit_cents),
        monthLimitCents: d.month_limit_cents == null ? null : Number(d.month_limit_cents),
        loading: false,
      });
    } catch (err) {
      console.warn('[useOperatorReleasePermission]', err);
      setState((s) => ({ ...s, loading: false, canRelease: false }));
    }
  }, [isSuperAdmin, isAdmin, isOperator, currentLaundry?.id]);

  useEffect(() => {
    void fetchUsage();
  }, [fetchUsage]);

  return {
    ...state,
    isOperator,
    refetch: fetchUsage,
  };
}
