import { SettingsTab } from "@/components/admin/SettingsTab";
import { LaundryGuard } from "@/components/admin/LaundryGuard";
import { useLaundry } from "@/contexts/LaundryContext";

export default function Settings() {
  const { currentLaundry } = useLaundry();
  
  return (
    <LaundryGuard>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground">
            Configure o sistema e integrações para {currentLaundry?.name}
          </p>
        </div>

        <SettingsTab />
      </div>
    </LaundryGuard>
  );
}
