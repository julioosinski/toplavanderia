import { ConsolidatedReportsTab } from "@/components/admin/ConsolidatedReportsTab";

export default function Reports() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-muted-foreground">
          Análises e relatórios consolidados
        </p>
      </div>

      <ConsolidatedReportsTab />
    </div>
  );
}
