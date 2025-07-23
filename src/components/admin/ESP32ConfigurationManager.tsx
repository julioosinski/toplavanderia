import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit2, Trash2, Wifi, MapPin, Cpu } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface ESP32Config {
  id: string;
  name: string;
  host: string;
  port: number;
  location: string;
  machines: string[];
}

interface ESP32ConfigurationManagerProps {
  configurations: ESP32Config[];
  onUpdate: (configurations: ESP32Config[]) => void;
}

const ESP32ConfigurationManager: React.FC<ESP32ConfigurationManagerProps> = ({
  configurations,
  onUpdate
}) => {
  const [editingConfig, setEditingConfig] = useState<ESP32Config | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<ESP32Config>({
    id: '',
    name: '',
    host: '',
    port: 80,
    location: '',
    machines: []
  });
  const { toast } = useToast();

  const handleEdit = (config: ESP32Config) => {
    setEditingConfig(config);
    setFormData({ ...config });
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingConfig(null);
    setFormData({
      id: '',
      name: '',
      host: '',
      port: 80,
      location: '',
      machines: []
    });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.id || !formData.name || !formData.host) {
      toast({
        title: "Erro de Validação",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    let updatedConfigs;
    if (editingConfig) {
      // Atualizar existente
      updatedConfigs = configurations.map(config =>
        config.id === editingConfig.id ? formData : config
      );
    } else {
      // Adicionar novo
      if (configurations.some(config => config.id === formData.id)) {
        toast({
          title: "Erro",
          description: "ID já existe. Use um ID único para cada ESP32",
          variant: "destructive",
        });
        return;
      }
      updatedConfigs = [...configurations, formData];
    }

    onUpdate(updatedConfigs);
    setIsDialogOpen(false);
    toast({
      title: "Configuração Salva",
      description: `ESP32 ${formData.name} configurado com sucesso`,
    });
  };

  const handleDelete = (configId: string) => {
    const updatedConfigs = configurations.filter(config => config.id !== configId);
    onUpdate(updatedConfigs);
    toast({
      title: "ESP32 Removido",
      description: "Configuração removida com sucesso",
    });
  };

  const handleMachinesChange = (value: string) => {
    const machines = value.split(',').map(m => m.trim()).filter(m => m.length > 0);
    setFormData(prev => ({ ...prev, machines }));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-lg font-medium">Configurações dos ESP32s</h4>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAdd} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar ESP32
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingConfig ? 'Editar ESP32' : 'Novo ESP32'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="esp32-id">ID do ESP32 *</Label>
                <Input
                  id="esp32-id"
                  value={formData.id}
                  onChange={(e) => setFormData(prev => ({ ...prev, id: e.target.value }))}
                  placeholder="main, secondary, etc."
                  disabled={!!editingConfig}
                />
              </div>
              <div>
                <Label htmlFor="esp32-name">Nome *</Label>
                <Input
                  id="esp32-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="ESP32 Principal"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="esp32-host">Host/IP *</Label>
                  <Input
                    id="esp32-host"
                    value={formData.host}
                    onChange={(e) => setFormData(prev => ({ ...prev, host: e.target.value }))}
                    placeholder="192.168.1.100"
                  />
                </div>
                <div>
                  <Label htmlFor="esp32-port">Porta</Label>
                  <Input
                    id="esp32-port"
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData(prev => ({ ...prev, port: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="esp32-location">Localização</Label>
                <Input
                  id="esp32-location"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Conjunto A, Andar 2, etc."
                />
              </div>
              <div>
                <Label htmlFor="esp32-machines">Máquinas (separadas por vírgula)</Label>
                <Textarea
                  id="esp32-machines"
                  value={formData.machines.join(', ')}
                  onChange={(e) => handleMachinesChange(e.target.value)}
                  placeholder="lavadora_01, secadora_01"
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} className="flex-1">
                  Salvar
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {configurations.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">
                Nenhum ESP32 configurado. Clique em "Adicionar ESP32" para começar.
              </p>
            </CardContent>
          </Card>
        ) : (
          configurations.map((config) => (
            <Card key={config.id}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base">{config.name}</CardTitle>
                    <Badge variant="outline" className="mt-1">
                      ID: {config.id}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(config)}
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(config.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center">
                    <Wifi className="w-4 h-4 mr-2 text-muted-foreground" />
                    <span>{config.host}:{config.port}</span>
                  </div>
                  {config.location && (
                    <div className="flex items-center">
                      <MapPin className="w-4 h-4 mr-2 text-muted-foreground" />
                      <span>{config.location}</span>
                    </div>
                  )}
                </div>
                {config.machines.length > 0 && (
                  <div>
                    <div className="flex items-center text-sm text-muted-foreground mb-1">
                      <Cpu className="w-4 h-4 mr-2" />
                      Máquinas ({config.machines.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {config.machines.map((machine, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {machine}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default ESP32ConfigurationManager;