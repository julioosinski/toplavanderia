import { Building2 } from "lucide-react";
import { useLaundry } from "@/contexts/LaundryContext";

interface LaundryGuardProps {
  children: React.ReactNode;
  message?: string;
}

/**
 * Componente que protege páginas que requerem lavanderia selecionada
 */
export const LaundryGuard = ({ children, message }: LaundryGuardProps) => {
  const { currentLaundry, loading } = useLaundry();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
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
