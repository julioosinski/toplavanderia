import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Armchair, Copy, CheckCircle, Download, Zap, Cpu } from 'lucide-react';
import { buildEsp32PoltronaFirmware, downloadEsp32DeviceFirmware } from '@/lib/esp32FirmwareDownload';
import { adminRemoteRelease } from '@/lib/deviceRemoteRelease';

interface MassageMachine {
  id: string;
  name: string;
  esp32_id: string | null;
  cycle_time_minutes: number | null;
  price_per_cycle: number;
  status: string | null;
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Erro desconhecido';

export default function MassageChairConfig() {
  const { currentLaundry } = useLaundry();
  const { toast } = useToast();
  const [machines, setMachines] = useState<MassageMachine[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [machineName, setMachineName] = useState('');
  const [cycleMinutes, setCycleMinutes] = useState(15);
  const [showPreview, setShowPreview] = useState(false);
  const [copiedLaundryId, setCopiedLaundryId] = useState(false);
  const [downloading, setDownloading] = useState(false);

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
        .select('id, name, esp32_id, cycle_time_minutes, price_per_cycle, status')
        .eq('laundry_id', currentLaundry.id)
        .eq('type', 'massage')
        .order('name');

      if (error) throw error;
      setMachines((data as MassageMachine[]) ?? []);
    } catch (error) {
      toast({
        title: 'Erro ao carregar poltronas',
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
    setCycleMinutes(selectedMachine.cycle_time_minutes ?? 15);
  }, [selectedMachine]);

  useEffect(() => {
    if (machines.length === 1 && !selectedMachineId) {
      setSelectedMachineId(machines[0].id);
    }
  }, [machines, selectedMachineId]);

  const generateFirmware = () => {
    if (!laundryId) {
      toast({
        title: 'Lavanderia não selecionada',
        variant: 'destructive',
      });
      return '';
    }

    const name =
      machineName.trim() ||
      selectedMachine?.name ||
      `${currentLaundry?.name ?? 'Lavanderia'} — Poltrona`;

    return buildEsp32PoltronaFirmware({
      laundryId,
      machineName: name,
      defaultCycleMinutes: cycleMinutes,
    });
  };

  const handleDownload = () => {
    const code = generateFirmware();
    if (!code) return;

    setDownloading(true);
    const safeName = (machineName.trim() || 'Poltrona').replace(/\s+/g, '_');
    downloadEsp32DeviceFirmware(code, `ESP32_Poltrona_${safeName}.ino`);

    toast({
      title: 'Firmware gerado!',
      description:
        'Firmware baixado (.ino autocontido + .h de backup). Compile (Huge APP 3MB), grave e configure Wi-Fi em TopLavanderia-{ESP32_ID}.',
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

  const handleRemoteRelease = async (machine: MassageMachine) => {
    if (
      !confirm(
        `Liberar sessão de massagem remotamente em "${machine.name}" (relé ON pelo tempo do ciclo)?`
      )
    ) {
      return;
    }

    const { error } = await adminRemoteRelease({ machineId: machine.id });
    if (error) {
      toast({
        title: 'Falha na liberação',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: 'Sessão enfileirada',
      description: 'O ESP32 executará em até alguns segundos.',
    });
  };

  return (
    <LaundryGuard>
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Armchair className="h-6 w-6" />
            Poltrona de Massagem
          </h1>
          <p className="text-muted-foreground">
            Gere o firmware ESP32, vincule o equipamento e libere sessões remotamente.
          </p>
        </div>

        {machines.length === 0 && !loading && (
          <Card>
            <CardHeader>
              <CardTitle>Cadastre uma poltrona</CardTitle>
              <CardDescription>
                Em Máquinas, crie um equipamento do tipo &quot;Poltrona de massagem&quot; antes de
                gerar o firmware.
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
              Template Top Lavanderia: poll via esp32-monitor, relé GPIO 26, DFPlayer (001–007.mp3),
              resfriamento 30s ao fim. ID do ESP32 gerado automaticamente pelo MAC.
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
                <Label>Poltrona vinculada (opcional)</Label>
                <Select value={selectedMachineId} onValueChange={setSelectedMachineId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione para preencher nome e tempo" />
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="poltrona-name">Nome no heartbeat</Label>
                <Input
                  id="poltrona-name"
                  value={machineName}
                  onChange={(e) => setMachineName(e.target.value)}
                  placeholder="Poltrona de Massagem"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="poltrona-cycle">Tempo padrão da sessão (min)</Label>
                <Input
                  id="poltrona-cycle"
                  type="number"
                  min={1}
                  max={1440}
                  value={cycleMinutes}
                  onChange={(e) =>
                    setCycleMinutes(Math.max(1, Math.min(1440, Number(e.target.value) || 15)))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Igual ao cycle_time_minutes da máquina no cadastro.
                </p>
              </div>
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
                  <strong>toplav123</strong> — acesse <code>/wifi</code>
                </li>
                <li>Atualizações futuras via OTA em Configurações → Atualização OTA (Wi-Fi)</li>
                <li>Anote o <strong>esp32_id</strong> no Serial Monitor e cadastre na máquina em Máquinas</li>
                <li>Aprove o ESP em Pendentes de Aprovação (se auto-registro estiver ativo)</li>
                <li>SD FAT32 na raiz: 001.mp3 … 007.mp3</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Poltronas cadastradas ({machines.length})</CardTitle>
            <CardDescription>
              Lavanderia: {currentLaundry?.name ?? '—'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Carregando…</p>
            ) : machines.length === 0 ? (
              <p className="text-muted-foreground">Nenhuma poltrona cadastrada.</p>
            ) : (
              <div className="space-y-3">
                {machines.map((machine) => (
                  <div
                    key={machine.id}
                    className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{machine.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {machine.cycle_time_minutes ?? 15} min · R${' '}
                        {Number(machine.price_per_cycle).toFixed(2)} ·{' '}
                        {machine.esp32_id ? (
                          <span className="font-mono">{machine.esp32_id}</span>
                        ) : (
                          'sem ESP32 vinculado'
                        )}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!machine.esp32_id}
                      onClick={() => handleRemoteRelease(machine)}
                    >
                      <Zap className="mr-1 h-4 w-4" />
                      Liberar remoto
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </LaundryGuard>
  );
}
