import { SettingsTab } from "@/components/admin/SettingsTab";

export default function Settings() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          Configure o sistema e integrações
        </p>
      </div>

      <SettingsTab />
    </div>
  );
}
