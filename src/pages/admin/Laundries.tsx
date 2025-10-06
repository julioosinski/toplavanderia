import { LaundryManagement } from "@/components/admin/LaundryManagement";
import { useLaundry } from "@/contexts/LaundryContext";
import { Building2 } from "lucide-react";

export default function Laundries() {
  const { isSuperAdmin, loading } = useLaundry();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Building2 className="h-16 w-16 text-muted-foreground" />
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold">Acesso Negado</h3>
          <p className="text-muted-foreground max-w-md">
            Apenas super administradores podem gerenciar lavanderias.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Lavanderias</h1>
        <p className="text-muted-foreground">
          Gerencie todas as lavanderias da rede
        </p>
      </div>

      <LaundryManagement />
    </div>
  );
}
