import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useUniversalPayment, PaymentType, PaymentMethod, UniversalPaymentConfig } from '@/hooks/useUniversalPayment';
import { Loader2, CreditCard, Smartphone, Wifi, AlertCircle, CheckCircle, QrCode } from 'lucide-react';
import { formatPayGOAmount } from '@/lib/paygoUtils';

interface UniversalPaymentWidgetProps {
  amount: number;
  config: UniversalPaymentConfig;
  onSuccess: (data: any) => void;
  onError: (error: string) => void;
  onCancel: () => void;
  onPixQR?: (data: any) => void;
  /** Compact mode for Smart POS - larger buttons, no method selection */
  compactMode?: boolean;
}

export const UniversalPaymentWidget: React.FC<UniversalPaymentWidgetProps> = ({
  amount,
  config,
  onSuccess,
  onError,
  onCancel,
  onPixQR,
  compactMode = false
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
  } = useUniversalPayment(config);

  useEffect(() => {
    testAllMethods();
  }, [testAllMethods]);

  const handlePayment = async () => {
    try {
      // For PIX, use 'pix' as both method and type
      const method = paymentType === 'pix' ? 'pix' as PaymentMethod : preferredMethod;
      
      const result = await processPayment({
        amount,
        type: paymentType,
        orderId: `ORDER_${Date.now()}`,
      }, method);

      if (result.method === 'pix' && result.success && result.qrCode) {
        // PIX needs QR display
        onPixQR?.(result);
      } else if (result.success) {
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
      case 'paygo': return <CreditCard className="h-4 w-4" />;
      case 'tef': return <Wifi className="h-4 w-4" />;
      case 'pix': return <QrCode className="h-4 w-4" />;
      case 'manual': return <Smartphone className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getMethodName = (method: PaymentMethod) => {
    switch (method) {
      case 'paygo': return 'PayGO';
      case 'tef': return 'TEF';
      case 'pix': return 'PIX';
      case 'manual': return 'Manual';
      default: return 'Desconhecido';
    }
  };

  const getStatusBadge = (method: PaymentMethod) => {
    const status = methodsStatus.find(s => s.method === method);
    if (!status) return null;
    if (status.connected) {
      return <Badge variant="default" className="bg-green-500 text-white">Conectado</Badge>;
    } else if (status.available) {
      return <Badge variant="secondary">Disponível</Badge>;
    }
    return <Badge variant="destructive">Indisponível</Badge>;
  };

  const bestMethod = getBestAvailableMethod();
  const hasAvailableMethods = methodsStatus.some(s => s.available && s.method !== 'manual');

  // Compact mode for Smart POS - simplified UI
  if (compactMode) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5" />
            Pagamento
          </CardTitle>
          <div className="text-3xl font-bold text-primary">
            {formatPayGOAmount(amount)}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Large payment type buttons for touch */}
          <div className="grid grid-cols-1 gap-3">
            <Button
              variant={paymentType === 'credit' ? 'default' : 'outline'}
              className="h-16 text-lg font-semibold"
              onClick={() => { setPaymentType('credit'); }}
              disabled={isProcessing}
            >
              <CreditCard className="mr-3 h-6 w-6" />
              Crédito
            </Button>
            <Button
              variant={paymentType === 'debit' ? 'default' : 'outline'}
              className="h-16 text-lg font-semibold"
              onClick={() => { setPaymentType('debit'); }}
              disabled={isProcessing}
            >
              <Smartphone className="mr-3 h-6 w-6" />
              Débito
            </Button>
            <Button
              variant={paymentType === 'pix' ? 'default' : 'outline'}
              className="h-16 text-lg font-semibold"
              onClick={() => { setPaymentType('pix'); }}
              disabled={isProcessing}
            >
              <QrCode className="mr-3 h-6 w-6" />
              PIX
            </Button>
          </div>

          {/* Pay button */}
          <Button
            onClick={handlePayment}
            disabled={isProcessing}
            className="w-full h-14 text-lg font-bold"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Processando...
              </>
            ) : (
              `Pagar ${paymentType === 'pix' ? 'com PIX' : paymentType === 'debit' ? 'Débito' : 'Crédito'}`
            )}
          </Button>

          <Button variant="outline" onClick={onCancel} disabled={isProcessing} className="w-full h-12">
            Cancelar
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Full mode for Totem
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Pagamento
        </CardTitle>
        <div className="text-2xl font-bold text-primary">
          {formatPayGOAmount(amount)}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Payment Type Selection */}
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

        <Separator />

        {/* Method status */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Métodos Disponíveis:</h4>
          {methodsStatus.filter(s => s.method !== 'manual').map((status) => (
            <div
              key={status.method}
              className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-colors ${
                preferredMethod === status.method ? 'border-primary bg-primary/5' : ''
              }`}
              onClick={() => {
                if (status.method !== 'pix') {
                  setPreferredMethod(
                    preferredMethod === status.method ? undefined : status.method
                  );
                }
              }}
            >
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

        {/* Actions */}
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
              `Pagar ${paymentType === 'pix' ? 'com PIX' : paymentType === 'debit' ? 'Débito' : 'Crédito'}`
            )}
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={isProcessing}>
            Cancelar
          </Button>
        </div>

        {!hasAvailableMethods && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <p className="text-sm text-destructive">
              Nenhum método de pagamento disponível. Verifique as conexões.
            </p>
          </div>
        )}

        {bestMethod && (
          <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <p className="text-sm text-green-700">
              {getMethodName(bestMethod)} será usado automaticamente
            </p>
          </div>
        )}

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
