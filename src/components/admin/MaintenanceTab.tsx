import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Wrench, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Machine {
  id: string;
  name: string;
  type: string;
  last_maintenance?: string;
  total_uses: number;
}

interface MaintenanceRecord {
  id: string;
  machine_id: string;
  maintenance_date: string;
  description: string;
  technician: string;
  created_at: string;
}

export const MaintenanceTab = () => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [maintenanceDate, setMaintenanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState("");
  const [technician, setTechnician] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadMachines();
  }, []);

  const loadMachines = async () => {
    const { data, error } = await supabase
      .from('machines')
      .select('id, name, type, last_maintenance, total_uses')
      .order('name');
    
    if (!error && data) {
      setMachines(data);
    }
  };

  const getMaintenanceStatus = (machine: Machine) => {
    if (!machine.last_maintenance) {
      return {
        status: 'never',
        color: 'bg-red-500',
        text: 'Nunca',
        urgency: 'high'
      };
    }

    const lastMaintenance = new Date(machine.last_maintenance);
    const daysSince = Math.floor((Date.now() - lastMaintenance.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSince > 60) {
      return {
        status: 'overdue',
        color: 'bg-red-500',
        text: `${daysSince} dias atrás`,
        urgency: 'high'
      };
    } else if (daysSince > 30) {
      return {
        status: 'due',
        color: 'bg-orange-500',
        text: `${daysSince} dias atrás`,
        urgency: 'medium'
      };
    } else {
      return {
        status: 'ok',
        color: 'bg-green-500',
        text: `${daysSince} dias atrás`,
        urgency: 'low'
      };
    }
  };

  const scheduleMaintenance = async () => {
    if (!selectedMachine || !description.trim() || !technician.trim()) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Update machine's last maintenance date
      const { error: updateError } = await supabase
        .from('machines')
        .update({
          last_maintenance: maintenanceDate + 'T00:00:00Z',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedMachine.id);

      if (updateError) throw updateError;

      toast({
        title: "Manutenção agendada",
        description: `Manutenção da ${selectedMachine.name} agendada para ${new Date(maintenanceDate).toLocaleDateString('pt-BR')}`,
      });

      setDialogOpen(false);
      setDescription("");
      setTechnician("");
      setSelectedMachine(null);
      loadMachines();
    } catch (error) {
      console.error('Error scheduling maintenance:', error);
      toast({
        title: "Erro",
        description: "Falha ao agendar manutenção",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getRecommendedMaintenanceInterval = (machine: Machine) => {
    // Calculate recommended maintenance based on usage
    const usageLevel = machine.total_uses;
    
    if (usageLevel > 500) {
      return "15 dias";
    } else if (usageLevel > 200) {
      return "30 dias";
    } else {
      return "60 dias";
    }
  };

  const sortedMachines = machines.sort((a, b) => {
    const statusA = getMaintenanceStatus(a);
    const statusB = getMaintenanceStatus(b);
    
    const urgencyOrder = { high: 0, medium: 1, low: 2 };
    return urgencyOrder[statusA.urgency as keyof typeof urgencyOrder] - 
           urgencyOrder[statusB.urgency as keyof typeof urgencyOrder];
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Wrench className="text-primary" />
            <span>Agenda de Manutenção</span>
          </CardTitle>
          <CardDescription>
            Gerencie a manutenção preventiva das máquinas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sortedMachines.map((machine) => {
              const status = getMaintenanceStatus(machine);
              const StatusIcon = status.urgency === 'high' ? AlertTriangle : 
                               status.urgency === 'medium' ? Clock : CheckCircle;

              return (
                <div key={machine.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className={`w-3 h-3 rounded-full ${status.color}`}></div>
                    <StatusIcon className={`w-5 h-5 ${
                      status.urgency === 'high' ? 'text-red-600' :
                      status.urgency === 'medium' ? 'text-orange-600' : 'text-green-600'
                    }`} />
                    <div>
                      <p className="font-medium">{machine.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {machine.type === 'washing' ? 'Lavadora' : 'Secadora'} • 
                        {machine.total_uses} usos • 
                        Recomendado: {getRecommendedMaintenanceInterval(machine)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {status.status === 'never' 
                          ? 'Nunca passou por manutenção'
                          : `Última manutenção: ${status.text}`
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={
                      status.urgency === 'high' ? "destructive" : 
                      status.urgency === 'medium' ? "secondary" : "default"
                    }>
                      {status.urgency === 'high' ? "Urgente" :
                       status.urgency === 'medium' ? "Atenção" : "OK"}
                    </Badge>
                    <Dialog open={dialogOpen && selectedMachine?.id === machine.id} onOpenChange={(open) => {
                      setDialogOpen(open);
                      if (open) setSelectedMachine(machine);
                      else setSelectedMachine(null);
                    }}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Calendar size={16} className="mr-1" />
                          Agendar
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Agendar Manutenção - {machine.name}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="date">Data da Manutenção</Label>
                            <Input
                              id="date"
                              type="date"
                              value={maintenanceDate}
                              onChange={(e) => setMaintenanceDate(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="technician">Técnico Responsável</Label>
                            <Input
                              id="technician"
                              value={technician}
                              onChange={(e) => setTechnician(e.target.value)}
                              placeholder="Nome do técnico"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="description">Descrição dos Serviços</Label>
                            <Textarea
                              id="description"
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              placeholder="Descreva os serviços que serão realizados..."
                              rows={3}
                              required
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              onClick={() => {
                                setDialogOpen(false);
                                setSelectedMachine(null);
                              }} 
                              className="flex-1"
                            >
                              Cancelar
                            </Button>
                            <Button 
                              onClick={scheduleMaintenance} 
                              disabled={loading}
                              className="flex-1"
                            >
                              {loading ? "Agendando..." : "Agendar"}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Maintenance Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="text-red-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Manutenção Urgente</p>
                <p className="text-2xl font-bold">
                  {machines.filter(m => getMaintenanceStatus(m).urgency === 'high').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <Clock className="text-orange-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Atenção</p>
                <p className="text-2xl font-bold">
                  {machines.filter(m => getMaintenanceStatus(m).urgency === 'medium').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Em Dia</p>
                <p className="text-2xl font-bold">
                  {machines.filter(m => getMaintenanceStatus(m).urgency === 'low').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};