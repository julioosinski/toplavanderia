import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useUniversalPayment, PaymentType, PaymentMethod } from '@/hooks/useUniversalPayment';
import { Loader2, CreditCard, Smartphone, Bluetooth, Wifi, AlertCircle, CheckCircle } from 'lucide-react';
import { formatPayGOAmount } from '@/lib/paygoUtils';

interface UniversalPaymentWidgetProps {
  amount: number;
  onSuccess: (data: any) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

export const UniversalPaymentWidget: React.FC<UniversalPaymentWidgetProps> = ({
  amount,
  onSuccess,
  onError,
  onCancel
}) => {
  const [paymentType, setPaymentType] = useState<PaymentType>('credit');
  const [preferredMethod, setPreferredMethod] = useState<PaymentMethod | undefined>();
  
  const {
    isProcessing,
    currentMethod,
    methodsStatus,
    processPayment,
    testAllMethods,
    getBestAvailableMethod
  } = useUniversalPayment();

  // Testar conexões ao carregar
  useEffect(() => {
    testAllMethods();
  }, [testAllMethods]);

  const handlePayment = async () => {
    try {
      const result = await processPayment({
        amount,
        type: paymentType,
        orderId: `ORDER_${Date.now()}`,
      }, preferredMethod);

      if (result.success) {
        onSuccess(result);
      } else {
        onError(result.error || 'Falha no pagamento');
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Erro inesperado');
    }
  };

  const getMethodIcon = (method: PaymentMethod) => {
    switch (method) {
      case 'paygo':
        return <Wifi className="h-4 w-4" />;
      case 'tef':
        return <CreditCard className="h-4 w-4" />;
      case 'bluetooth':
        return <Bluetooth className="h-4 w-4" />;
      case 'manual':
        return <Smartphone className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getMethodName = (method: PaymentMethod) => {
    switch (method) {
      case 'paygo':
        return 'PayGO';
      case 'tef':
        return 'TEF';
      case 'bluetooth':
        return 'Bluetooth';
      case 'manual':
        return 'Manual';
      default:
        return 'Desconhecido';
    }
  };

  const getStatusBadge = (method: PaymentMethod) => {
    const status = methodsStatus.find(s => s.method === method);
    if (!status) return null;

    if (status.connected) {
      return <Badge variant="default" className="bg-success text-success-foreground">Conectado</Badge>;
    } else if (status.available) {
      return <Badge variant="secondary">Disponível</Badge>;
    } else {
      return <Badge variant="destructive">Indisponível</Badge>;
    }
  };

  const bestMethod = getBestAvailableMethod();
  const hasAvailableMethods = methodsStatus.some(s => s.available);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Pagamento Universal
        </CardTitle>
        <div className="text-2xl font-bold text-primary">
          {formatPayGOAmount(amount)}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Status dos Métodos */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Métodos Disponíveis:</h4>
          {methodsStatus.map((status) => (
            <div key={status.method} className="flex items-center justify-between p-2 rounded-lg border">
              <div className="flex items-center gap-2">
                {getMethodIcon(status.method)}
                <span className="text-sm">{getMethodName(status.method)}</span>
                {status.method === bestMethod && (
                  <Badge variant="outline" className="text-xs">Preferido</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(status.method)}
                {status.method === currentMethod && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
              </div>
            </div>
          ))}
        </div>

        <Separator />

        {/* Seleção do Tipo de Pagamento */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Tipo de Pagamento:</h4>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant={paymentType === 'credit' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPaymentType('credit')}
              disabled={isProcessing}
            >
              Crédito
            </Button>
            <Button
              variant={paymentType === 'debit' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPaymentType('debit')}
              disabled={isProcessing}
            >
              Débito
            </Button>
            <Button
              variant={paymentType === 'pix' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPaymentType('pix')}
              disabled={isProcessing}
            >
              PIX
            </Button>
          </div>
        </div>

        {/* Seleção do Método Preferido */}
        {hasAvailableMethods && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Método Preferido (Opcional):</h4>
            <div className="grid grid-cols-2 gap-2">
              {methodsStatus
                .filter(s => s.available)
                .map((status) => (
                  <Button
                    key={status.method}
                    variant={preferredMethod === status.method ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPreferredMethod(
                      preferredMethod === status.method ? undefined : status.method
                    )}
                    disabled={isProcessing}
                    className="flex items-center gap-2"
                  >
                    {getMethodIcon(status.method)}
                    {getMethodName(status.method)}
                  </Button>
                ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Ações */}
        <div className="flex gap-2">
          <Button
            onClick={handlePayment}
            disabled={isProcessing || !hasAvailableMethods}
            className="flex-1"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              'Pagar'
            )}
          </Button>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isProcessing}
          >
            Cancelar
          </Button>
        </div>

        {/* Informações Adicionais */}
        {!hasAvailableMethods && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <p className="text-sm text-destructive">
              Nenhum método de pagamento disponível. Verifique as conexões.
            </p>
          </div>
        )}

        {bestMethod && (
          <div className="flex items-center gap-2 p-3 bg-success/10 rounded-lg">
            <CheckCircle className="h-4 w-4 text-success" />
            <p className="text-sm text-success">
              {getMethodName(bestMethod)} será usado automaticamente
            </p>
          </div>
        )}

        {/* Botão de Teste */}
        <Button
          variant="ghost"
          size="sm"
          onClick={testAllMethods}
          disabled={isProcessing}
          className="w-full"
        >
          Testar Conexões
        </Button>
      </CardContent>
    </Card>
  );
};