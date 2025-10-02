import { LaundryManagement } from "@/components/admin/LaundryManagement";

export default function Laundries() {
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
