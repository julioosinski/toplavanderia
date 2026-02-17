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
  configureTotemByCNPJ: (cnpj: string) => Promise<boolean>;
}

const LaundryContext = createContext<LaundryContextType | undefined>(undefined);

export const LaundryProvider = ({ children }: { children: ReactNode }) => {
  const [currentLaundry, setCurrentLaundry] = useState<Laundry | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [laundries, setLaundries] = useState<Laundry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      .order('role', { ascending: false });

    if (error) {
      console.error('Error fetching user role:', error);
      return null;
    }

    if (!data || data.length === 0) return null;

    // Se usuário tem apenas super_admin (sem laundry_id), é super_admin
    const superAdminRole = data.find(r => r.role === 'super_admin' && !r.laundry_id);
    const hasOnlySuperAdmin = data.length === 1 && superAdminRole;
    
    if (hasOnlySuperAdmin) {
      return superAdminRole;
    }

    // Se tem outras roles além de super_admin, priorizar role com laundry_id
    const roleWithLaundry = data.find(r => r.laundry_id !== null);
    if (roleWithLaundry) {
      return roleWithLaundry;
    }

    // Fallback para primeira role
    return data[0];
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
      
      // Envolver getUser() em try/catch separado para capturar erros de rede
      // (timeout, DNS failure) sem bloquear o fluxo do modo totem
      let user = null;
      try {
        const authPromise = supabase.auth.getUser();
        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('auth_timeout')), 5000)
        );
        const result = await Promise.race([authPromise, timeoutPromise]) as Awaited<ReturnType<typeof supabase.auth.getUser>>;
        if (result && !result.error) user = result.data.user;
      } catch (networkError) {
        console.warn('[LaundryContext] Auth check falhou (rede/timeout) - modo totem será verificado');
      }
      console.log('[LaundryContext] Usuário obtido:', user?.id);
      
      if (!user) {
        console.log('[LaundryContext] Nenhum usuário autenticado - verificando modo totem...');
        
        // Modo totem: verificar se há lavanderia salva no localStorage
        const totemLaundryId = localStorage.getItem('totem_laundry_id');
        if (totemLaundryId) {
          console.log('[LaundryContext] Modo totem: carregando lavanderia', totemLaundryId);
          const laundry = await fetchCurrentLaundry(totemLaundryId);
          if (laundry) {
            setCurrentLaundry(laundry);
            setLaundries([laundry]);
            console.log('[LaundryContext] Modo totem: lavanderia carregada -', laundry.name);
          } else {
            console.warn('[LaundryContext] Modo totem: lavanderia não encontrada, limpando localStorage');
            localStorage.removeItem('totem_laundry_id');
          }
        }
        
        setLoading(false);
        setError(null);
        return;
      }

      // Buscar role do usuário
      console.log('[LaundryContext] Buscando role do usuário...');
      const roleData = await fetchUserRole(user.id);
      console.log('[LaundryContext] Role encontrada:', roleData);
      
      if (!roleData) {
        console.log('[LaundryContext] Usuário sem role - redirecionando para auth');
        setLoading(false);
        setError('Você não tem permissão para acessar o painel administrativo. Entre em contato com o administrador.');
        return;
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
    } catch (err) {
      console.error('[LaundryContext] Erro na inicialização:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido ao carregar dados';
      setError(errorMessage);
      setLoading(false);
      toast({
        title: "Erro ao carregar dados",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    initializeLaundryContext();

    // Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[LaundryContext] Auth state changed:', event);
      if (event === 'SIGNED_IN' && session) {
        initializeLaundryContext();
      } else if (event === 'SIGNED_OUT') {
        setCurrentLaundry(null);
        setUserRole(null);
        setLaundries([]);
        setLoading(false);
        setError(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const retry = () => {
    initializeLaundryContext();
  };

  const configureTotemByCNPJ = async (cnpj: string): Promise<boolean> => {
    try {
      const cleanCnpj = cnpj.replace(/\D/g, '');
      const { data, error } = await supabase
        .from('laundries')
        .select('*')
        .eq('cnpj', cleanCnpj)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        console.error('[LaundryContext] CNPJ não encontrado:', cnpj);
        return false;
      }

      localStorage.setItem('totem_laundry_id', data.id);
      setCurrentLaundry(data);
      setLaundries([data]);
      console.log('[LaundryContext] Totem configurado com sucesso:', data.name);
      return true;
    } catch (err) {
      console.error('[LaundryContext] Erro ao configurar totem por CNPJ:', err);
      return false;
    }
  };

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
        configureTotemByCNPJ,
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
