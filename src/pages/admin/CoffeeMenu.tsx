import { useCallback, useEffect, useState } from 'react';
import { useLaundry } from '@/hooks/useLaundry';
import { supabase } from '@/integrations/supabase/client';
import { LaundryGuard } from '@/components/admin/LaundryGuard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Coffee, Zap } from 'lucide-react';
import { adminRemoteRelease } from '@/lib/deviceRemoteRelease';

interface CoffeeProduct {
  id: string;
  name: string;
  price: number;
  sort_order: number;
  is_active: boolean;
  machine_id: string;
}

interface CoffeeMachine {
  id: string;
  name: string;
  esp32_id: string | null;
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Erro desconhecido';

export default function CoffeeMenu() {
  const { currentLaundry } = useLaundry();
  const { toast } = useToast();
  const [products, setProducts] = useState<CoffeeProduct[]>([]);
  const [coffeeMachines, setCoffeeMachines] = useState<CoffeeMachine[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CoffeeProduct | null>(null);
  const [form, setForm] = useState({
    name: '',
    price: '6.00',
    sort_order: '1',
    is_active: true,
    machine_id: '',
  });

  const loadData = useCallback(async () => {
    if (!currentLaundry?.id) return;
    setLoading(true);
    try {
      const [{ data: prodData, error: prodErr }, { data: machData, error: machErr }] =
        await Promise.all([
          supabase
            .from('coffee_products')
            .select('id, name, price, sort_order, is_active, machine_id')
            .eq('laundry_id', currentLaundry.id)
            .order('sort_order', { ascending: true }),
          supabase
            .from('machines')
            .select('id, name, esp32_id')
            .eq('laundry_id', currentLaundry.id)
            .eq('type', 'coffee'),
        ]);

      if (prodErr) throw prodErr;
      if (machErr) throw machErr;

      setProducts((prodData as CoffeeProduct[]) ?? []);
      setCoffeeMachines((machData as CoffeeMachine[]) ?? []);
    } catch (error) {
      toast({
        title: 'Erro ao carregar cardápio',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [currentLaundry?.id, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      price: '6.00',
      sort_order: String((products.length || 0) + 1),
      is_active: true,
      machine_id: coffeeMachines[0]?.id ?? '',
    });
    setDialogOpen(true);
  };

  const openEdit = (product: CoffeeProduct) => {
    setEditing(product);
    setForm({
      name: product.name,
      price: Number(product.price).toFixed(2),
      sort_order: String(product.sort_order),
      is_active: product.is_active,
      machine_id: product.machine_id,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!currentLaundry?.id) return;
    const price = Number(form.price.replace(',', '.'));
    if (!form.name.trim() || !form.machine_id || !Number.isFinite(price) || price <= 0) {
      toast({ title: 'Preencha nome, máquina e preço válido', variant: 'destructive' });
      return;
    }

    const payload = {
      laundry_id: currentLaundry.id,
      machine_id: form.machine_id,
      name: form.name.trim(),
      price,
      sort_order: Number(form.sort_order) || 0,
      is_active: form.is_active,
    };

    try {
      if (editing) {
        const { error } = await supabase
          .from('coffee_products')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editing.id);
        if (error) throw error;
        toast({ title: 'Produto atualizado' });
      } else {
        const { error } = await supabase.from('coffee_products').insert([payload]);
        if (error) throw error;
        toast({ title: 'Produto cadastrado' });
      }
      setDialogOpen(false);
      loadData();
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (product: CoffeeProduct) => {
    if (!confirm(`Excluir "${product.name}" do cardápio?`)) return;
    try {
      const { error } = await supabase.from('coffee_products').delete().eq('id', product.id);
      if (error) throw error;
      toast({ title: 'Produto removido' });
      loadData();
    } catch (error) {
      toast({
        title: 'Erro ao excluir',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleRemoteRelease = async (product: CoffeeProduct) => {
    if (!confirm(`Liberar remotamente "${product.name}" (R$ ${Number(product.price).toFixed(2)})?`)) {
      return;
    }
    const { error } = await adminRemoteRelease({
      machineId: product.machine_id,
      productId: product.id,
    });
    if (error) {
      toast({ title: 'Falha na liberação', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Crédito enfileirado', description: 'O ESP32 executará em até alguns segundos.' });
  };

  return (
    <LaundryGuard>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Coffee className="h-6 w-6" />
              Cardápio de Café
            </h1>
            <p className="text-muted-foreground">
              Produtos exibidos no totem e liberáveis remotamente por lavanderia.
            </p>
          </div>
          <Button onClick={openCreate} disabled={coffeeMachines.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            Novo produto
          </Button>
        </div>

        {coffeeMachines.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Máquina de café necessária</CardTitle>
              <CardDescription>
                Cadastre uma máquina do tipo &quot;Café&quot; em Máquinas antes de editar o cardápio.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Produtos ({products.length})</CardTitle>
            <CardDescription>
              Lavanderia: {currentLaundry?.name ?? '—'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Carregando…</p>
            ) : products.length === 0 ? (
              <p className="text-muted-foreground">Nenhum produto cadastrado.</p>
            ) : (
              <div className="space-y-3">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">
                        R$ {Number(product.price).toFixed(2)} · ordem {product.sort_order}
                        {!product.is_active && ' · inativo'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(product)}>
                        <Pencil className="mr-1 h-4 w-4" />
                        Editar
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => handleRemoteRelease(product)}>
                        <Zap className="mr-1 h-4 w-4" />
                        Liberar remoto
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(product)}>
                        <Trash2 className="mr-1 h-4 w-4" />
                        Excluir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar produto' : 'Novo produto'}</DialogTitle>
              <DialogDescription>Preço e nome aparecem no totem na categoria Café.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="price">Preço (R$)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="sort">Ordem no cardápio</Label>
                <Input
                  id="sort"
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                />
              </div>
              <div>
                <Label>Máquina de café</Label>
                <Select
                  value={form.machine_id}
                  onValueChange={(v) => setForm({ ...form, machine_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {coffeeMachines.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} {m.esp32_id ? `(${m.esp32_id})` : '(sem ESP32)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                />
                <Label>Ativo no totem</Label>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={handleSave}>
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </LaundryGuard>
  );
}
