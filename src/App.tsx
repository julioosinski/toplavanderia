import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
const Transactions = lazy(() => import("./pages/admin/Transactions"));
const Users = lazy(() => import("./pages/admin/Users"));
const Laundries = lazy(() => import("./pages/admin/Laundries"));
const Reports = lazy(() => import("./pages/admin/Reports"));
const Settings = lazy(() => import("./pages/admin/Settings"));
const Profile = lazy(() => import("./pages/admin/Profile"));
const ESP32Diagnostics = lazy(() => import("./pages/admin/ESP32Diagnostics"));
const BLEDiagnostics = lazy(() => import("./pages/admin/BLEDiagnostics"));

const queryClient = new QueryClient();

const AdminFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <LaundryProvider>
        <TooltipProvider>
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/totem" element={<Totem />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/no-access" element={<NoAccess />} />
              <Route path="/admin" element={<Suspense fallback={<AdminFallback />}><AdminLayout /></Suspense>}>
                <Route index element={<Suspense fallback={<AdminFallback />}><Dashboard /></Suspense>} />
                <Route path="dashboard" element={<Suspense fallback={<AdminFallback />}><Dashboard /></Suspense>} />
                <Route path="machines" element={<Suspense fallback={<AdminFallback />}><Machines /></Suspense>} />
                <Route path="transactions" element={<Suspense fallback={<AdminFallback />}><Transactions /></Suspense>} />
                <Route path="users" element={<Suspense fallback={<AdminFallback />}><Users /></Suspense>} />
                <Route path="laundries" element={<Suspense fallback={<AdminFallback />}><Laundries /></Suspense>} />
                <Route path="reports" element={<Suspense fallback={<AdminFallback />}><Reports /></Suspense>} />
                <Route path="payments" element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="security" element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="settings" element={<Suspense fallback={<AdminFallback />}><Settings /></Suspense>} />
                <Route path="profile" element={<Suspense fallback={<AdminFallback />}><Profile /></Suspense>} />
                <Route path="esp32-diagnostics" element={<Suspense fallback={<AdminFallback />}><ESP32Diagnostics /></Suspense>} />
                <Route path="ble-diagnostics" element={<Suspense fallback={<AdminFallback />}><BLEDiagnostics /></Suspense>} />
              </Route>
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </LaundryProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
