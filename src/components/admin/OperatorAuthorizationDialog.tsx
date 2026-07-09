import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { reaisToCentavos } from '@/lib/money';

const brl = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  laundryId: string;
}

const centsToReaisInput = (cents: number | null | undefined) =>
  cents == null ? '' : (cents / 100).toFixed(2).replace('.', ',');

export function OperatorAuthorizationDialog({
  open,
  onOpenChange,
  userId,
  userName,
  laundryId,
}: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [canRelease, setCanRelease] = useState(false);
  const [dailyLimit, setDailyLimit] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('operator_release_permissions')
        .select('can_release, daily_limit_cents, monthly_limit_cents')
        .eq('user_id', userId)
        .eq('laundry_id', laundryId)
        .maybeSingle();
      if (cancelled) return;
      if (error && error.code !== 'PGRST116') {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      }
      setCanRelease(Boolean(data?.can_release));
      setDailyLimit(centsToReaisInput(data?.daily_limit_cents));
      setMonthlyLimit(centsToReaisInput(data?.monthly_limit_cents));
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, userId, laundryId, toast]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const dailyCents = dailyLimit.trim() ? reaisToCentavos(dailyLimit) : null;
      const monthlyCents = monthlyLimit.trim() ? reaisToCentavos(monthlyLimit) : null;

      const { error } = await supabase
        .from('operator_release_permissions')
        .upsert(
          {
            user_id: userId,
            laundry_id: laundryId,
            can_release: canRelease,
            daily_limit_cents: dailyCents,
            monthly_limit_cents: monthlyCents,
            granted_by: userData?.user?.id ?? null,
          },
          { onConflict: 'user_id,laundry_id' },
        );
      if (error) throw error;
      toast({ title: 'Autorização salva', description: userName });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Falha ao salvar',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Autorização de liberação manual</DialogTitle>
          <DialogDescription>
            {userName} — defina se este operador pode liberar máquinas e os limites em reais.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm font-medium">Pode liberar máquinas</Label>
              <p className="text-xs text-muted-foreground">
                Quando desativado, o botão de liberar não aparece para este operador.
              </p>
            </div>
            <Switch checked={canRelease} onCheckedChange={setCanRelease} disabled={loading} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="daily-limit">Limite diário (R$)</Label>
            <Input
              id="daily-limit"
              inputMode="decimal"
              placeholder="Sem limite"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
              disabled={loading || !canRelease}
            />
            <p className="text-xs text-muted-foreground">Deixe vazio para não aplicar limite diário.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="monthly-limit">Limite mensal (R$)</Label>
            <Input
              id="monthly-limit"
              inputMode="decimal"
              placeholder="Sem limite"
              value={monthlyLimit}
              onChange={(e) => setMonthlyLimit(e.target.value)}
              disabled={loading || !canRelease}
            />
            <p className="text-xs text-muted-foreground">Deixe vazio para não aplicar limite mensal.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
