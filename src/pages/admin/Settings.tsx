import { SettingsTab } from "@/components/admin/SettingsTab";
import { LaundryGuard } from "@/components/admin/LaundryGuard";
import { useLaundry } from "@/hooks/useLaundry";
import { SectionErrorBoundary } from "@/components/system/SectionErrorBoundary";

export default function Settings() {
  const { currentLaundry } = useLaundry();
  
  return (
    <LaundryGuard>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground">
            Wi-Fi da unidade, gateway de pagamento, NFS-e e monitoramento. Firmware ESP32 (QR/OTA) está em Dispositivos.
          </p>
        </div>

        <SectionErrorBoundary title="Falha ao carregar os elementos da página de configurações.">
          <SettingsTab />
        </SectionErrorBoundary>
      </div>
    </LaundryGuard>
  );
}
