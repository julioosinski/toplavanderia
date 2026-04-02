import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLaundry } from "@/contexts/LaundryContext";
import { Plus, Edit, Wifi, WifiOff, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Machine {
  id?: string;
  name: string;
  type: 'lavadora' | 'secadora';
  location?: string;
  capacity_kg: number;
  price_per_cycle: number;
  cycle_time_minutes?: number;
  temperature?: number;
  laundry_id?: string;
  esp32_id?: string;
  relay_pin?: number;
}

interface ESP32Option {
  esp32_id: string;
  is_online: boolean;
  registration_status: string | null;
  device_name: string | null;
  has_machine: boolean;
}

export interface MachineDialogProps {
  machine?: Machine | null;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const MANUAL_ENTRY_VALUE = '__manual__';

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
  const [esp32Options, setEsp32Options] = useState<ESP32Option[]>([]);
  const [useManualEsp32, setUseManualEsp32] = useState(false);
  const [formData, setFormData] = useState<Machine>({
    name: "",
    type: "lavadora",
    location: "",
    capacity_kg: 10,
    price_per_cycle: 5.00,
    cycle_time_minutes: 40,
    temperature: 0,
    esp32_id: "",
    relay_pin: 1
  });

  // Fetch available ESP32s
  useEffect(() => {
    const fetchESP32s = async () => {
      if (!currentLaundry?.id || !open) return;

      // Get all ESP32s for this laundry
      const { data: esp32s, error: esp32Error } = await supabase
        .from('esp32_status')
        .select('esp32_id, is_online, registration_status, device_name')
        .eq('laundry_id', currentLaundry.id);

      if (esp32Error) {
        console.error('Error fetching ESP32s:', esp32Error);
        return;
      }

      // Get ESP32 IDs that already have machines
      const { data: machines, error: machError } = await supabase
        .from('machines')
        .select('esp32_id')
        .eq('laundry_id', currentLaundry.id);

      if (machError) {
        console.error('Error fetching machines:', machError);
        return;
      }

      const esp32sWithMachines = new Set(machines?.map(m => m.esp32_id).filter(Boolean) || []);

      const options: ESP32Option[] = (esp32s || [])
        .filter(e => {
          // Show: pending, approved orphans, rejected but online
          if (e.registration_status === 'pending') return true;
          if (e.registration_status === 'approved') return true; // show all approved (can have multiple machines)
          if (e.registration_status === 'rejected' && e.is_online) return true;
          return false;
        })
        .map(e => ({
          esp32_id: e.esp32_id,
          is_online: e.is_online ?? false,
          registration_status: e.registration_status,
          device_name: e.device_name,
          has_machine: esp32sWithMachines.has(e.esp32_id),
        }));

      setEsp32Options(options);
    };

    fetchESP32s();
  }, [currentLaundry?.id, open]);

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
      setUseManualEsp32(false);
    } else {
      setFormData({
        name: "",
        type: "lavadora",
        location: "",
        capacity_kg: 10,
        price_per_cycle: 5.00,
        cycle_time_minutes: 40,
        temperature: 0,
        esp32_id: "",
        relay_pin: 1
      });
      setUseManualEsp32(false);
    }
  }, [machine, open]);

  const handleEsp32Select = (value: string) => {
    if (value === MANUAL_ENTRY_VALUE) {
      setUseManualEsp32(true);
      setFormData({ ...formData, esp32_id: '' });
    } else {
      setUseManualEsp32(false);
      setFormData({ ...formData, esp32_id: value });
    }
  };

  const getStatusBadge = (opt: ESP32Option) => {
    if (opt.registration_status === 'pending') {
      return <Badge variant="outline" className="ml-auto text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/30"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
    }
    if (opt.registration_status === 'rejected') {
      return <Badge variant="outline" className="ml-auto text-xs bg-orange-500/10 text-orange-600 border-orange-500/30">Rejeitado</Badge>;
    }
    if (!opt.has_machine) {
      return <Badge variant="outline" className="ml-auto text-xs bg-blue-500/10 text-blue-600 border-blue-500/30">Órfão</Badge>;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentLaundry) {
      toast({ title: "Erro", description: "Nenhuma lavanderia selecionada", variant: "destructive" });
      return;
    }

    if (!formData.esp32_id || !formData.relay_pin) {
      toast({ title: "Erro", description: "ESP32 ID e Pino do Relé são obrigatórios", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      // Check for conflicts
      const { data: existingMachines, error: checkError } = await supabase
        .from("machines")
        .select("id, name, esp32_id, relay_pin")
        .eq("laundry_id", currentLaundry.id)
        .eq("esp32_id", formData.esp32_id)
        .eq("relay_pin", formData.relay_pin);

      if (checkError) throw checkError;

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

      const dbType = formData.type === 'lavadora' ? 'washing' : 'drying';
      const dataToSave = {
        name: formData.name,
        type: dbType,
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
        const { error } = await supabase
          .from('machines')
          .update({ ...dataToSave, updated_at: new Date().toISOString() })
          .eq('id', machine.id);
        if (error) throw error;
        toast({ title: "Máquina atualizada", description: "As informações da máquina foram atualizadas com sucesso" });
      } else {
        const { error } = await supabase
          .from('machines')
          .insert([{ ...dataToSave, status: 'available', total_uses: 0, total_revenue: 0 }]);
        if (error) throw error;
        toast({ title: "Máquina cadastrada", description: "Nova máquina foi cadastrada com sucesso" });
      }

      // Auto-approve ESP32 if pending or rejected
      const selectedOpt = esp32Options.find(o => o.esp32_id === formData.esp32_id);
      if (selectedOpt && (selectedOpt.registration_status === 'pending' || selectedOpt.registration_status === 'rejected')) {
        await supabase
          .from('esp32_status')
          .update({ registration_status: 'approved', updated_at: new Date().toISOString() })
          .eq('esp32_id', formData.esp32_id)
          .eq('laundry_id', currentLaundry.id);
      }

      setOpen(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error saving machine:', error);
      toast({ title: "Erro", description: "Falha ao salvar máquina", variant: "destructive" });
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

  const isEditingWithExistingEsp32 = !!machine?.esp32_id;

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
                onValueChange={(value: 'lavadora' | 'secadora') => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lavadora">Lavadora</SelectItem>
                  <SelectItem value="secadora">Secadora</SelectItem>
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
              <Label htmlFor="esp32_id">ESP32 *</Label>
              {useManualEsp32 ? (
                <div className="flex gap-2">
                  <Input
                    id="esp32_id"
                    value={formData.esp32_id || ''}
                    onChange={(e) => setFormData({ ...formData, esp32_id: e.target.value })}
                    placeholder="Digitar ID manualmente"
                    required
                    className="font-mono"
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setUseManualEsp32(false)}>
                    ✕
                  </Button>
                </div>
              ) : (
                <Select
                  value={formData.esp32_id || ''}
                  onValueChange={handleEsp32Select}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um ESP32" />
                  </SelectTrigger>
                  <SelectContent>
                    {esp32Options.map(opt => (
                      <SelectItem key={opt.esp32_id} value={opt.esp32_id}>
                        <div className="flex items-center gap-2 w-full">
                          {opt.is_online ? (
                            <Wifi className="h-3 w-3 text-green-500 shrink-0" />
                          ) : (
                            <WifiOff className="h-3 w-3 text-muted-foreground shrink-0" />
                          )}
                          <span className="font-mono text-sm">{opt.device_name || opt.esp32_id}</span>
                          {getStatusBadge(opt)}
                        </div>
                      </SelectItem>
                    ))}
                    {esp32Options.length === 0 && (
                      <SelectItem value={MANUAL_ENTRY_VALUE} className="text-muted-foreground">
                        Nenhum ESP32 detectado — digitar manualmente
                      </SelectItem>
                    )}
                    {esp32Options.length > 0 && (
                      <SelectItem value={MANUAL_ENTRY_VALUE} className="text-muted-foreground">
                        Outro (digitar manualmente)
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-muted-foreground">
                {esp32Options.length > 0 
                  ? `${esp32Options.filter(o => o.registration_status === 'pending').length} pendente(s) detectado(s)`
                  : 'Nenhum ESP32 detectado na rede'}
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

          {formData.type === 'lavadora' && (
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
