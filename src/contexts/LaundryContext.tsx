import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Laundry, AppRole } from '@/types/laundry';
import { useToast } from '@/hooks/use-toast';

interface LaundryContextType {
  currentLaundry: Laundry | null;
  userRole: AppRole | null;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isOperator: boolean;
  laundries: Laundry[];
  loading: boolean;
  switchLaundry: (laundryId: string) => Promise<void>;
  refreshLaundries: () => Promise<void>;
}

const LaundryContext = createContext<LaundryContextType | undefined>(undefined);

export const LaundryProvider = ({ children }: { children: ReactNode }) => {
  const [currentLaundry, setCurrentLaundry] = useState<Laundry | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [laundries, setLaundries] = useState<Laundry[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const isSuperAdmin = userRole === 'super_admin';
  const isAdmin = userRole === 'admin' || isSuperAdmin;
  const isOperator = userRole === 'operator' || isAdmin;

  const fetchUserRole = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role, laundry_id')
      .eq('user_id', userId)
      .order('role', { ascending: true }) // super_admin vem antes
      .limit(1);

    if (error) {
      console.error('Error fetching user role:', error);
      return null;
    }

    return data && data.length > 0 ? data[0] : null;
  };

  const fetchLaundries = async () => {
    const { data, error } = await supabase
      .from('laundries')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching laundries:', error);
      toast({
        title: "Erro ao carregar lavanderias",
        description: error.message,
        variant: "destructive",
      });
      return [];
    }

    return data || [];
  };

  const fetchCurrentLaundry = async (laundryId: string) => {
    const { data, error } = await supabase
      .from('laundries')
      .select('*')
      .eq('id', laundryId)
      .single();

    if (error) {
      console.error('Error fetching laundry:', error);
      return null;
    }

    return data;
  };

  const refreshLaundries = async () => {
    const laundriesList = await fetchLaundries();
    setLaundries(laundriesList);
  };

  const switchLaundry = async (laundryId: string) => {
    const laundry = await fetchCurrentLaundry(laundryId);
    if (laundry) {
      setCurrentLaundry(laundry);
      localStorage.setItem('selectedLaundryId', laundryId);
      toast({
        title: "Lavanderia alterada",
        description: `Agora você está gerenciando: ${laundry.name}`,
      });
    }
  };

  useEffect(() => {
    const initializeLaundryContext = async () => {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }

      // Buscar role do usuário
      const roleData = await fetchUserRole(user.id);
      
      if (!roleData) {
        setLoading(false);
        return;
      }

      setUserRole(roleData.role);

      // Se super_admin, buscar todas as lavanderias
      if (roleData.role === 'super_admin') {
        const laundriesList = await fetchLaundries();
        setLaundries(laundriesList);
        
        // Tentar recuperar última lavanderia selecionada
        const savedLaundryId = localStorage.getItem('selectedLaundryId');
        if (savedLaundryId && laundriesList.find(l => l.id === savedLaundryId)) {
          const laundry = await fetchCurrentLaundry(savedLaundryId);
          if (laundry) setCurrentLaundry(laundry);
        } else if (laundriesList.length > 0) {
          setCurrentLaundry(laundriesList[0]);
        }
      } 
      // Se admin/operator, buscar apenas sua lavanderia
      else if (roleData.laundry_id) {
        const laundry = await fetchCurrentLaundry(roleData.laundry_id);
        if (laundry) {
          setCurrentLaundry(laundry);
          setLaundries([laundry]);
        }
      }

      setLoading(false);
    };

    initializeLaundryContext();
  }, []);

  return (
    <LaundryContext.Provider
      value={{
        currentLaundry,
        userRole,
        isSuperAdmin,
        isAdmin,
        isOperator,
        laundries,
        loading,
        switchLaundry,
        refreshLaundries,
      }}
    >
      {children}
    </LaundryContext.Provider>
  );
};

export const useLaundry = () => {
  const context = useContext(LaundryContext);
  if (context === undefined) {
    throw new Error('useLaundry must be used within a LaundryProvider');
  }
  return context;
};
