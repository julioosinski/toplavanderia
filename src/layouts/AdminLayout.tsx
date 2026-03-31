import { useEffect, useState } from "react";
import { Outlet, Link, useNavigate, useLocation, Navigate } from "react-router-dom";
import { useLaundry } from "@/contexts/LaundryContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  WashingMachine,
  Receipt,
  Users,
  Store,
  BarChart3,
  Settings,
  LogOut,
  ChevronRight,
  Moon,
  Sun,
  Activity,
  Bluetooth,
  Home,
  Key,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { LaundrySelector } from "@/components/admin/LaundrySelector";
import { NotificationsWidget } from "@/components/admin/NotificationsWidget";
import { PasswordChangeDialog } from "@/components/admin/PasswordChangeDialog";
import { useTheme } from "next-themes";

const menuItems = [
  { title: "Dashboard", url: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Máquinas", url: "/admin/machines", icon: WashingMachine },
  { title: "Transações", url: "/admin/transactions", icon: Receipt },
  { title: "Usuários", url: "/admin/users", icon: Users, adminOnly: true },
  { title: "Lavanderias", url: "/admin/laundries", icon: Store, superAdminOnly: true },
  { title: "Relatórios", url: "/admin/reports", icon: BarChart3 },
  { title: "Diagnóstico ESP32", url: "/admin/esp32-diagnostics", icon: Activity, adminOnly: true },
  { title: "Bluetooth ESP32", url: "/admin/ble-diagnostics", icon: Bluetooth, adminOnly: true },
  { title: "Configurações", url: "/admin/settings", icon: Settings },
];

function AdminSidebar() {
  const location = useLocation();
  const { isSuperAdmin, isAdmin, currentLaundry } = useLaundry();

  const filteredItems = menuItems.filter((item) => {
    if (item.superAdminOnly && !isSuperAdmin) return false;
    if (item.adminOnly && !isAdmin) return false;
    return true;
  });

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-lg font-bold px-4 py-6">
            Top Automações
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { currentLaundry, loading, error, retry, userRole, isSuperAdmin, panelAccessDenied } = useLaundry();
  const [user, setUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const getRoleLabel = () => {
    if (userRole === 'super_admin') return 'Super Admin';
    if (userRole === 'admin') return 'Administrador';
    if (userRole === 'operator') return 'Operador';
    if (userRole === 'totem_device') return 'Dispositivo totem';
    if (userRole === 'user') return 'Usuário';
    return 'Conta';
  };

  const getRoleBadgeVariant = () => {
    if (userRole === 'super_admin') return 'default';
    if (userRole === 'admin') return 'secondary';
    return 'outline';
  };

  const breadcrumbLabels: Record<string, string> = {
    admin: 'Admin',
    dashboard: 'Dashboard',
    machines: 'Máquinas',
    transactions: 'Transações',
    users: 'Usuários',
    laundries: 'Lavanderias',
    reports: 'Relatórios',
    payments: 'Pagamentos',
    security: 'Segurança',
    settings: 'Configurações',
    profile: 'Perfil',
    'esp32-diagnostics': 'Diagnóstico ESP32',
  };

  const getBreadcrumbItems = () => {
    const segments = location.pathname.split('/').filter(Boolean);
    const items: { path: string; label: string }[] = [];
    let acc = '';
    for (const seg of segments) {
      acc += `/${seg}`;
      items.push({
        path: acc,
        label: breadcrumbLabels[seg] || seg,
      });
    }
    return items;
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logout realizado",
      description: "Você saiu do sistema com sucesso.",
    });
    navigate("/auth");
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
          navigate("/auth", { replace: true });
        } else {
          setUser(user);
        }
      } catch (err) {
        console.error('Auth check error:', err);
        navigate("/auth", { replace: true });
      } finally {
        setAuthChecked(true);
      }
    };
    checkAuth();
  }, [navigate]);

  // Aguardar verificação de autenticação
  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirecionar se não autenticado
  if (!user) {
    return null;
  }

  const getUserInitials = () => {
    if (!user?.email) return "U";
    return user.email.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        <p className="text-muted-foreground">Carregando dados...</p>
      </div>
    );
  }

  if (panelAccessDenied) {
    return <Navigate to="/no-access" replace />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 text-center">
        <div className="text-destructive text-6xl">⚠️</div>
        <h2 className="text-2xl font-bold">Erro ao Carregar</h2>
        <p className="text-muted-foreground max-w-md">{error}</p>
        <div className="flex gap-4 mt-4">
          <Button onClick={retry}>Tentar Novamente</Button>
          <Button variant="outline" onClick={handleSignOut}>Sair</Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full">
        <AdminSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 items-center gap-4 px-6">
              <SidebarTrigger />
              <Link to="/">
                <Button variant="ghost" size="icon" title="Início">
                  <Home className="h-4 w-4" />
                </Button>
              </Link>
              
              {/* Breadcrumbs */}
              <nav className="flex items-center gap-2 text-sm text-muted-foreground" aria-label="Breadcrumb">
                {getBreadcrumbItems().map((item, index, arr) => (
                  <div key={item.path} className="flex items-center gap-2">
                    {index > 0 && <ChevronRight className="h-4 w-4 shrink-0" />}
                    {index < arr.length - 1 ? (
                      <Link to={item.path} className="hover:text-foreground transition-colors">
                        {item.label}
                      </Link>
                    ) : (
                      <span className="text-foreground font-medium">{item.label}</span>
                    )}
                  </div>
                ))}
              </nav>

              <div className="flex-1" />
              
              {/* Role Badge */}
              <Badge variant={getRoleBadgeVariant() as any} className="hidden md:flex">
                {getRoleLabel()}
              </Badge>

              <div className="flex items-center gap-3">
                <LaundrySelector />
                <NotificationsWidget />
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full">
                      <Avatar>
                        <AvatarFallback>{getUserInitials()}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium">{user?.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {currentLaundry?.name}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setPasswordDialogOpen(true)}>
                      <Key className="mr-2 h-4 w-4" />
                      Trocar Senha
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/admin/settings")}>
                      <Settings className="mr-2 h-4 w-4" />
                      Configurações
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <PasswordChangeDialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen} />
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
