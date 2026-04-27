import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wifi, CheckCircle2, XCircle, Loader2, CreditCard, Cpu } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from "@/hooks/use-toast";
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import PayGO from '@/plugins/paygo';
import { useLaundry } from '@/hooks/useLaundry';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { useDeviceMode } from '@/hooks/useDeviceMode';

export const PaymentDiagnostics = () => {
  const { currentLaundry } = useLaundry();
  const { settings } = useSystemSettings();
  const { mode: deviceMode } = useDeviceMode();
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<{
    gateway: boolean | null;
    peripheral: boolean | null;
    esp32s: Record<string, boolean>;
  }>({
    gateway: null,
    peripheral: null,
    esp32s: {},
  });

  const paymentProvider = useMemo(
    () => (settings?.paygo_provedor || (deviceMode === 'smartpos' ? 'cielo' : 'paygo')).toLowerCase(),
    [settings?.paygo_provedor, deviceMode]
  );
  const gatewayBrand = paymentProvider === 'cielo' ? 'Cielo LIO' : 'PayGO';

  /** Alinhado ao totem: integração real via plugin nativo; HTTP só para PayGO em ambiente web/dev. */
  const testGateway = async (): Promise<boolean> => {
    try {
      if (!settings?.paygo_enabled) {
        return false;
      }

      if (Capacitor.isNativePlatform()) {
        const result = await PayGO.testConnection({ provider: paymentProvider as 'paygo' | 'cielo' });
        return result.success === true;
      }

      if (paymentProvider === 'cielo') {
        return false;
      }

      const host = settings.paygo_host;
      const port = settings.paygo_port;
      if (!host || port == null) return false;

      const response = await CapacitorHttp.request({
        url: `http://${host}:${port}/status`,
        method: 'GET',
        connectTimeout: 5000,
        readTimeout: 5000,
      });

      return response.status === 200;
    } catch (error) {
      console.error('Erro teste integração de pagamento:', error);
      return false;
    }
  };

  const testPeripheral = async (): Promise<boolean> => {
    try {
      if (!Capacitor.isNativePlatform()) {
        return false;
      }
      const result = await PayGO.detectPinpad({ provider: paymentProvider as 'paygo' | 'cielo' });
      return result.detected === true;
    } catch (error) {
      console.error('Erro teste pinpad/terminal:', error);
      return false;
    }
  };

  const testESP32s = async () => {
    try {
      const { data: esp32List } = await supabase
        .from('esp32_status')
        .select('esp32_id, ip_address, is_online');

      if (!esp32List) return {};

      const results: Record<string, boolean> = {};

      for (const esp32 of esp32List) {
        try {
          const response = await CapacitorHttp.request({
            url: `http://${esp32.ip_address}/status`,
            method: 'GET',
            connectTimeout: 3000,
            readTimeout: 3000,
          });

          results[esp32.esp32_id] = response.status === 200;
        } catch {
          results[esp32.esp32_id] = false;
        }
      }

      return results;
    } catch (error) {
      console.error('Erro teste ESP32s:', error);
      return {};
    }
  };

  const runAllTests = async () => {
    if (!currentLaundry?.id) {
      toast.error('Configure a lavanderia (CNPJ no totem) antes de diagnosticar.');
      return;
    }

    setTesting(true);
    toast.info('Iniciando diagnóstico...');

    try {
      const [gatewayResult, peripheralResult, esp32Results] = await Promise.all([
        testGateway(),
        testPeripheral(),
        testESP32s(),
      ]);

      setResults({
        gateway: gatewayResult,
        peripheral: peripheralResult,
        esp32s: esp32Results,
      });

      const allPassed =
        gatewayResult &&
        peripheralResult &&
        Object.values(esp32Results).every((r) => r);

      if (allPassed) {
        toast.success('✅ Todos os testes passaram!');
      } else {
        toast.warning('⚠️ Alguns testes falharam');
      }
    } catch (error) {
      toast.error('Erro ao executar diagnóstico');
      console.error(error);
    } finally {
      setTesting(false);
    }
  };

  const StatusIcon = ({ status }: { status: boolean | null }) => {
    if (status === null) return null;
    return status ? (
      <CheckCircle2 className="h-5 w-5 text-green-500" />
    ) : (
      <XCircle className="h-5 w-5 text-destructive" />
    );
  };

  const peripheralLabel =
    paymentProvider === 'cielo' ? 'Terminal Cielo Smart / pinpad' : 'Pinpad PPC930';

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cpu className="h-6 w-6" />
          Diagnóstico de Conexões
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!currentLaundry?.id && (
          <p className="text-sm text-muted-foreground">
            Associe uma lavanderia ao totem para carregar o provedor de pagamento e executar os testes.
          </p>
        )}
        <Button onClick={runAllTests} disabled={testing || !currentLaundry?.id} className="w-full">
          {testing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Testando...
            </>
          ) : (
            <>
              <Wifi className="h-4 w-4 mr-2" />
              Executar Diagnóstico
            </>
          )}
        </Button>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              <div className="flex flex-col">
                <span className="font-medium">{gatewayBrand}</span>
                <span className="text-xs text-muted-foreground">Integração de pagamento</span>
              </div>
            </div>
            <StatusIcon status={results.gateway} />
          </div>

          <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              <div className="flex flex-col">
                <span className="font-medium">{peripheralLabel}</span>
                <span className="text-xs text-muted-foreground">Detecção no dispositivo</span>
              </div>
            </div>
            <StatusIcon status={results.peripheral} />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">ESP32s:</p>
            {Object.entries(results.esp32s).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum ESP32 testado</p>
            ) : (
              Object.entries(results.esp32s).map(([id, status]) => (
                <div
                  key={id}
                  className="flex items-center justify-between p-2 bg-secondary/50 rounded-lg"
                >
                  <span className="text-sm">{id}</span>
                  <StatusIcon status={status} />
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
