import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Receipt, Activity, CheckCircle, AlertTriangle, Droplets, Wind, CalendarRange } from "lucide-react";
import { useLaundry } from "@/hooks/useLaundry";
import { supabase } from "@/integrations/supabase/client";
import { computeMachineStatus, type Esp32StatusRow, type MachineRow } from "@/lib/machineEsp32Sync";
import { LaundryDashboardSelector } from "@/components/admin/LaundryDashboardSelector";
import { MachineStatusGrid } from "@/components/admin/MachineStatusGrid";
import { ConsolidatedMachineStatus } from "@/components/admin/ConsolidatedMachineStatus";
import { type Machine, useMachines } from "@/hooks/useMachines";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";


interface TransactionRow {
  created_at: string | null;
  total_amount: number | string | null;
}

interface MachineRevenueRow {
  total_revenue: number | string | null;
}

interface ConsolidatedMachineRow extends MachineRow {
  name: string;
  type?: string | null;
  price_per_cycle?: number | string | null;
  cycle_time_minutes?: number | null;
  relay_pin?: number | null;
  esp32_id?: string | null;
  location?: string | null;
}

type Esp32StatusWithLaundry = Esp32StatusRow & {
  laundry_id: string | null;
};

type MachinesByLaundry = Record<string, { laundryName: string; machines: Machine[] }>;

const toDashboardMachine = (
  row: ConsolidatedMachineRow,
  status: Machine["status"],
  esp32?: Esp32StatusRow
): Machine => {
  const type = row.type === "secadora" || row.type === "drying" ? "secadora" : "lavadora";

  return {
    id: row.id,
    name: row.name,
    type,
    title: row.name,
    price: Number(row.price_per_cycle) || 18,
    duration: row.cycle_time_minutes || 40,
    status,
    icon: type === "lavadora" ? Droplets : Wind,
    esp32_id: row.esp32_id || undefined,
    relay_pin: row.relay_pin || undefined,
    location: row.location || undefined,
    ip_address: esp32?.ip_address || undefined,
  };
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  onClick?: () => void;
}

const StatCard = ({ icon, label, value, hint, onClick }: StatCardProps) => (
  <Card
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
    onClick={onClick}
    onKeyDown={(e) => { if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); } }}
    className={cn(
      "transition-all",
      onClick && "cursor-pointer hover:shadow-md hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    )}
  >
    <CardContent className="p-4 sm:p-6">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm text-muted-foreground">{label}</p>
          <p className="text-xl sm:text-2xl font-bold leading-tight tabular-nums break-words">{value}</p>
          {hint && <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{hint}</p>}
        </div>
      </div>
    </CardContent>
  </Card>
);


type PresetKey = 'today' | '7d' | '30d' | 'month' | 'custom';

const PRESET_LABELS: Record<PresetKey, string> = {
  today: 'Hoje',
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  month: 'Mês atual',
  custom: 'Personalizado',
};

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };

function rangeFromPreset(preset: PresetKey, custom?: { from: Date; to: Date }): { from: Date; to: Date } {
  const now = new Date();
  if (preset === 'today') return { from: startOfDay(now), to: endOfDay(now) };
  if (preset === '7d') { const f = new Date(now); f.setDate(f.getDate() - 6); return { from: startOfDay(f), to: endOfDay(now) }; }
  if (preset === '30d') { const f = new Date(now); f.setDate(f.getDate() - 29); return { from: startOfDay(f), to: endOfDay(now) }; }
  if (preset === 'month') { const f = new Date(now.getFullYear(), now.getMonth(), 1); return { from: startOfDay(f), to: endOfDay(now) }; }
  return { from: startOfDay(custom?.from ?? now), to: endOfDay(custom?.to ?? now) };
}

const fmtBRL = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentLaundry, isSuperAdmin, laundries, isViewingAllLaundries } = useLaundry();
  const isViewingAll = isSuperAdmin && isViewingAllLaundries;
  const currentLaundryId = currentLaundry?.id;
  const laundryIdForMachines = isViewingAll ? undefined : currentLaundryId;
  const { machines, loading: machinesLoading, refreshMachines } = useMachines(laundryIdForMachines);

  // Period filter
  const [preset, setPreset] = useState<PresetKey>(() => {
    try { return (localStorage.getItem('dashboard:preset') as PresetKey) || 'month'; } catch { return 'month'; }
  });
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date }>(() => {
    try {
      const raw = localStorage.getItem('dashboard:customRange');
      if (raw) { const p = JSON.parse(raw); return { from: new Date(p.from), to: new Date(p.to) }; }
    } catch { /* noop */ }
    const now = new Date();
    return { from: startOfDay(now), to: endOfDay(now) };
  });
  const dateRange = useMemo(() => rangeFromPreset(preset, customRange), [preset, customRange]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftPreset, setDraftPreset] = useState<PresetKey>(preset);
  const [draftRange, setDraftRange] = useState<{ from?: Date; to?: Date }>(customRange);

  // Period stats
  const [periodStats, setPeriodStats] = useState({ periodRevenue: 0, monthlyRevenue: 0, periodTransactions: 0 });
  const [revenueLoading, setRevenueLoading] = useState(true);
  const initialLoadDone = useRef(false);

  const [machinesByLaundry, setMachinesByLaundry] = useState<MachinesByLaundry>({});

  const machineStats = useMemo(() => ({
    totalMachines: machines.length,
    activeMachines: machines.filter(m => m.status === 'available').length,
    offlineMachines: machines.filter(m => m.status === 'offline').length,
    maintenanceMachines: machines.filter(m => m.status === 'maintenance').length,
  }), [machines]);

  const loadRevenueData = useCallback(async () => {
    if (!currentLaundryId && !isViewingAll) return;
    try {
      if (!initialLoadDone.current) setRevenueLoading(true);

      const fromISO = dateRange.from.toISOString();
      const toISO = dateRange.to.toISOString();

      const periodQuery = supabase
        .from('transactions')
        .select('total_amount, created_at, status')
        .eq('status', 'completed')
        .gte('created_at', fromISO)
        .lte('created_at', toISO);
      if (!isViewingAll && currentLaundryId) periodQuery.eq('laundry_id', currentLaundryId);

      // Monthly revenue (current calendar month, always) — somente concluídas
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const monthlyQuery = supabase
        .from('transactions')
        .select('total_amount')
        .eq('status', 'completed')
        .gte('created_at', monthStart);
      if (!isViewingAll && currentLaundryId) monthlyQuery.eq('laundry_id', currentLaundryId);

      const [{ data: periodData }, { data: monthlyData }] = await Promise.all([periodQuery, monthlyQuery]);
      const periodTx = (periodData || []) as TransactionRow[];
      const monthlyTx = (monthlyData || []) as TransactionRow[];

      const periodRevenue = periodTx.reduce((s, t) => s + (Number(t.total_amount) || 0), 0);
      const monthlyRevenue = monthlyTx.reduce((s, t) => s + (Number(t.total_amount) || 0), 0);

      setPeriodStats({ periodRevenue, monthlyRevenue, periodTransactions: periodTx.length });
      initialLoadDone.current = true;
    } catch (error) {
      console.error("Erro ao carregar dados de receita:", error);
    } finally {
      setRevenueLoading(false);
    }
  }, [currentLaundryId, isViewingAll, dateRange.from, dateRange.to]);


  const loadConsolidatedMachines = useCallback(async () => {
    if (!isViewingAll) return;
    const groupedMachines: MachinesByLaundry = {};

    // Fetch all ESP32 status once
    const { data: allEsp32 } = await supabase
      .from('esp32_status')
      .select('esp32_id, ip_address, is_online, relay_status, last_heartbeat, signal_strength, network_status, laundry_id');
    const esp32ByLaundry = new Map<string, Esp32StatusRow[]>();
    ((allEsp32 || []) as Esp32StatusWithLaundry[]).forEach((e) => {
      if (!e.laundry_id) return;
      const arr = esp32ByLaundry.get(e.laundry_id) || [];
      arr.push(e);
      esp32ByLaundry.set(e.laundry_id, arr);
    });

    // Paraleliza a leitura das máquinas por lavanderia
    const results = await Promise.all(
      laundries.map(async (laundry) => {
        const { data: laundryMachines } = await supabase
          .from('machines').select('*').eq('laundry_id', laundry.id);
        if (!laundryMachines || laundryMachines.length === 0) return null;
        const esp32List = esp32ByLaundry.get(laundry.id) || [];
        const esp32Map = new Map(esp32List.map(e => [e.esp32_id, e]));
        const enriched = (laundryMachines as ConsolidatedMachineRow[]).map((m) => {
          const esp32 = esp32Map.get(m.esp32_id || '');
          const computed = computeMachineStatus(m, esp32);
          return toDashboardMachine(m, computed.status, esp32);
        });
        return { laundryId: laundry.id, laundryName: laundry.name, machines: enriched };
      })
    );
    results.forEach((r) => {
      if (r) groupedMachines[r.laundryId] = { laundryName: r.laundryName, machines: r.machines };
    });
    setMachinesByLaundry(groupedMachines);
  }, [isViewingAll, laundries]);

  useEffect(() => {
    void loadRevenueData();
    void loadConsolidatedMachines();
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void loadRevenueData();
      void loadConsolidatedMachines();
    }, 15000);

    // Realtime para visão consolidada (todas lavanderias) — atualiza sem esperar o ciclo de 15s
    let machinesCh: ReturnType<typeof supabase.channel> | null = null;
    let esp32Ch: ReturnType<typeof supabase.channel> | null = null;
    if (isViewingAll) {
      machinesCh = supabase
        .channel('dashboard-consolidated-machines')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'machines' }, () => {
          void loadConsolidatedMachines();
        })
        .subscribe();
      esp32Ch = supabase
        .channel('dashboard-consolidated-esp32')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'esp32_status' }, () => {
          void loadConsolidatedMachines();
        })
        .subscribe();
    }

    return () => {
      clearInterval(interval);
      if (machinesCh) supabase.removeChannel(machinesCh);
      if (esp32Ch) supabase.removeChannel(esp32Ch);
    };
  }, [isViewingAll, loadConsolidatedMachines, loadRevenueData]);


  if (revenueLoading && !initialLoadDone.current) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-muted rounded" />)}
        </div>
      </div>
    );
  }

  const hasAlerts = machineStats.offlineMachines > 0 || machineStats.maintenanceMachines > 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral da lavanderia</p>
        </div>
        <LaundryDashboardSelector />
      </div>

      {hasAlerts && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-amber-600 flex-shrink-0" size={20} />
              <div className="flex flex-wrap gap-2">
                {machineStats.offlineMachines > 0 && (
                  <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50">
                    {machineStats.offlineMachines} máquina{machineStats.offlineMachines > 1 ? 's' : ''} offline
                  </Badge>
                )}
                {machineStats.maintenanceMachines > 0 && (
                  <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
                    {machineStats.maintenanceMachines} em manutenção
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Period chip + selector */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => { setDraftPreset(preset); setDraftRange(customRange); setDialogOpen(true); }}
        >
          <CalendarRange size={16} />
          <span className="font-medium">{PRESET_LABELS[preset]}:</span>
          <span className="text-muted-foreground">
            {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} – {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
          </span>
        </Button>
      </div>

      {/* Stats Cards — clicáveis, valores sem corte */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<DollarSign className="text-primary" size={20} />}
          label="Receita do Período"
          value={fmtBRL(periodStats.periodRevenue)}
          onClick={() => { setDraftPreset(preset); setDraftRange(customRange); setDialogOpen(true); }}
        />
        <StatCard
          icon={<Receipt className="text-primary" size={20} />}
          label="Receita Mensal"
          value={fmtBRL(periodStats.monthlyRevenue)}
          hint="Mês corrente"
          onClick={() => { setDraftPreset(preset); setDraftRange(customRange); setDialogOpen(true); }}
        />
        <StatCard
          icon={<Activity className="text-primary" size={20} />}
          label="Transações do Período"
          value={String(periodStats.periodTransactions)}
          onClick={() => { setDraftPreset(preset); setDraftRange(customRange); setDialogOpen(true); }}
        />
        <StatCard
          icon={<CheckCircle className="text-primary" size={20} />}
          label="Disponíveis"
          value={`${machineStats.activeMachines} / ${machineStats.totalMachines}`}
          hint="Tempo real"
          onClick={() => navigate('/admin/machines')}
        />
      </div>

      {/* Period dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Período exibido</DialogTitle>
            <DialogDescription>Escolha o intervalo dos valores do dashboard.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(['today','7d','30d','month','custom'] as PresetKey[]).map(k => (
                <Button
                  key={k}
                  variant={draftPreset === k ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDraftPreset(k)}
                >
                  {PRESET_LABELS[k]}
                </Button>
              ))}
            </div>
            {draftPreset === 'custom' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">De</p>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        {draftRange.from ? format(draftRange.from, "dd/MM/yyyy", { locale: ptBR }) : 'Selecionar'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={draftRange.from} onSelect={(d) => setDraftRange(r => ({ ...r, from: d }))} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Até</p>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        {draftRange.to ? format(draftRange.to, "dd/MM/yyyy", { locale: ptBR }) : 'Selecionar'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={draftRange.to} onSelect={(d) => setDraftRange(r => ({ ...r, to: d }))} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (draftPreset === 'custom' && (!draftRange.from || !draftRange.to)) return;
                setPreset(draftPreset);
                if (draftPreset === 'custom' && draftRange.from && draftRange.to) {
                  const r = { from: draftRange.from, to: draftRange.to };
                  setCustomRange(r);
                  try { localStorage.setItem('dashboard:customRange', JSON.stringify({ from: r.from.toISOString(), to: r.to.toISOString() })); } catch { /* noop */ }
                }
                try { localStorage.setItem('dashboard:preset', draftPreset); } catch { /* noop */ }
                setDialogOpen(false);
              }}
            >
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Machine Status Section */}
      {isViewingAll ? (
        <ConsolidatedMachineStatus
          machinesByLaundry={machinesByLaundry}
          loading={machinesLoading}
          onAfterMachineAction={() => { void loadConsolidatedMachines(); }}
        />
      ) : (
        <MachineStatusGrid
          machines={machines}
          loading={machinesLoading}
          onAfterMachineAction={() => { void refreshMachines({ background: true }); }}
        />
      )}
    </div>
  );
}
