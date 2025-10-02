import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConsolidatedReportsTab } from "@/components/admin/ConsolidatedReportsTab";
import { LaundryReportsTab } from "@/components/admin/LaundryReportsTab";
import { useLaundry } from "@/contexts/LaundryContext";

export default function Reports() {
  const { isSuperAdmin } = useLaundry();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-muted-foreground">
          {isSuperAdmin 
            ? "Análises e relatórios consolidados de todas as lavanderias" 
            : "Análises e relatórios da sua lavanderia"}
        </p>
      </div>

      {isSuperAdmin ? (
        <Tabs defaultValue="laundry" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="laundry">Por Lavanderia</TabsTrigger>
            <TabsTrigger value="consolidated">Consolidado</TabsTrigger>
          </TabsList>
          <TabsContent value="laundry" className="mt-6">
            <LaundryReportsTab />
          </TabsContent>
          <TabsContent value="consolidated" className="mt-6">
            <ConsolidatedReportsTab />
          </TabsContent>
        </Tabs>
      ) : (
        <LaundryReportsTab />
      )}
    </div>
  );
}
