import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  CreditCard, 
  Smartphone, 
  QrCode, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Settings,
  Wifi
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SimplePayGOWidgetProps {
  amount: number;
  onSuccess: (result: any) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

export const SimplePayGOWidget: React.FC<SimplePayGOWidgetProps> = ({
  amount,
  onSuccess,
  onError,
  onCancel,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [paymentType, setPaymentType] = useState<'CREDIT' | 'DEBIT' | 'PIX'>('CREDIT');
  const [config, setConfig] = useState({
    host: '127.0.0.1',
    port: '8080',
    timeout: 30000,
  });
  const { toast } = useToast();

  // Verificar conexão ao montar
  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    setConnectionStatus('checking');
    try {
      const response = await fetch(`http://${config.host}:${config.port}/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        setConnectionStatus('online');
        toast({
          title: "PayGO Conectado",
          description: "Maquininha está online e pronta para uso",
        });
      } else {
        setConnectionStatus('offline');
      }
    } catch (error) {
      setConnectionStatus('offline');
      console.error('PayGO connection failed:', error);
    }
  };

  const processPayment = async () => {
    if (connectionStatus !== 'online') {
      toast({
        title: "Erro de Conexão",
        description: "Maquininha PayGO não está conectada",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const orderId = `ORDER-${Date.now()}`;
      
      // Para PIX, usar endpoint diferente
      const endpoint = paymentType === 'PIX' 
        ? `http://${config.host}:${config.port}/pix/generate`
        : `http://${config.host}:${config.port}/transaction`;

      const requestBody = paymentType === 'PIX' 
        ? {
            amount: Math.round(amount * 100), // centavos
            orderId,
            expiresIn: 300, // 5 minutos
          }
        : {
            amount: Math.round(amount * 100), // centavos
            installments: 1,
            paymentType,
            orderId,
          };

      console.log('Enviando pagamento PayGO:', requestBody);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(config.timeout),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Resposta PayGO:', result);

      if (result.success) {
        if (paymentType === 'PIX' && result.qrCode) {
          // Para PIX, mostrar QR Code e iniciar polling
          toast({
            title: "QR Code PIX Gerado",
            description: "Escaneie o código para pagar",
          });
          
          // Simular polling do PIX
          pollPixPayment(orderId, result);
        } else {
          // Para cartão, sucesso imediato
          onSuccess({
            ...result,
            paymentType,
            orderId,
            amount,
          });
        }
      } else {
        onError(result.resultMessage || 'Pagamento negado');
      }
    } catch (error) {
      console.error('Erro no pagamento:', error);
      onError(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setIsProcessing(false);
    }
  };

  const pollPixPayment = async (orderId: string, pixData: any) => {
    const maxPolls = 60; // 5 minutos (5s * 60)
    let polls = 0;

    const poll = async () => {
      try {
        const response = await fetch(`http://${config.host}:${config.port}/pix/status/${orderId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const status = await response.json();
          
          if (status.status === 'paid') {
            onSuccess({
              success: true,
              paymentType: 'PIX',
              orderId,
              amount,
              transactionId: status.transactionId,
              nsu: status.nsu,
            });
            return;
          } else if (status.status === 'expired' || status.status === 'cancelled') {
            onError('Pagamento PIX expirado ou cancelado');
            return;
          }
        }

        polls++;
        if (polls < maxPolls) {
          setTimeout(poll, 5000); // Poll a cada 5 segundos
        } else {
          onError('Tempo limite para pagamento PIX esgotado');
        }
      } catch (error) {
        console.error('Erro no polling PIX:', error);
        onError('Erro ao verificar status do PIX');
      }
    };

    // Mostrar dados do PIX para o usuário
    toast({
      title: "PIX Gerado",
      description: `QR Code: ${pixData.qrCode?.substring(0, 50)}...`,
      duration: 10000,
    });

    poll();
  };

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'checking':
        return (
          <Badge variant="secondary">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Verificando...
          </Badge>
        );
      case 'online':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="w-3 h-3 mr-1" />
            Online
          </Badge>
        );
      case 'offline':
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Offline
          </Badge>
        );
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <CreditCard className="text-primary" />
            <span>PayGO Elgin</span>
          </CardTitle>
          {getStatusBadge()}
        </div>
        <CardDescription>
          Valor: <span className="font-bold text-lg">R$ {amount.toFixed(2)}</span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Configuração rápida */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Configuração PayGO:</Label>
          <div className="flex space-x-2">
            <Input
              placeholder="Host"
              value={config.host}
              onChange={(e) => setConfig(prev => ({ ...prev, host: e.target.value }))}
              className="text-xs"
            />
            <Input
              placeholder="Porta"
              value={config.port}
              onChange={(e) => setConfig(prev => ({ ...prev, port: e.target.value }))}
              className="text-xs w-20"
            />
            <Button size="sm" variant="outline" onClick={checkConnection}>
              <Wifi className="w-3 h-3" />
            </Button>
          </div>
        </div>

        <Separator />

        {/* Seleção de tipo de pagamento */}
        <div className="space-y-3">
          <Label>Forma de Pagamento:</Label>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant={paymentType === 'CREDIT' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPaymentType('CREDIT')}
              disabled={isProcessing}
            >
              <CreditCard className="w-4 h-4 mr-1" />
              Crédito
            </Button>
            <Button
              variant={paymentType === 'DEBIT' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPaymentType('DEBIT')}
              disabled={isProcessing}
            >
              <CreditCard className="w-4 h-4 mr-1" />
              Débito
            </Button>
            <Button
              variant={paymentType === 'PIX' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPaymentType('PIX')}
              disabled={isProcessing}
            >
              <QrCode className="w-4 h-4 mr-1" />
              PIX
            </Button>
          </div>
        </div>

        <Separator />

        {/* Botões de ação */}
        <div className="flex space-x-2">
          <Button
            onClick={processPayment}
            disabled={isProcessing || connectionStatus !== 'online'}
            className="flex-1"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                {paymentType === 'PIX' ? (
                  <QrCode className="w-4 h-4 mr-2" />
                ) : (
                  <CreditCard className="w-4 h-4 mr-2" />
                )}
                Pagar {paymentType}
              </>
            )}
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={isProcessing}>
            Cancelar
          </Button>
        </div>

        {/* Instruções */}
        <div className="text-xs text-muted-foreground space-y-1">
          {paymentType === 'PIX' ? (
            <p>• Gere o QR Code e escaneie com seu banco</p>
          ) : (
            <>
              <p>• Insira ou aproxime o cartão na maquininha</p>
              <p>• Digite a senha quando solicitado</p>
            </>
          )}
          <p>• Aguarde a confirmação da transação</p>
        </div>
      </CardContent>
    </Card>
  );
};