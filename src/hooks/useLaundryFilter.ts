import { useLaundry } from "@/contexts/LaundryContext";

interface LaundryFilterQuery {
  eq: (column: string, value: string) => LaundryFilterQuery;
}

/**
 * Hook customizado para facilitar filtragem por lavanderia
 * Retorna o laundry_id atual e métodos auxiliares
 */
export const useLaundryFilter = () => {
  const { currentLaundry, isSuperAdmin } = useLaundry();
  
  return {
    laundryId: currentLaundry?.id,
    laundryName: currentLaundry?.name,
    isReady: !!currentLaundry,
    isSuperAdmin,
    // Helper para adicionar filtro em queries
    addFilter: <T extends LaundryFilterQuery>(query: T): T => {
      if (currentLaundry?.id) {
        return query.eq('laundry_id', currentLaundry.id) as T;
      }
      return query;
    },
  };
};
