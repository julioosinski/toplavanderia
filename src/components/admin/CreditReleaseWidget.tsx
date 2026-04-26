import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Zap, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useESP32CreditRelease } from '@/hooks/useESP32CreditRelease';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useLaundry } from '@/contexts/LaundryContext';

interface CreditReleaseLog {
  id: string;
  transactionId: string;
  amount: number;
  timestamp: string;
  status: 'success' | 'error';
  message: string;
  machineName?: string;
}

interface MachineOption {
  id: string;
  name: string;
  esp32_id: string | null;
  type: string;
  status: string;
}

const CreditReleaseWidget: React.FC = () => {
  const [amount, setAmount] = useState<number>(10);
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [releaseLog, setReleaseLog] = useState<CreditReleaseLog[]>([]);
  const { releaseCredit, isReleasing } = useESP32CreditRelease();
  const { toast } = useToast();
  const { currentLaundry } = useLaundry();

  useEffect(() => {
    if (!currentLaundry?.id) return;

    const fetchMachines = async () => {
      const { data, error } = await supabase
        .from('machines')
        .select('id, name, esp32_id, type, status')
        .eq('laundry_id', currentLaundry.id)
        .order('name');

      if (!error && data) {
        setMachines(data);
        setSelectedMachineId((current) => current || data[0]?.id || '');
      }
    };

    void fetchMachines();
  }, [currentLaundry?.id]);

  const selectedMachine = machines.find(m => m.id === selectedMachineId);

  const handleRelease = async () => {
    if (!selectedMachineId) {
      toast({ title: 'Selecione uma máquina', variant: 'destructive' });
      return;
    }

    try {
      const transactionId = `manual-${Date.now()}`;
      await releaseCredit({
        transactionId,
        amount,
        esp32Id: selectedMachine?.esp32_id || 'main',
        machineId: selectedMachineId,
      });

      const logEntry: CreditReleaseLog = {
        id: transactionId,
        transactionId,
        amount,
        timestamp: new Date().toISOString(),
        status: 'success',
        message: 'Crédito liberado com sucesso',
        machineName: selectedMachine?.name,
      };

      setReleaseLog(prev => [logEntry, ...prev.slice(0, 9)]);
    } catch (error) {
      const logEntry: CreditReleaseLog = {
        id: `error-${Date.now()}`,
        transactionId: `manual-${Date.now()}`,
        amount,
        timestamp: new Date().toISOString(),
        status: 'error',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        machineName: selectedMachine?.name,
      };

      setReleaseLog(prev => [logEntry, ...prev.slice(0, 9)]);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="text-primary" />
            <span>Liberação Manual de Crédito</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Máquina</Label>
            <Select value={selectedMachineId} onValueChange={setSelectedMachineId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma máquina" />
              </SelectTrigger>
              <SelectContent>
                {machines.map(machine => (
                  <SelectItem key={machine.id} value={machine.id}>
                    {machine.name} ({machine.type}) — {machine.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="release-amount">Valor (R$)</Label>
            <Input
              id="release-amount"
              type="number"
              min="0.01"
              max="1000"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              disabled={isReleasing}
            />
          </div>
          
          <Button 
            onClick={handleRelease}
            disabled={isReleasing || amount <= 0 || !selectedMachineId}
            className="w-full"
            size="lg"
          >
            <Zap className={`w-4 h-4 mr-2 ${isReleasing ? 'animate-pulse' : ''}`} />
            {isReleasing ? 'Liberando...' : `Liberar R$ ${amount.toFixed(2)}`}
          </Button>
          
          <p className="text-sm text-muted-foreground">
            Libere crédito manualmente para a máquina selecionada via ESP32
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="text-primary" />
            <span>Log de Liberações</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {releaseLog.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma liberação registrada ainda</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {releaseLog.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    {log.status === 'success' ? (
                      <CheckCircle className="w-5 h-5 text-primary" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-destructive" />
                    )}
                    <div>
                      <p className="font-medium">
                        R$ {log.amount.toFixed(2)} {log.machineName && `— ${log.machineName}`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatTimestamp(log.timestamp)}
                      </p>
                    </div>
                  </div>
                  <Badge variant={log.status === 'success' ? 'secondary' : 'destructive'}>
                    {log.status === 'success' ? 'Sucesso' : 'Erro'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CreditReleaseWidget;
