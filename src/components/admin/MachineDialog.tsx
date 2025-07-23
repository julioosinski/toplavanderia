import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Edit } from "lucide-react";

interface Machine {
  id?: string;
  name: string;
  type: 'washing' | 'drying';
  location?: string;
  capacity_kg: number;
  price_per_kg: number;
  cycle_time_minutes?: number;
  temperature?: number;
}

interface MachineDialogProps {
  machine?: Machine;
  onSuccess: () => void;
  trigger?: React.ReactNode;
}

export const MachineDialog = ({ machine, onSuccess, trigger }: MachineDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Machine>({
    name: "",
    type: "washing",
    location: "",
    capacity_kg: 10,
    price_per_kg: 5.00,
    cycle_time_minutes: 40,
    temperature: 0
  });
  const { toast } = useToast();

  useEffect(() => {
    if (machine) {
      setFormData({
        ...machine,
        cycle_time_minutes: machine.cycle_time_minutes || 40
      });
    }
  }, [machine]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    console.log('=== MACHINE DIALOG DEBUG ===');
    console.log('Form data:', formData);
    console.log('Machine prop:', machine);
    console.log('Is update:', !!machine?.id);

    try {
      if (machine?.id) {
        // Update existing machine
        console.log('Updating machine with ID:', machine.id);
        console.log('Update data:', { ...formData, updated_at: new Date().toISOString() });
        
        const { data, error } = await supabase
          .from('machines')
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', machine.id)
          .select();

        console.log('Update response:', { data, error });
        if (error) throw error;

        toast({
          title: "Máquina atualizada",
          description: "As informações da máquina foram atualizadas com sucesso",
        });
      } else {
        // Create new machine
        console.log('Creating new machine');
        console.log('Insert data:', {
          ...formData,
          status: 'available',
          total_uses: 0,
          total_revenue: 0
        });

        const { data, error } = await supabase
          .from('machines')
          .insert([{
            ...formData,
            status: 'available',
            total_uses: 0,
            total_revenue: 0
          }])
          .select();

        console.log('Insert response:', { data, error });
        if (error) throw error;

        toast({
          title: "Máquina cadastrada",
          description: "Nova máquina foi cadastrada com sucesso",
        });
      }

      setOpen(false);
      onSuccess();
      
      // Reset form if creating new machine
      if (!machine) {
        setFormData({
          name: "",
          type: "washing",
          location: "",
          capacity_kg: 10,
          price_per_kg: 5.00,
          cycle_time_minutes: 40,
          temperature: 0
        });
      }
    } catch (error) {
      console.error('Error saving machine:', error);
      toast({
        title: "Erro",
        description: "Falha ao salvar máquina",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const defaultTrigger = machine ? (
    <Button variant="outline" size="sm">
      <Edit size={16} className="mr-1" />
      Editar
    </Button>
  ) : (
    <Button>
      <Plus size={16} className="mr-1" />
      Nova Máquina
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {machine ? "Editar Máquina" : "Nova Máquina"}
          </DialogTitle>
          <DialogDescription>
            {machine ? "Modifique as informações da máquina abaixo" : "Cadastre uma nova máquina no sistema"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Máquina</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Lavadora 01"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Tipo</Label>
              <Select 
                value={formData.type} 
                onValueChange={(value: 'washing' | 'drying') => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="washing">Lavadora</SelectItem>
                  <SelectItem value="drying">Secadora</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Localização</Label>
            <Input
              id="location"
              value={formData.location || ""}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Ex: Térreo - Lado direito"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="capacity">Capacidade (kg)</Label>
              <Input
                id="capacity"
                type="number"
                min="1"
                max="50"
                value={formData.capacity_kg}
                onChange={(e) => setFormData({ ...formData, capacity_kg: parseInt(e.target.value) || 0 })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Preço/kg (R$)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={formData.price_per_kg}
                onChange={(e) => setFormData({ ...formData, price_per_kg: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cycle">Tempo Ciclo (min)</Label>
              <Input
                id="cycle"
                type="number"
                min="1"
                max="180"
                value={formData.cycle_time_minutes}
                onChange={(e) => setFormData({ ...formData, cycle_time_minutes: parseInt(e.target.value) || 0 })}
                required
              />
            </div>
          </div>

          {formData.type === 'washing' && (
            <div className="space-y-2">
              <Label htmlFor="temperature">Temperatura (°C)</Label>
              <Input
                id="temperature"
                type="number"
                min="0"
                max="90"
                value={formData.temperature || 0}
                onChange={(e) => setFormData({ ...formData, temperature: parseInt(e.target.value) || 0 })}
              />
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Salvando..." : machine ? "Atualizar" : "Cadastrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};