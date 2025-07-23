import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Zap, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useESP32CreditRelease } from '@/hooks/useESP32CreditRelease';
import { useToast } from '@/components/ui/use-toast';

interface CreditReleaseLog {
  id: string;
  transactionId: string;
  amount: number;
  timestamp: string;
  status: 'success' | 'error';
  message: string;
}

const CreditReleaseWidget: React.FC = () => {
  const [amount, setAmount] = useState<number>(10);
  const [releaseLog, setReleaseLog] = useState<CreditReleaseLog[]>([]);
  const { releaseCredit, isReleasing } = useESP32CreditRelease();
  const { toast } = useToast();

  const handleRelease = async () => {
    try {
      const transactionId = `manual-${Date.now()}`;
      const result = await releaseCredit({
        transactionId,
        amount,
        esp32Id: 'main'
      });

      // Adicionar ao log
      const logEntry: CreditReleaseLog = {
        id: transactionId,
        transactionId,
        amount,
        timestamp: new Date().toISOString(),
        status: 'success',
        message: 'Crédito liberado com sucesso'
      };

      setReleaseLog(prev => [logEntry, ...prev.slice(0, 9)]); // Manter apenas 10 entradas
    } catch (error) {
      // Adicionar erro ao log
      const logEntry: CreditReleaseLog = {
        id: `error-${Date.now()}`,
        transactionId: `manual-${Date.now()}`,
        amount,
        timestamp: new Date().toISOString(),
        status: 'error',
        message: error instanceof Error ? error.message : 'Erro desconhecido'
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
      {/* Release Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="text-primary" />
            <span>Liberação Manual de Crédito</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
            disabled={isReleasing || amount <= 0}
            className="w-full"
            size="lg"
          >
            <Zap className={`w-4 h-4 mr-2 ${isReleasing ? 'animate-pulse' : ''}`} />
            {isReleasing ? 'Liberando...' : `Liberar R$ ${amount.toFixed(2)}`}
          </Button>
          
          <p className="text-sm text-muted-foreground">
            Libere crédito manualmente para o ESP32 conectado
          </p>
        </CardContent>
      </Card>

      {/* Release Log */}
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
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                    <div>
                      <p className="font-medium">
                        R$ {log.amount.toFixed(2)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatTimestamp(log.timestamp)}
                      </p>
                    </div>
                  </div>
                  <Badge 
                    variant={log.status === 'success' ? 'secondary' : 'destructive'}
                    className={log.status === 'success' ? 'bg-green-100 text-green-800' : ''}
                  >
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