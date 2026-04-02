import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LaundryGuard } from "@/components/admin/LaundryGuard";
import CreditReleaseWidget from "@/components/admin/CreditReleaseWidget";
import { CreditCard } from "lucide-react";

export default function Payments() {
  return (
    <LaundryGuard>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Pagamentos</h1>
          <p className="text-sm text-muted-foreground">
            Liberação de créditos e gestão de pagamentos
          </p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Liberação Manual de Crédito
              </CardTitle>
              <CardDescription>
                Libere créditos manualmente para máquinas quando necessário
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CreditReleaseWidget />
            </CardContent>
          </Card>
        </div>
      </div>
    </LaundryGuard>
  );
}
