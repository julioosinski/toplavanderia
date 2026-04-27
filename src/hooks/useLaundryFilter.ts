import { useCallback, useMemo } from "react";
import { useLaundry } from "@/hooks/useLaundry";

interface LaundryFilterQuery {
  eq: (column: string, value: string) => LaundryFilterQuery;
}

/**
 * Hook customizado para facilitar filtragem por lavanderia
 * Retorna o laundry_id atual e métodos auxiliares
 */
export const useLaundryFilter = () => {
  const { currentLaundry, isSuperAdmin } = useLaundry();
  const laundryId = currentLaundry?.id;
  const laundryName = currentLaundry?.name;

  const addFilter = useCallback(<T extends LaundryFilterQuery>(query: T): T => {
    if (laundryId) {
      return query.eq('laundry_id', laundryId) as T;
    }
    return query;
  }, [laundryId]);

  return useMemo(() => ({
    laundryId: currentLaundry?.id,
    laundryName: currentLaundry?.name,
    isReady: !!laundryId,
    isSuperAdmin,
    addFilter,
  }), [addFilter, currentLaundry?.id, currentLaundry?.name, isSuperAdmin, laundryId]);
};
