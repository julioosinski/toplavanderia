import { Settings } from "lucide-react";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useLaundry } from "@/hooks/useLaundry";
import { SettingsForm } from "./settings/SettingsForm";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2 } from "lucide-react";
import { SectionErrorBoundary } from "@/components/system/SectionErrorBoundary";

export const SettingsTab = () => {
  const { settings, isLoading, updateSettings, isUpdating } = useSystemSettings();
  const { isAdmin } = useLaundry();

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