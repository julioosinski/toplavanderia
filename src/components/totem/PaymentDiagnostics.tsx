import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wifi, CheckCircle2, XCircle, Loader2, CreditCard, Cpu } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CapacitorHttp } from '@capacitor/core';

export const PaymentDiagnostics = () => {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<{
    paygo: boolean | null;
    pinpad: boolean | null;
    esp32s: Record<string, boolean>;
  }>({
    paygo: null,
    pinpad: null,
    esp32s: {}
  });

  const testPayGO = async () => {
    try {
      const { data: settings } = await supabase
        .from('system_settings')
        .select('paygo_host, paygo_port, paygo_enabled')
        .single();

      if (!settings?.paygo_enabled) {
        return false;
      }

      const response = await CapacitorHttp.request({
        url: `http://${settings.paygo_host}:${settings.paygo_port}/status`,
        method: 'GET',
        connectTimeout: 5000,
        readTimeout: 5000
      });

      return response.status === 200;
    } catch (error) {
      console.error('Erro teste PayGO:', error);
      return false;
    }
  };

  const testPinpad = async () => {
    try {
      // @ts-ignore - PayGO plugin
      if (!window.PayGO) return false;

      // @ts-ignore
      const result = await window.PayGO.detectPinpad();
      return result.detected === true;
    } catch (error) {
      console.error('Erro teste Pinpad:', error);
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
            readTimeout: 3000
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
    setTesting(true);
    toast.info('Iniciando diagnóstico...');

    try {
      const [paygoResult, pinpadResult, esp32Results] = await Promise.all([
        testPayGO(),
        testPinpad(),
        testESP32s()
      ]);

      setResults({
        paygo: paygoResult,
        pinpad: pinpadResult,
        esp32s: esp32Results
      });

      const allPassed = paygoResult && pinpadResult && Object.values(esp32Results).every(r => r);
      
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

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cpu className="h-6 w-6" />
          Diagnóstico de Conexões
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={runAllTests}
          disabled={testing}
          className="w-full"
        >
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
              <span className="font-medium">PayGO</span>
            </div>
            <StatusIcon status={results.paygo} />
          </div>

          <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              <span className="font-medium">Pinpad PPC930</span>
            </div>
            <StatusIcon status={results.pinpad} />
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
