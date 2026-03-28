import { Building2 } from "lucide-react";
import { useLaundry } from "@/contexts/LaundryContext";

interface LaundryGuardProps {
  children: React.ReactNode;
  message?: string;
  /**
   * Se true, super admin em modo "todas as lavanderias" ainda vê o conteúdo (ex.: relatório consolidado).
   * Por padrão, exige escolher uma unidade para dados por lavanderia.
   */
  allowSuperAdminAllView?: boolean;
}

/**
 * Protege páginas que precisam de uma lavanderia específica no contexto.
 */
export const LaundryGuard = ({ children, message, allowSuperAdminAllView }: LaundryGuardProps) => {
  const { currentLaundry, loading, isSuperAdmin, isViewingAllLaundries } = useLaundry();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isSuperAdmin && isViewingAllLaundries && !allowSuperAdminAllView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 px-4 text-center">
        <Building2 className="h-16 w-16 text-muted-foreground" />
        <div className="space-y-2 max-w-md">
          <h3 className="text-lg font-semibold">Escolha uma lavanderia</h3>
          <p className="text-muted-foreground text-sm">
            Você está em <strong>Todas as lavanderias</strong> (visão do dashboard). Use o seletor no topo
            para escolher uma unidade e gerenciar máquinas, transações e configurações com dados corretos.
          </p>
        </div>
      </div>
    );
  }

  if (!currentLaundry) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Building2 className="h-16 w-16 text-muted-foreground" />
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold">Nenhuma lavanderia selecionada</h3>
          <p className="text-muted-foreground max-w-md">
            {message || "Selecione uma lavanderia no seletor acima para visualizar os dados."}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
