import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { LaundryGuard } from "@/components/admin/LaundryGuard";
import { PaymentDiagnosticsPanel } from "@/components/admin/PaymentDiagnosticsPanel";
import Reports from "@/pages/admin/Reports";
import Transactions from "@/pages/admin/Transactions";
import { useLaundry } from "@/hooks/useLaundry";
import { Navigate } from "react-router-dom";

export default function Financeiro() {
  const { isAdmin, isSuperAdmin, userRole } = useLaundry();
  const isOperatorOnly = userRole === "operator" && !isAdmin && !isSuperAdmin;

  if (isOperatorOnly) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <LaundryGuard allowSuperAdminAllView>
      <AdminHubTabs
        title="Vendas"
        description="Relatório por máquina e por período, extrato de transações e diagnóstico Cielo."
        defaultTab="relatorios"
        tabs={[
          { id: "relatorios", label: "Relatórios", content: <Reports embedded /> },
          { id: "transacoes", label: "Transações", content: <Transactions embedded /> },
          {
            id: "cielo",
            label: "Cielo",
            content: (
              <LaundryGuard>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Sessões persistidas, pagamentos órfãos e reenfileiramento de liberação sem nova cobrança.
                    Liberação manual do dia a dia fica em Máquinas.
                  </p>
                  <PaymentDiagnosticsPanel />
                </div>
              </LaundryGuard>
            ),
          },
        ]}
      />
    </LaundryGuard>
  );
}
