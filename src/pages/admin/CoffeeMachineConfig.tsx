import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLaundry } from '@/hooks/useLaundry';
import { supabase } from '@/integrations/supabase/client';
import { LaundryGuard } from '@/components/admin/LaundryGuard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Coffee, Copy, CheckCircle, Download, Zap, Cpu, ExternalLink } from 'lucide-react';
import { buildEsp32CafeFirmware, downloadEsp32DeviceFirmware } from '@/lib/esp32FirmwareDownload';
import { adminRemoteRelease } from '@/lib/deviceRemoteRelease';
import { reaisToCentavos } from '@/lib/money';

interface CoffeeMachine {
  id: string;
  name: string;
  esp32_id: string | null;
  price_per_cycle: number;
  status: string | null;
}

interface CoffeeProductOption {
  id: string;
  machine_id: string;
  name: string;
  price: number;
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Erro desconhecido';

export default function CoffeeMachineConfig() {
  const { currentLaundry } = useLaundry();
  const { toast } = useToast();
  const [machines, setMachines] = useState<CoffeeMachine[]>([]);
  const [products, setProducts] = useState<CoffeeProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [machineName, setMachineName] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [copiedLaundryId, setCopiedLaundryId] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [customReleaseValues, setCustomReleaseValues] = useState<Record<string, string>>({});

  const laundryId = currentLaundry?.id ?? '';

  const selectedMachine = useMemo(
    () => machines.find((m) => m.id === selectedMachineId) ?? null,
    [machines, selectedMachineId]
  );

  const loadMachines = useCallback(async () => {
    if (!currentLaundry?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('machines')
        .select('id, name, esp32_id, price_per_cycle, status')
        .eq('laundry_id', currentLaundry.id)
        .eq('type', 'coffee')
        .order('name');

      if (error) throw error;
      setMachines((data as CoffeeMachine[]) ?? []);

      const { data: productsData, error: productsError } = await supabase
        .from('coffee_products')
        .select('id, machine_id, name, price')
        .eq('laundry_id', currentLaundry.id)
        .eq('is_active', true)
        .order('sort_order');

      if (productsError) throw productsError;
      setProducts((productsData as CoffeeProductOption[]) ?? []);
    } catch (error) {
      toast({
        title: 'Erro ao carregar máquinas de café',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [currentLaundry?.id, toast]);

  useEffect(() => {
    loadMachines();
  }, [loadMachines]);

  useEffect(() => {
    if (!selectedMachine) return;
    setMachineName(selectedMachine.name);
  }, [selectedMachine]);

  useEffect(() => {
    if (machines.length === 1 && !selectedMachineId) {
      setSelectedMachineId(machines[0].id);
    }
  }, [machines, selectedMachineId]);

  const generateFirmware = () => {
    if (!laundryId) {
      toast({ title: 'Lavanderia não selecionada', variant: 'destructive' });
      return '';
    }

    const name =
      machineName.trim() ||
      selectedMachine?.name ||
      `${currentLaundry?.name ?? 'Lavanderia'} — Café`;

    return buildEsp32CafeFirmware({ laundryId, machineName: name });
  };

  const handleDownload = () => {
    const code = generateFirmware();
    if (!code) return;

    setDownloading(true);
    const safeName = (machineName.trim() || 'Cafe').replace(/\s+/g, '_');
    downloadEsp32DeviceFirmware(code, `ESP32_Cafe_${safeName}.ino`);

    toast({
      title: 'Firmware gerado!',
      description:
        'Firmware baixado (.ino autocontido + .h de backup). Grave no ESP32 e configure Wi-Fi em TopLavanderia-{ESP32_ID} / toplav123. OTA remoto em Configurações.',
    });
    setDownloading(false);
  };

  const handleCopyLaundryId = () => {
    if (!laundryId) return;
    navigator.clipboard.writeText(laundryId);
    setCopiedLaundryId(true);
    setTimeout(() => setCopiedLaundryId(false), 2000);
    toast({ title: 'LAUNDRY_ID copiado' });
  };

  const handleRemoteRelease = async (
    machine: CoffeeMachine,
    options?: { product?: CoffeeProductOption; valorReais?: string },
  ) => {
    const product = options?.product;
    const valorReais = options?.valorReais?.trim();

    if (product) {
      if (
        !confirm(
          `Liberar "${product.name}" em "${machine.name}" (R$ ${Number(product.price).toFixed(2)})?`,
        )
      ) {
        return;
      }

      const { error } = await adminRemoteRelease({
        machineId: machine.id,
        productId: product.id,
      });
      if (error) {
        toast({
          title: 'Falha na liberação',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Crédito enfileirado',
        description: `R$ ${Number(product.price).toFixed(2)} — ESP32 executará em alguns segundos.`,
      });
      return;
    }

    const valorCentavos = reaisToCentavos(valorReais);
    if (valorCentavos <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'Informe um valor em reais (ex.: 8,50).',
        variant: 'destructive',
      });
      return;
    }

    if (
      !confirm(
        `Liberar crédito de R$ ${(valorCentavos / 100).toFixed(2)} em "${machine.name}"?`,
      )
    ) {
      return;
    }

    const { error } = await adminRemoteRelease({
      machineId: machine.id,
      valorCentavos,
    });
    if (error) {
      toast({
        title: 'Falha na liberação',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: 'Crédito enfileirado',
      description: `R$ ${(valorCentavos / 100).toFixed(2)} — ESP32 executará pulsos no moedeiro.`,
    });
  };

  return (
    <LaundryGuard>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Coffee className="h-6 w-6" />
              Máquina de Café — Firmware
            </h1>
            <p className="text-muted-foreground">
              Gere o firmware ESP32 para pulsos no moedeiro e vincule ao totem.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/admin/coffee-menu">
              <ExternalLink className="mr-2 h-4 w-4" />
              Cardápio de produtos
            </Link>
          </Button>
        </div>

        {machines.length === 0 && !loading && (
          <Card>
            <CardHeader>
              <CardTitle>Cadastre uma máquina de café</CardTitle>
              <CardDescription>
                Em Máquinas, crie um equipamento do tipo &quot;Café&quot; antes de gerar o firmware.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" />
              Gerar firmware ESP32
            </CardTitle>
            <CardDescription>
              Perfil coin_dispense: comando <code>credito</code> via esp32-monitor. Pulsos MOSFET —
              GPIO 19 (R$1), GPIO 2 (R$0,50), GPIO 23 (R$0,10). GPIO 4 (R$0,25) reservado, não usado.
              Pulso 100 ms · intervalo 300 ms.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-2">
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground">Lavanderia:</span>
                <span className="font-medium">{currentLaundry?.name}</span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">LAUNDRY_ID:</span>
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleCopyLaundryId}>
                    {copiedLaundryId ? (
                      <CheckCircle className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <code className="block text-xs font-mono bg-background p-2 rounded border break-all">
                  {laundryId || '—'}
                </code>
              </div>
            </div>

            {machines.length > 0 && (
              <div className="space-y-2">
                <Label>Máquina vinculada (opcional)</Label>
                <Select value={selectedMachineId} onValueChange={setSelectedMachineId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione para preencher o nome" />
                  </SelectTrigger>
                  <SelectContent>
                    {machines.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                        {m.esp32_id ? ` · ${m.esp32_id}` : ' · sem ESP32'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="cafe-name">Nome no heartbeat</Label>
              <Input
                id="cafe-name"
                value={machineName}
                onChange={(e) => setMachineName(e.target.value)}
                placeholder="Máquina de Café"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => setShowPreview(!showPreview)}
                disabled={!laundryId}
              >
                {showPreview ? 'Ocultar preview' : 'Ver preview'}
              </Button>
              <Button onClick={handleDownload} disabled={!laundryId || downloading} className="gap-2">
                <Download className="h-4 w-4" />
                Baixar firmware (.ino + .h)
              </Button>
            </div>

            {showPreview && laundryId && (
              <pre className="text-xs overflow-auto p-3 bg-muted/30 rounded border max-h-64">
                {generateFirmware().substring(0, 1500)}…
              </pre>
            )}

            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 text-xs text-amber-700 dark:text-amber-400 space-y-1">
              <p className="font-semibold text-sm">Após gravar o firmware:</p>
              <ul className="list-disc ml-4 space-y-1">
                <li>
                  O .ino baixado já inclui Wi-Fi/OTA embutido; se usar sketch antigo, coloque{' '}
                  <strong>esp32_wifi_ota_common.h</strong> na mesma pasta do .ino
                </li>
                <li>
                  Portal Wi-Fi: rede <strong>TopLavanderia-{'{ESP32_ID}'}</strong>, senha{' '}
                  <strong>toplav123</strong> — acesse <code>/wifi</code> no IP do AP
                </li>
                <li>
                  No Serial Monitor (115200), confirme <strong>ESP32_ID</strong> único (ex.:{' '}
                  <code>esp32_820c8834</code>) — se aparecer <code>esp32_03000000</code>, regrave o firmware
                  v1.1.0+
                </li>
                <li>Atualizações futuras via OTA em Configurações → Atualização OTA (Wi-Fi)</li>
                <li>Anote o <strong>esp32_id</strong> no Serial Monitor (115200 baud) e cadastre na máquina em Máquinas</li>
                <li>Aprove o ESP em Pendentes de Aprovação (auto-registro via heartbeat)</li>
                <li>Produtos e preços do totem ficam em Cardápio Café</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Máquinas de café ({machines.length})</CardTitle>
            <CardDescription>Lavanderia: {currentLaundry?.name ?? '—'}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Carregando…</p>
            ) : machines.length === 0 ? (
              <p className="text-muted-foreground">Nenhuma máquina cadastrada.</p>
            ) : (
              <div className="space-y-3">
                {machines.map((machine) => {
                  const machineProducts = products.filter((p) => p.machine_id === machine.id);

                  return (
                  <div
                    key={machine.id}
                    className="flex flex-col gap-3 rounded-lg border p-4"
                  >
                    <div>
                      <p className="font-medium">{machine.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {machine.esp32_id ? (
                          <span className="font-mono">{machine.esp32_id}</span>
                        ) : (
                          'sem ESP32 vinculado'
                        )}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:items-start">
                      {machineProducts.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {machineProducts.map((product) => (
                            <Button
                              key={product.id}
                              size="sm"
                              variant="secondary"
                              disabled={!machine.esp32_id}
                              onClick={() => void handleRemoteRelease(machine, { product })}
                            >
                              <Zap className="mr-1 h-4 w-4" />
                              {product.name} · R$ {Number(product.price).toFixed(2)}
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Cadastre produtos em Cardápio Café para liberar pelo preço correto.
                        </p>
                      )}

                      <div className="flex flex-wrap gap-2 items-center">
                        <Input
                          className="max-w-[140px]"
                          type="text"
                          inputMode="decimal"
                          placeholder="Outro valor R$"
                          value={customReleaseValues[machine.id] ?? ''}
                          onChange={(e) =>
                            setCustomReleaseValues((prev) => ({
                              ...prev,
                              [machine.id]: e.target.value,
                            }))
                          }
                          disabled={!machine.esp32_id}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!machine.esp32_id || !customReleaseValues[machine.id]?.trim()}
                          onClick={() =>
                            void handleRemoteRelease(machine, {
                              valorReais: customReleaseValues[machine.id],
                            })
                          }
                        >
                          Liberar valor
                        </Button>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </LaundryGuard>
  );
}
