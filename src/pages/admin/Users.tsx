import { UserManagement } from "@/components/admin/UserManagement";
import { LaundryGuard } from "@/components/admin/LaundryGuard";

export default function Users() {
  return (
    <LaundryGuard>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Usuários</h1>
          <p className="text-muted-foreground">
            Gerencie usuários e permissões
          </p>
        </div>

        <UserManagement />
      </div>
    </LaundryGuard>
  );
}
