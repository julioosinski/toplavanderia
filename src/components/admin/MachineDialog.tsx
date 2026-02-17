import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLaundry } from "@/contexts/LaundryContext";
import { Plus, Edit } from "lucide-react";

interface Machine {
  id?: string;
  name: string;
  type: 'washing' | 'drying';
  location?: string;
  capacity_kg: number;
  price_per_cycle: number;
  cycle_time_minutes?: number;
  temperature?: number;
  laundry_id?: string;
  esp32_id?: string;
  relay_pin?: number;
}

export interface MachineDialogProps {
  machine?: Machine | null;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const MachineDialog = ({ 
  machine, 
  onSuccess, 
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange 
}: MachineDialogProps) => {
  const { currentLaundry } = useLaundry();
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;

  const [loading, setLoading] = useState(false);
  const [availableRelayPins, setAvailableRelayPins] = useState<number[]>([]);
  const [formData, setFormData] = useState<Machine>({
    name: "",
    type: "washing",
    location: "",
    capacity_kg: 10,
    price_per_cycle: 5.00,
    cycle_time_minutes: 40,
    temperature: 0,
    esp32_id: "",
    relay_pin: 1
  });

  // Buscar relay_pins disponíveis quando esp32_id mudar
  useEffect(() => {
    const fetchAvailableRelayPins = async () => {
      if (!currentLaundry || !formData.esp32_id) {
        setAvailableRelayPins([1, 2, 3, 4, 5, 6, 7, 8]);
        return;
      }

      const { data, error } = await supabase
        .from("machines")
        .select("relay_pin, name")
        .eq("laundry_id", currentLaundry.id)
        .eq("esp32_id", formData.esp32_id);

      if (error) {
        console.error("Error fetching relay pins:", error);
        return;
      }

      // Filtrar máquina atual se estiver editando
      const usedPins = data
        ?.filter(m => m.relay_pin && (!machine?.id || m.name !== machine.name))
        .map(m => m.relay_pin) || [];

      const available = [1, 2, 3, 4, 5, 6, 7, 8].filter(pin => !usedPins.includes(pin));
      setAvailableRelayPins(available);
    };

    fetchAvailableRelayPins();
  }, [formData.esp32_id, currentLaundry, machine]);

  useEffect(() => {
    if (machine) {
      setFormData({
        ...machine,
        cycle_time_minutes: machine.cycle_time_minutes || 40
      });
    } else {
      // Reset form quando não há máquina
      setFormData({
        name: "",
        type: "washing",
        location: "",
        capacity_kg: 10,
        price_per_cycle: 5.00,
        cycle_time_minutes: 40,
        temperature: 0,
        esp32_id: "",
        relay_pin: 1
      });
    }
  }, [machine, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentLaundry) {
      toast({
        title: "Erro",
        description: "Nenhuma lavanderia selecionada",
        variant: "destructive"
      });
      return;
    }

    // Validate esp32_id and relay_pin
    if (!formData.esp32_id || !formData.relay_pin) {
      toast({
        title: "Erro",
        description: "ESP32 ID e Pino do Relé são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Check for conflicts (same esp32_id + relay_pin)
      const { data: existingMachines, error: checkError } = await supabase
        .from("machines")
        .select("id, name, esp32_id, relay_pin")
        .eq("laundry_id", currentLaundry.id)
        .eq("esp32_id", formData.esp32_id)
        .eq("relay_pin", formData.relay_pin);

      if (checkError) throw checkError;

      // Filter out current machine if editing
      const conflicts = existingMachines?.filter(m => m.id !== machine?.id) || [];
      
      if (conflicts.length > 0) {
        toast({
          title: "Conflito de Configuração",
          description: `A combinação ESP32 "${formData.esp32_id}" + Relé ${formData.relay_pin} já está em uso pela máquina "${conflicts[0].name}"`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // ✅ Filtrar apenas campos válidos da tabela machines
      const dataToSave = {
        name: formData.name,
        type: formData.type,
        location: formData.location,
        capacity_kg: formData.capacity_kg,
        price_per_cycle: formData.price_per_cycle,
        cycle_time_minutes: formData.cycle_time_minutes,
        temperature: formData.temperature,
        esp32_id: formData.esp32_id,
        relay_pin: formData.relay_pin,
        laundry_id: currentLaundry.id,
      };

      if (machine?.id) {
        // Update existing machine
        const { error } = await supabase
          .from('machines')
          .update({
            ...dataToSave,
            updated_at: new Date().toISOString()
          })
          .eq('id', machine.id);

        if (error) throw error;

        toast({
          title: "Máquina atualizada",
          description: "As informações da máquina foram atualizadas com sucesso",
        });
      } else {
        // Create new machine
        const { error } = await supabase
          .from('machines')
          .insert([{
            ...dataToSave,
            status: 'available',
            total_uses: 0,
            total_revenue: 0
          }]);

        if (error) throw error;

        toast({
          title: "Máquina cadastrada",
          description: "Nova máquina foi cadastrada com sucesso",
        });
      }

      setOpen(false);
      if (onSuccess) onSuccess();
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
      {trigger !== undefined && (
        <DialogTrigger asChild>
          {trigger || defaultTrigger}
        </DialogTrigger>
      )}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="esp32_id">ESP32 ID *</Label>
              <Input
                id="esp32_id"
                value={formData.esp32_id || ''}
                onChange={(e) => setFormData({ ...formData, esp32_id: e.target.value })}
                placeholder="Ex: main, Cj01, Cj02"
                required
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Use o mesmo ID configurado no ESP32
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="relay_pin">Pino Relé *</Label>
              <Select
                value={String(formData.relay_pin || 1)}
                onValueChange={(value) => setFormData({ ...formData, relay_pin: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableRelayPins.map(pin => (
                    <SelectItem key={pin} value={String(pin)}>
                      Relay {pin}
                    </SelectItem>
                  ))}
                  {/* Mostrar pin atual mesmo se usado (para edição) */}
                  {formData.relay_pin && !availableRelayPins.includes(formData.relay_pin) && (
                    <SelectItem value={String(formData.relay_pin)}>
                      Relay {formData.relay_pin} (atual)
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {availableRelayPins.length > 0 
                  ? `Disponíveis: ${availableRelayPins.join(', ')}`
                  : '⚠️ Todos os relés deste ESP32 estão em uso'}
              </p>
            </div>
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
              <Label htmlFor="price">Preço/ciclo (R$)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={formData.price_per_cycle}
                onChange={(e) => setFormData({ ...formData, price_per_cycle: parseFloat(e.target.value) || 0 })}
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
