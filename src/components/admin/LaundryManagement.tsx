import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLaundry } from "@/contexts/LaundryContext";
import { Laundry } from "@/types/laundry";

export const LaundryManagement = () => {
  const { laundries, refreshLaundries } = useLaundry();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editingLaundry, setEditingLaundry] = useState<Laundry | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    cnpj: "",
    address: "",
    city: "",
    state: "",
    phone: "",
    email: "",
  });

  const resetForm = () => {
    setFormData({
      name: "",
      cnpj: "",
      address: "",
      city: "",
      state: "",
      phone: "",
      email: "",
    });
    setEditingLaundry(null);
  };

  const handleEdit = (laundry: Laundry) => {
    setEditingLaundry(laundry);
    setFormData({
      name: laundry.name,
      cnpj: laundry.cnpj,
      address: laundry.address || "",
      city: laundry.city || "",
      state: laundry.state || "",
      phone: laundry.phone || "",
      email: laundry.email || "",
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingLaundry) {
        const { error } = await supabase
          .from('laundries')
          .update(formData)
          .eq('id', editingLaundry.id);

        if (error) throw error;

        toast({
          title: "Lavanderia atualizada",
          description: "As informações foram atualizadas com sucesso.",
        });
      } else {
        const { error } = await supabase
          .from('laundries')
          .insert([formData]);

        if (error) throw error;

        toast({
          title: "Lavanderia criada",
          description: "Nova lavanderia adicionada com sucesso.",
        });
      }

      await refreshLaundries();
      setOpen(false);
      resetForm();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja desativar esta lavanderia?")) return;

    try {
      const { error } = await supabase
        .from('laundries')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Lavanderia desativada",
        description: "A lavanderia foi desativada com sucesso.",
      });

      await refreshLaundries();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Gerenciar Lavanderias</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Lavanderia
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingLaundry ? "Editar Lavanderia" : "Nova Lavanderia"}
              </DialogTitle>
              <DialogDescription>
                Preencha os dados da lavanderia
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ *</Label>
                <Input
                  id="cnpj"
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">Estado</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setOpen(false);
                    resetForm();
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingLaundry ? "Salvar" : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {laundries.map((laundry) => (
            <div
              key={laundry.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div>
                <h3 className="font-semibold">{laundry.name}</h3>
                <p className="text-sm text-muted-foreground">CNPJ: {laundry.cnpj}</p>
                {laundry.city && laundry.state && (
                  <p className="text-sm text-muted-foreground">
                    {laundry.city}, {laundry.state}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleEdit(laundry)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleDelete(laundry.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {laundries.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma lavanderia cadastrada
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
