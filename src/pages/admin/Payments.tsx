import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LaundryGuard } from "@/components/admin/LaundryGuard";
import CreditReleaseWidget from "@/components/admin/CreditReleaseWidget";
import { PaymentDiagnosticsPanel } from "@/components/admin/PaymentDiagnosticsPanel";
import { CreditCard, Stethoscope } from "lucide-react";

export default function Payments() {
  return (
    <LaundryGuard>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Pagamentos</h1>
          <p className="text-sm text-muted-foreground">
            Diagnóstico Cielo, reconciliação e liberação manual
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              Diagnóstico de pagamentos (Cielo)
            </CardTitle>
            <CardDescription>
              Sessões persistidas, pagamentos órfãos e reenfileiramento de liberação ESP sem nova cobrança
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PaymentDiagnosticsPanel />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Liberação manual de crédito
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
    </LaundryGuard>
  );
}
