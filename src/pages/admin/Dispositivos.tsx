import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { LaundryGuard } from "@/components/admin/LaundryGuard";
import { SectionErrorBoundary } from "@/components/system/SectionErrorBoundary";
import { ESP32PendingApproval } from "@/components/admin/ESP32PendingApproval";
import { ESP32ConfigQRCode } from "@/components/admin/ESP32ConfigQRCode";
import { ESP32FirmwareOta } from "@/components/admin/ESP32FirmwareOta";
import ESP32Diagnostics from "@/pages/admin/ESP32Diagnostics";
import BLEDiagnostics from "@/pages/admin/BLEDiagnostics";
import { useLaundry } from "@/hooks/useLaundry";

export default function Dispositivos() {
  const { isAdmin } = useLaundry();

  return (
    <LaundryGuard>
      <AdminHubTabs
        title="Dispositivos"
        description="Status Wi-Fi dos ESP32, Bluetooth (app nativo) e firmware em uma tela só."
        defaultTab="status"
        tabs={[
          { id: "status", label: "Status", content: <ESP32Diagnostics embedded /> },
          { id: "bluetooth", label: "Bluetooth", content: <BLEDiagnostics embedded /> },
          {
            id: "firmware",
            label: "Firmware",
            content: isAdmin ? (
              <div className="space-y-6">
                <SectionErrorBoundary title="Falha ao carregar aprovação de ESP32.">
                  <ESP32PendingApproval />
                </SectionErrorBoundary>
                <SectionErrorBoundary title="Falha ao carregar gerador de firmware.">
                  <ESP32ConfigQRCode />
                </SectionErrorBoundary>
                <SectionErrorBoundary title="Falha ao carregar OTA de firmware.">
                  <ESP32FirmwareOta />
                </SectionErrorBoundary>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                A geração e o OTA de firmware são restritos a administradores.
              </p>
            ),
          },
        ]}
      />
    </LaundryGuard>
  );
}
