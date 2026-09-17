import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { LaundryProvider } from "@/contexts/LaundryContext";
import { ThemeProvider } from "next-themes";
import NotFound from "./pages/NotFound";
import Totem from "./pages/Totem";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import NoAccess from "./pages/NoAccess";

// Lazy-loaded admin modules
const AdminLayout = lazy(() => import("./layouts/AdminLayout"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const Machines = lazy(() => import("./pages/admin/Machines"));
const CoffeeMenu = lazy(() => import("./pages/admin/CoffeeMenu"));
const MassageChairConfig = lazy(() => import("./pages/admin/MassageChairConfig"));
const CoffeeMachineConfig = lazy(() => import("./pages/admin/CoffeeMachineConfig"));
const Financeiro = lazy(() => import("./pages/admin/Financeiro"));
const Dispositivos = lazy(() => import("./pages/admin/Dispositivos"));
const Users = lazy(() => import("./pages/admin/Users"));
const Laundries = lazy(() => import("./pages/admin/Laundries"));
const Settings = lazy(() => import("./pages/admin/Settings"));
const Profile = lazy(() => import("./pages/admin/Profile"));

const queryClient = new QueryClient();

const AdminFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

/** Rotas que precisam de LaundryContext — fora disso evita corrida com /auth (Radix Tabs + auth listeners). */
function LaundryProviderLayout() {
  return (
    <LaundryProvider>
      <Outlet />
    </LaundryProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/auth" element={<Auth />} />
            <Route element={<LaundryProviderLayout />}>
              <Route path="totem" element={<Totem />} />
              <Route path="no-access" element={<NoAccess />} />
              <Route path="admin" element={<Suspense fallback={<AdminFallback />}><AdminLayout /></Suspense>}>
                <Route index element={<Suspense fallback={<AdminFallback />}><Dashboard /></Suspense>} />
                <Route path="dashboard" element={<Suspense fallback={<AdminFallback />}><Dashboard /></Suspense>} />
                <Route path="machines" element={<Suspense fallback={<AdminFallback />}><Machines /></Suspense>} />
                <Route path="coffee-menu" element={<Suspense fallback={<AdminFallback />}><CoffeeMenu /></Suspense>} />
                <Route path="coffee-firmware" element={<Suspense fallback={<AdminFallback />}><CoffeeMachineConfig /></Suspense>} />
                <Route path="massage-chair" element={<Suspense fallback={<AdminFallback />}><MassageChairConfig /></Suspense>} />
                <Route path="financeiro" element={<Suspense fallback={<AdminFallback />}><Financeiro /></Suspense>} />
                <Route path="dispositivos" element={<Suspense fallback={<AdminFallback />}><Dispositivos /></Suspense>} />
                <Route path="transactions" element={<Navigate to="/admin/financeiro?tab=transacoes" replace />} />
                <Route path="users" element={<Suspense fallback={<AdminFallback />}><Users /></Suspense>} />
                <Route path="laundries" element={<Suspense fallback={<AdminFallback />}><Laundries /></Suspense>} />
                <Route path="reports" element={<Navigate to="/admin/financeiro?tab=relatorios" replace />} />
                <Route path="payments" element={<Navigate to="/admin/financeiro?tab=cielo" replace />} />
                <Route path="security" element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="settings" element={<Suspense fallback={<AdminFallback />}><Settings /></Suspense>} />
                <Route path="profile" element={<Suspense fallback={<AdminFallback />}><Profile /></Suspense>} />
                <Route path="esp32-diagnostics" element={<Navigate to="/admin/dispositivos?tab=status" replace />} />
                <Route path="ble-diagnostics" element={<Navigate to="/admin/dispositivos?tab=bluetooth" replace />} />
              </Route>
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
