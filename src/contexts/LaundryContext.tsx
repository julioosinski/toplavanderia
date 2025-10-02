import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Laundry, AppRole } from '@/types/laundry';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface LaundryContextType {
  currentLaundry: Laundry | null;
  userRole: AppRole | null;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isOperator: boolean;
  laundries: Laundry[];
  loading: boolean;
  error: string | null;
  switchLaundry: (laundryId: string) => Promise<void>;
  refreshLaundries: () => Promise<void>;
  retry: () => void;
}

const LaundryContext = createContext<LaundryContextType | undefined>(undefined);

export const LaundryProvider = ({ children }: { children: ReactNode }) => {
  const [currentLaundry, setCurrentLaundry] = useState<Laundry | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [laundries, setLaundries] = useState<Laundry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isSuperAdmin = userRole === 'super_admin';
  const isAdmin = userRole === 'admin' || isSuperAdmin;
  const isOperator = userRole === 'operator' || isAdmin;

  const fetchUserRole = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role, laundry_id')
      .eq('user_id', userId)
      .order('role', { ascending: false }) // super_admin vem primeiro (DESC)
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
      
      // Invalidar todas as queries para forçar reload dos dados
      queryClient.invalidateQueries();
      
      toast({
        title: "Lavanderia alterada",
        description: `Agora você está gerenciando: ${laundry.name}`,
      });
    }
  };

  const initializeLaundryContext = async () => {
    try {
      console.log('[LaundryContext] Iniciando inicialização...');
      setLoading(true);
      setError(null);
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      console.log('[LaundryContext] Usuário obtido:', user?.id);
      
      if (authError || !user) {
        console.log('[LaundryContext] Nenhum usuário autenticado');
        setLoading(false);
        setError(null);
        setInitialized(true);
        return;
      }

      // Buscar role do usuário
      console.log('[LaundryContext] Buscando role do usuário...');
      const roleData = await fetchUserRole(user.id);
      console.log('[LaundryContext] Role encontrada:', roleData);
      
      if (!roleData) {
        throw new Error('Você não tem permissão para acessar o sistema. Entre em contato com o administrador.');
      }

      setUserRole(roleData.role);

      // Se super_admin, buscar todas as lavanderias
      if (roleData.role === 'super_admin') {
        console.log('[LaundryContext] Super admin - buscando todas as lavanderias...');
        const laundriesList = await fetchLaundries();
        console.log('[LaundryContext] Lavanderias encontradas:', laundriesList.length);
        
        if (laundriesList.length === 0) {
          throw new Error('Nenhuma lavanderia cadastrada no sistema.');
        }
        
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
        console.log('[LaundryContext] Admin/Operator - buscando lavanderia específica...');
        const laundry = await fetchCurrentLaundry(roleData.laundry_id);
        console.log('[LaundryContext] Lavanderia encontrada:', laundry?.name);
        
        if (!laundry) {
          throw new Error('Lavanderia não encontrada. Entre em contato com o administrador.');
        }
        
        setCurrentLaundry(laundry);
        setLaundries([laundry]);
      } else {
        throw new Error('Seu perfil não está associado a nenhuma lavanderia. Entre em contato com o administrador.');
      }

      console.log('[LaundryContext] Inicialização concluída com sucesso');
      setLoading(false);
      setInitialized(true);
    } catch (err) {
      console.error('[LaundryContext] Erro na inicialização:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido ao carregar dados';
      setError(errorMessage);
      setLoading(false);
      setInitialized(true);
      toast({
        title: "Erro ao carregar dados",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    initializeLaundryContext();
  }, []);

  const retry = () => {
    initializeLaundryContext();
  };

  // Não renderizar filhos até que o contexto esteja inicializado
  if (!initialized) {
    return (
      <LaundryContext.Provider
        value={{
          currentLaundry: null,
          userRole: null,
          isSuperAdmin: false,
          isAdmin: false,
          isOperator: false,
          laundries: [],
          loading: true,
          error: null,
          switchLaundry: async () => {},
          refreshLaundries: async () => {},
          retry: () => {},
        }}
      >
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </LaundryContext.Provider>
    );
  }

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
        error,
        switchLaundry,
        refreshLaundries,
        retry,
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
