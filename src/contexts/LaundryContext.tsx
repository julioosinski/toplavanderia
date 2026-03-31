import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Laundry, AppRole, ADMIN_PANEL_ROLES } from '@/types/laundry';

const debugLaundry = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.log(...args);
};
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { nativeStorage, getItemWithTimeout } from '@/utils/nativeStorage';

interface LaundryContextType {
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

const LaundryContext = createContext<LaundryContextType | undefined>(undefined);

export const LaundryProvider = ({ children }: { children: ReactNode }) => {
  const [currentLaundry, setCurrentLaundry] = useState<Laundry | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [laundries, setLaundries] = useState<Laundry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isViewingAllLaundries, setIsViewingAllLaundries] = useState(false);
  const [panelAccessDenied, setPanelAccessDenied] = useState(false);
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

    // Se usuário tem role super_admin, sempre priorizar
    const superAdminRole = data.find(r => r.role === 'super_admin');
    if (superAdminRole) {
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
      setIsViewingAllLaundries(false);
      setCurrentLaundry(laundry);
      await nativeStorage.setItem('selectedLaundryId', laundryId);
      queryClient.invalidateQueries();
      toast({
        title: 'Lavanderia alterada',
        description: `Agora você está gerenciando: ${laundry.name}`,
      });
    }
  };

  const switchToAllLaundries = async () => {
    await nativeStorage.setItem('selectedLaundryId', 'all');
    setIsViewingAllLaundries(true);
    queryClient.invalidateQueries();
    toast({
      title: 'Visão consolidada',
      description: 'Dashboard e relatórios globais. Para editar máquinas ou configurações, escolha uma lavanderia no menu.',
    });
  };

  const initializingRef = useRef(false);

  const initializeLaundryContext = async () => {
    if (initializingRef.current) {
      debugLaundry('[LaundryContext] Inicialização já em andamento, ignorando chamada duplicada');
      return;
    }
    initializingRef.current = true;

    try {
      debugLaundry('[LaundryContext] Iniciando inicialização...');
      setLoading(true);
      setError(null);
      setPanelAccessDenied(false);
      
      let user = null;
      try {
        const authPromise = supabase.auth.getUser();
        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('auth_timeout')), 3000)
        );
        const result = await Promise.race([authPromise, timeoutPromise]) as Awaited<ReturnType<typeof supabase.auth.getUser>>;
        if (result && !result.error) user = result.data.user;
      } catch (networkError) {
        console.warn('[LaundryContext] Auth check falhou (rede/timeout) - modo totem será verificado');
      }
      debugLaundry('[LaundryContext] Usuário obtido:', user?.id);

      if (!user) {
        setIsViewingAllLaundries(false);
        debugLaundry('[LaundryContext] Nenhum usuário autenticado - verificando modo totem...');
        
        // Modo totem: verificar se há lavanderia salva no storage nativo (ou localStorage).
        // getItem sem timeout pode nunca resolver no WebView → laundryLoading infinito.
        const totemLaundryId = await getItemWithTimeout('totem_laundry_id', 3000);
        if (totemLaundryId) {
          debugLaundry('[LaundryContext] Modo totem: carregando lavanderia', totemLaundryId);
          const laundry = await Promise.race([
            fetchCurrentLaundry(totemLaundryId),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000)),
          ]);
          if (laundry) {
            setCurrentLaundry(laundry);
            setLaundries([laundry]);
            debugLaundry('[LaundryContext] Modo totem: lavanderia carregada -', laundry.name);
          } else {
            console.warn('[LaundryContext] Modo totem: lavanderia não encontrada, limpando storage');
            await Promise.race([
              nativeStorage.removeItem('totem_laundry_id'),
              new Promise<void>((r) => setTimeout(r, 4000)),
            ]);
          }
        }
        
        setLoading(false);
        setError(null);
        return;
      }

      debugLaundry('[LaundryContext] Buscando role do usuário...');
      const roleData = await fetchUserRole(user.id);
      debugLaundry('[LaundryContext] Role encontrada:', roleData);

      if (!roleData) {
        setLoading(false);
        setError('Você não tem permissão para acessar o painel administrativo. Entre em contato com o administrador.');
        return;
      }

      setUserRole(roleData.role);

      if (!ADMIN_PANEL_ROLES.includes(roleData.role as AppRole)) {
        setPanelAccessDenied(true);
        setCurrentLaundry(null);
        setLaundries([]);
        setIsViewingAllLaundries(false);
        setLoading(false);
        setError(null);
        return;
      }

      // Se super_admin, buscar todas as lavanderias
      if (roleData.role === 'super_admin') {
        debugLaundry('[LaundryContext] Super admin - buscando todas as lavanderias...');
        const laundriesList = await fetchLaundries();
        debugLaundry('[LaundryContext] Lavanderias encontradas:', laundriesList.length);
        
        if (laundriesList.length === 0) {
          throw new Error('Nenhuma lavanderia cadastrada no sistema.');
        }
        
        setLaundries(laundriesList);

        const savedLaundryId = await getItemWithTimeout('selectedLaundryId', 3000);
        if (savedLaundryId === 'all') {
          setIsViewingAllLaundries(true);
          if (laundriesList[0]) {
            const first = await fetchCurrentLaundry(laundriesList[0].id);
            if (first) setCurrentLaundry(first);
          }
        } else if (savedLaundryId && laundriesList.find((l) => l.id === savedLaundryId)) {
          setIsViewingAllLaundries(false);
          const laundry = await fetchCurrentLaundry(savedLaundryId);
          if (laundry) setCurrentLaundry(laundry);
        } else if (laundriesList.length > 0) {
          setIsViewingAllLaundries(false);
          setCurrentLaundry(laundriesList[0]);
        }
      }
      // Se admin/operator, buscar apenas sua lavanderia
      else if (roleData.laundry_id) {
        setIsViewingAllLaundries(false);
        debugLaundry('[LaundryContext] Admin/Operator - buscando lavanderia específica...');
        const laundry = await fetchCurrentLaundry(roleData.laundry_id);
        debugLaundry('[LaundryContext] Lavanderia encontrada:', laundry?.name);
        
        if (!laundry) {
          throw new Error('Lavanderia não encontrada. Entre em contato com o administrador.');
        }
        
        setCurrentLaundry(laundry);
        setLaundries([laundry]);
      } else {
        throw new Error('Seu perfil não está associado a nenhuma lavanderia. Entre em contato com o administrador.');
      }

      debugLaundry('[LaundryContext] Inicialização concluída com sucesso');
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
      debugLaundry('[LaundryContext] Auth state changed:', event);
      if (event === 'SIGNED_IN' && session) {
        initializeLaundryContext();
      } else if (event === 'SIGNED_OUT') {
        setCurrentLaundry(null);
        setUserRole(null);
        setLaundries([]);
        setIsViewingAllLaundries(false);
        setPanelAccessDenied(false);
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
      // Use security definer RPC to look up laundry by CNPJ (public read removed)
      const queryPromise = supabase
        .rpc('get_laundry_by_cnpj', { _cnpj: cleanCnpj })
        .single();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('cnpj_lookup_timeout')), 12000)
      );
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as Awaited<typeof queryPromise>;

      if (error || !data) {
        console.error('[LaundryContext] CNPJ não encontrado:', cnpj);
        return false;
      }

      // Fetch full laundry record by ID (authenticated users have role-based access)
      const { data: fullLaundry } = await supabase
        .from('laundries')
        .select('*')
        .eq('id', data.id)
        .single();

      const laundryData = fullLaundry || { ...data, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Laundry;

      // Evita travar a UI caso o plugin nativo de storage fique pendurado.
      await Promise.race([
        nativeStorage.setItem('totem_laundry_id', data.id),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('storage_timeout')), 4000)),
      ]).catch((storageErr) => {
        console.warn('[LaundryContext] Falha/timeout ao salvar totem_laundry_id, seguindo com estado em memória:', storageErr);
      });
      setCurrentLaundry(laundryData);
      setLaundries([laundryData]);
      debugLaundry('[LaundryContext] Totem configurado com sucesso:', laundryData.name);
      return true;
    } catch (err) {
      console.error('[LaundryContext] Erro ao configurar totem por CNPJ:', err);
      if (err instanceof Error && err.message === 'cnpj_lookup_timeout') {
        toast({
          title: "Tempo esgotado",
          description: "Não foi possível consultar o CNPJ. Verifique a internet do tablet e tente novamente.",
          variant: "destructive",
        });
      }
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
        isViewingAllLaundries,
        panelAccessDenied,
        laundries,
        loading,
        error,
        switchLaundry,
        switchToAllLaundries,
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
