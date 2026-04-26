import React, { useState, useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUniversalPayment, PaymentType, PaymentMethod, UniversalPaymentConfig, UniversalPaymentResponse } from '@/hooks/useUniversalPayment';
import { Loader2, CreditCard, Wallet, AlertCircle, QrCode } from 'lucide-react';
import { formatPayGOAmount } from '@/lib/paygoUtils';

interface UniversalPaymentWidgetProps {
  amount: number;
  config: UniversalPaymentConfig;
  onSuccess: (data: UniversalPaymentResponse) => void;
  onError: (error: string) => void;
  onCancel: () => void;
  onPixQR?: (data: UniversalPaymentResponse) => void;
  /** Smart POS: mantém o mesmo fluxo direto, apenas ajusta tamanhos */
  compactMode?: boolean;
  /** Quando false, oculta o botão "Voltar" no rodapé (ex.: totem já tem barra superior). */
  showFooterBack?: boolean;
}

export const UniversalPaymentWidget: React.FC<UniversalPaymentWidgetProps> = ({
  amount,
  config,
  onSuccess,
  onError,
  onCancel,
  onPixQR,
  compactMode = false,
  showFooterBack = true,
}) => {
  /** Tipo em processamento — atualizado com flushSync para não “piscar” crédito/débito ao escolher PIX */
  const [pendingChoice, setPendingChoice] = useState<PaymentType | null>(null);

  const {
    isProcessing,
    methodsStatus,
    processPayment,
    testAllMethods,
    getBestAvailableMethod,
  } = useUniversalPayment(config);

  /** Provedor configurado no sistema (PayGO pinpad vs Cielo Smart/LIO via deep link) */
  const paymentProvider = useMemo(
    () => (config.provider || config.paygo.provider || 'paygo').toLowerCase(),
    [config.provider, config.paygo.provider]
  );
  const gatewayBrand = paymentProvider === 'cielo' ? 'Cielo LIO' : 'PayGO';

  const hasAvailableMethods = methodsStatus.some((s) => s.available && s.method !== 'manual');
  const bestMethod = getBestAvailableMethod();
  const bestLabel = useMemo(() => {
    if (!bestMethod) return '';
    if (bestMethod === 'tef') return 'TEF';
    if (bestMethod === 'pix') return 'PIX';
    // Canal interno continua sendo "paygo" no hook; o rótulo segue o provedor real.
    if (bestMethod === 'paygo') return gatewayBrand;
    return bestMethod;
  }, [bestMethod, gatewayBrand]);

  const payWithType = useCallback(
    async (type: PaymentType) => {
      if (isProcessing || !hasAvailableMethods) return;
      flushSync(() => {
        setPendingChoice(type);
      });
      try {
        const method: PaymentMethod | undefined = undefined;
        const result = await processPayment(
          {
            amount,
            type,
            orderId: `ORDER_${Date.now()}`,
          },
          method
        );

        const hasPixPayload = Boolean(result.qrCode || result.qrCodeBase64);
        if (result.method === 'pix' && result.success && hasPixPayload) {
          onPixQR?.(result);
        } else if (result.success) {
          onSuccess(result);
        } else {
          onError(
            result.error ||
              (result.data && typeof result.data.errorMessage === 'string'
                ? result.data.errorMessage
                : undefined) ||
              'Falha no pagamento'
          );
        }
      } catch (error) {
        onError(error instanceof Error ? error.message : 'Erro inesperado');
      } finally {
        setPendingChoice(null);
      }
    },
    [
      amount,
      hasAvailableMethods,
      isProcessing,
      onError,
      onPixQR,
      onSuccess,
      processPayment,
    ]
  );

  const btnClass = compactMode ? 'h-16 text-lg font-semibold' : 'h-14 text-base font-semibold';
  const iconClass = compactMode ? 'h-6 w-6 mr-3' : 'h-5 w-5 mr-2';

  const waitingCard =
    isProcessing && (pendingChoice === 'credit' || pendingChoice === 'debit');
  const waitingPix = isProcessing && pendingChoice === 'pix';

  const typeButton = (type: PaymentType, label: string, Icon: typeof CreditCard) => {
    const busy = isProcessing && pendingChoice === type;
    return (
      <Button
        variant="outline"
        className={`${btnClass} w-full justify-start border-2 hover:border-primary hover:bg-primary/5`}
        onClick={() => void payWithType(type)}
        disabled={isProcessing || !hasAvailableMethods}
      >
        {busy ? (
          <Loader2 className={`${iconClass} animate-spin shrink-0`} />
        ) : (
          <Icon className={`${iconClass} shrink-0`} />
        )}
        {label}
      </Button>
    );
  };

  const cardFlowTitle =
    pendingChoice === 'credit' ? 'Crédito' : pendingChoice === 'debit' ? 'Débito' : '';

  const inner = (
    <>
      {waitingCard ? (
        <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
          <Loader2
            className={`${compactMode ? 'h-14 w-14' : 'h-12 w-12'} animate-spin text-primary`}
          />
          <div className="space-y-2">
            <p className={`font-semibold ${compactMode ? 'text-xl' : 'text-lg'}`}>
              {cardFlowTitle ? `Pagamento — ${cardFlowTitle}` : 'Pagamento com cartão'}
            </p>
            <p className="text-sm text-muted-foreground max-w-sm">
              {paymentProvider === 'cielo'
                ? 'Siga as instruções no terminal Cielo Smart. O pagamento é concluído na própria maquininha.'
                : 'Aproxime, insira ou passe o cartão na maquininha e aguarde a conclusão na pinpad. Não é necessário escolher de novo na tela.'}
            </p>
          </div>
        </div>
      ) : waitingPix ? (
        <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
          <Loader2
            className={`${compactMode ? 'h-14 w-14' : 'h-12 w-12'} animate-spin text-primary`}
          />
          <div className="space-y-2">
            <p className={`font-semibold ${compactMode ? 'text-xl' : 'text-lg'}`}>Pagamento — PIX</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              {paymentProvider === 'cielo' || compactMode
                ? 'Use o terminal para concluir o PIX quando ele solicitar. Não é necessário escolher débito na tela.'
                : 'Gerando o código PIX. Em seguida use a câmera do celular ou confirme no app do banco.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground text-center">
            {paymentProvider === 'cielo'
              ? `Toque para iniciar o pagamento via ${gatewayBrand}`
              : 'Toque na forma de pagamento para iniciar na maquininha'}
          </p>
          <div className={`grid grid-cols-1 ${compactMode ? 'gap-3' : 'gap-2'}`}>
            {typeButton('credit', 'Crédito', CreditCard)}
            {typeButton('debit', 'Débito', Wallet)}
            {typeButton('pix', 'PIX', QrCode)}
          </div>
        </div>
      )}

      {!hasAvailableMethods && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive">
            {paymentProvider === 'cielo'
              ? `Nenhum método disponível. Verifique credenciais ${gatewayBrand} e o app do terminal Cielo.`
              : 'Nenhum método de pagamento disponível. Verifique PayGo Integrado e o pinpad.'}
          </p>
        </div>
      )}

      {bestMethod && hasAvailableMethods && (
        <p className="text-xs text-center text-muted-foreground">
          Integração: <Badge variant="secondary">{bestLabel}</Badge>
        </p>
      )}

      {showFooterBack && (
        <Button variant="outline" onClick={onCancel} disabled={isProcessing} className="w-full">
          Voltar
        </Button>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => void testAllMethods({ interactive: true })}
        disabled={isProcessing}
        className="w-full text-xs"
      >
        Testar conexões
      </Button>
    </>
  );

  if (compactMode) {
    return (
      <Card className="w-full max-w-md mx-auto border-0 shadow-none">
        <CardHeader className="pb-2 px-0 pt-0">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5" />
            Pagamento
          </CardTitle>
          <div className="text-3xl font-bold text-primary">{formatPayGOAmount(amount)}</div>
        </CardHeader>
        <CardContent className="space-y-3 px-0">{inner}</CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto border-0 shadow-none">
      <CardHeader className="pb-2 px-0 pt-0">
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Pagamento
        </CardTitle>
        <div className="text-2xl font-bold text-primary">{formatPayGOAmount(amount)}</div>
      </CardHeader>
      <CardContent className="space-y-4 px-0">{inner}</CardContent>
    </Card>
  );
};
