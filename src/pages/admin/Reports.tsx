import { ConsolidatedReportsTab } from "@/components/admin/ConsolidatedReportsTab";
import { LaundryReportsTab } from "@/components/admin/LaundryReportsTab";
import { LaundryGuard } from "@/components/admin/LaundryGuard";
import { useLaundry } from "@/hooks/useLaundry";
import { Navigate } from "react-router-dom";

interface ReportsProps {
  embedded?: boolean;
}

export default function Reports({ embedded = false }: ReportsProps) {
  const { isSuperAdmin, isAdmin, isViewingAllLaundries, userRole } = useLaundry();
  const isOperatorOnly = userRole === "operator" && !isAdmin && !isSuperAdmin;

  if (isOperatorOnly) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const heading = !embedded && (
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            {isSuperAdmin && isViewingAllLaundries
              ? "Visão consolidada de todas as lavanderias. Para relatórios por unidade, selecione uma lavanderia no menu superior."
              : "Análises e relatórios da lavanderia selecionada"}
          </p>
        </div>
  );

  if (isSuperAdmin && isViewingAllLaundries) {
    return (
      <div className="space-y-6">
        {heading}
        <ConsolidatedReportsTab />
      </div>
    );
  }

  return (
    <LaundryGuard>
      <div className="space-y-6">
        {heading}

        <LaundryReportsTab />
      </div>
    </LaundryGuard>
  );
}
