import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLaundry } from '@/hooks/useLaundry';
import { supabase } from '@/integrations/supabase/client';
import { LaundryGuard } from '@/components/admin/LaundryGuard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
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
  metadata?: Record<string, unknown> | null;
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Erro desconhecido';

const DEFAULT_AUDIO_VOLUMES = {
  volume_audio_001: 27,
  volume_audio_002: 27,
  volume_audio_003: 27,
  volume_audio_004: 27,
  volume_audio_005: 27,
  volume_audio_006: 27,
  volume_audio_007: 18,
} as const;

type AudioVolumeKey = keyof typeof DEFAULT_AUDIO_VOLUMES;
type AudioVolumeState = Record<AudioVolumeKey, number>;

export default function MassageChairConfig() {
  const { currentLaundry } = useLaundry();
  const { toast } = useToast();
  const [machines, setMachines] = useState<MassageMachine[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [machineName, setMachineName] = useState('');
  const [cycleMinutes, setCycleMinutes] = useState(15);
  const [pricePerCycle, setPricePerCycle] = useState('15.00');
  const [audioVolumes, setAudioVolumes] = useState<AudioVolumeState>(DEFAULT_AUDIO_VOLUMES);
  const [showPreview, setShowPreview] = useState(false);
  const [copiedLaundryId, setCopiedLaundryId] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [savingMachineConfig, setSavingMachineConfig] = useState(false);

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
        .select('id, name, esp32_id, cycle_time_minutes, price_per_cycle, status, metadata')
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
    setPricePerCycle(Number(selectedMachine.price_per_cycle || 0).toFixed(2));

    const metadata = selectedMachine.metadata ?? {};
    const nextVolumes: AudioVolumeState = { ...DEFAULT_AUDIO_VOLUMES };
    (Object.keys(DEFAULT_AUDIO_VOLUMES) as AudioVolumeKey[]).forEach((key) => {
      const raw = metadata[key];
      const parsed = typeof raw === 'number' ? raw : Number(raw);
      if (Number.isFinite(parsed)) {
        nextVolumes[key] = Math.max(0, Math.min(30, Math.round(parsed)));
      }
    });
    setAudioVolumes(nextVolumes);
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
      audioVolumes,
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
        'Baixado (.ino + .h). Arduino IDE: partition Minimal SPIFFS (1.9MB APP with OTA), grave via USB e configure Wi-Fi em TopLavanderia-{ESP32_ID}.',
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

  const handleSaveMachineConfig = async () => {
    if (!selectedMachine) {
      toast({
        title: 'Selecione uma poltrona',
        description: 'Escolha uma poltrona para salvar os parâmetros.',
        variant: 'destructive',
      });
      return;
    }

    const parsedPrice = Number(pricePerCycle.replace(',', '.'));
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'Informe um valor válido maior que zero.',
        variant: 'destructive',
      });
      return;
    }
    if (!Number.isFinite(cycleMinutes) || cycleMinutes <= 0) {
      toast({
        title: 'Tempo inválido',
        description: 'Informe um tempo de uso maior que zero.',
        variant: 'destructive',
      });
      return;
    }

    setSavingMachineConfig(true);
    try {
      const mergedMetadata: Record<string, unknown> = {
        ...(selectedMachine.metadata ?? {}),
        ...audioVolumes,
      };
      const { error } = await supabase
        .from('machines')
        .update({
          name: machineName.trim() || selectedMachine.name,
          cycle_time_minutes: cycleMinutes,
          price_per_cycle: Number(parsedPrice.toFixed(2)),
          metadata: mergedMetadata as never,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedMachine.id);

      if (error) throw error;
      toast({
        title: 'Configurações salvas',
        description: 'Valor, tempo e volumes foram atualizados para esta poltrona.',
      });
      await loadMachines();
    } catch (error) {
      toast({
        title: 'Erro ao salvar configurações',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setSavingMachineConfig(false);
    }
  };

  const handleResetAudioVolumes = () => {
    setAudioVolumes(DEFAULT_AUDIO_VOLUMES);
    toast({
      title: 'Volumes restaurados',
      description: 'Os volumes voltaram para o padrão recomendado.',
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

            <div className="space-y-2">
              <Label htmlFor="poltrona-price">Valor da sessão (R$)</Label>
              <Input
                id="poltrona-price"
                type="number"
                min={0.01}
                step={0.01}
                value={pricePerCycle}
                onChange={(e) => setPricePerCycle(e.target.value)}
                placeholder="15.00"
              />
              <p className="text-xs text-muted-foreground">
                Esse valor aparece na maquininha no momento da confirmação do pagamento.
              </p>
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <div>
                <h3 className="font-medium">Controle de volume dos áudios</h3>
                <p className="text-xs text-muted-foreground">
                  Ajuste de 0 a 30 (DFPlayer). Salve para manter os valores da poltrona.
                </p>
              </div>

              <div className="space-y-4">
                {(Object.keys(DEFAULT_AUDIO_VOLUMES) as AudioVolumeKey[]).map((key) => {
                  const label = key.replace('volume_audio_', 'Áudio ');
                  const value = audioVolumes[key];
                  return (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>{label}</Label>
                        <span className="text-xs font-mono">
                          {value} ({Math.round((value / 30) * 100)}%)
                        </span>
                      </div>
                      <Slider
                        min={0}
                        max={30}
                        step={1}
                        value={[value]}
                        onValueChange={(next) =>
                          setAudioVolumes((prev) => ({ ...prev, [key]: next[0] ?? prev[key] }))
                        }
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={handleResetAudioVolumes}>
                  Restaurar volumes padrão
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleSaveMachineConfig()}
                  disabled={!selectedMachineId || savingMachineConfig}
                >
                  {savingMachineConfig ? 'Salvando...' : 'Salvar configuração da poltrona'}
                </Button>
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

            <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4 text-xs text-blue-800 dark:text-blue-300 space-y-2">
              <p className="font-semibold text-sm">Arduino IDE — 1ª gravação (USB, obrigatória para OTA)</p>
              <ul className="list-disc ml-4 space-y-1">
                <li>
                  Placa: <strong>ESP32 Dev Module</strong>
                </li>
                <li>
                  Partition Scheme:{' '}
                  <strong>Minimal SPIFFS (1.9MB APP with OTA/190KB SPIFFS)</strong>
                </li>
                <li>
                  <strong>Não use</strong> Huge APP (3MB <em>No OTA</em>) — compila, mas OTA remoto falha com
                  &quot;Partition Could Not be Found&quot;
                </li>
                <li>
                  Grave com <strong>Upload</strong> (não só Export Binary). Use a mesma partition em todas as
                  compilações futuras (USB e OTA).
                </li>
              </ul>
            </div>

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
                <li>
                  OTA: exporte só <code>nome.ino.bin</code> (~1–1,2 MB) em Configurações → Atualização OTA — nunca{' '}
                  <code>merged</code>, <code>bootloader</code> ou <code>partitions</code>
                </li>
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
