import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Save } from "lucide-react";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useLaundry } from "@/hooks/useLaundry";
import { SettingsForm } from "./settings/SettingsForm";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2 } from "lucide-react";
import { ESP32PendingApproval } from "./ESP32PendingApproval";
import { ESP32ConfigQRCode } from "./ESP32ConfigQRCode";
import { SectionErrorBoundary } from "@/components/system/SectionErrorBoundary";

export const SettingsTab = () => {
  const { settings, isLoading, updateSettings, isUpdating } = useSystemSettings();
  const { currentLaundry, isAdmin } = useLaundry();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Settings className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Carregando configurações...</p>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <Alert>
        <Building2 className="h-4 w-4" />
        <AlertDescription>
          Nenhuma configuração encontrada. Criando configurações padrão...
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Laundry Info Alert */}
      <Alert>
        <Building2 className="h-4 w-4" />
        <AlertDescription>
          Configurações de <strong>{currentLaundry?.name}</strong>
        </AlertDescription>
      </Alert>

      {isAdmin && (
        <>
          <SectionErrorBoundary title="Falha ao carregar aprovação de ESP32.">
            <ESP32PendingApproval />
          </SectionErrorBoundary>
          <SectionErrorBoundary title="Falha ao carregar gerador de firmware ESP32.">
            <ESP32ConfigQRCode />
          </SectionErrorBoundary>
        </>
      )}

      <SectionErrorBoundary title="Falha ao carregar formulário de configurações.">
        <SettingsForm
          settings={settings}
          onUpdate={updateSettings}
          isUpdating={isUpdating}
          canEdit={isAdmin}
        />
      </SectionErrorBoundary>
    </div>
  );
};