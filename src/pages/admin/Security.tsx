import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuditLogsTab } from "@/components/admin/AuditLogsTab";
import { SecurityEventsTab } from "@/components/admin/SecurityEventsTab";

export default function Security() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Segurança</h1>
        <p className="text-muted-foreground">
          Auditoria e eventos de segurança
        </p>
      </div>

      <Tabs defaultValue="audit" className="space-y-4">
        <TabsList>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
          <TabsTrigger value="events">Eventos de Segurança</TabsTrigger>
        </TabsList>

        <TabsContent value="audit">
          <AuditLogsTab />
        </TabsContent>

        <TabsContent value="events">
          <SecurityEventsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
