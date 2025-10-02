import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LaundryProvider } from "@/contexts/LaundryContext";
import { ThemeProvider } from "next-themes";
import NotFound from "./pages/NotFound";
import Totem from "./pages/Totem";
import Auth from "./pages/Auth";
import AdminLayout from "./layouts/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import Machines from "./pages/admin/Machines";
import Transactions from "./pages/admin/Transactions";
import Users from "./pages/admin/Users";
import Laundries from "./pages/admin/Laundries";
import Reports from "./pages/admin/Reports";
import Security from "./pages/admin/Security";
import Settings from "./pages/admin/Settings";
import Profile from "./pages/admin/Profile";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <LaundryProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/totem" replace />} />
              <Route path="/totem" element={<Totem />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="machines" element={<Machines />} />
                <Route path="transactions" element={<Transactions />} />
                <Route path="users" element={<Users />} />
                <Route path="laundries" element={<Laundries />} />
                <Route path="reports" element={<Reports />} />
                <Route path="security" element={<Security />} />
                <Route path="settings" element={<Settings />} />
                <Route path="profile" element={<Profile />} />
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
