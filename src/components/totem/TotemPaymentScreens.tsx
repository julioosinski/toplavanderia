import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { CreditCard, CheckCircle, XCircle, Clock } from "lucide-react";
import type { Machine } from "@/hooks/useMachines";
import { UniversalPaymentWidget } from '@/components/payment/UniversalPaymentWidget';
import { UniversalPaymentConfig } from '@/hooks/useUniversalPayment';

interface ProcessingScreenProps {
  onCancel: () => void;
  /** Padrão: fluxo na maquininha */
  variant?: 'payment' | 'activating';
}

export const ProcessingScreen = ({ onCancel, variant = 'payment' }: ProcessingScreenProps) => {
  const isActivating = variant === 'activating';
  return (
    <div className="min-h-screen bg-gradient-clean flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-glow">
        <CardContent className="pt-6 text-center space-y-6">
          <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto animate-pulse">
            <CreditCard className="text-primary-foreground" size={24} />
          </div>
          <h2 className="text-2xl font-bold">
            {isActivating ? 'Ativando máquina' : 'Processando Pagamento'}
          </h2>
          <p className="text-muted-foreground">
            {isActivating ? (
              <>
                Registrando o pagamento e enviando o comando ao equipamento.
                <br />
                Aguarde um instante…
              </>
            ) : (
              <>
                Passe ou insira o cartão na maquininha…
                <br />
                Aguarde a conclusão da transação.
              </>
            )}
          </p>
          <Progress value={50} className="w-full" />
          <div className="flex space-x-2">
            <Button onClick={onCancel} variant="outline" className="flex-1">
              {isActivating ? 'Voltar ao início' : 'Cancelar Pagamento'}
            </Button>
            {!isActivating && (
              <Button onClick={onCancel} variant="destructive" className="flex-1">
                Cancelar Tudo
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

interface ErrorScreenProps {
  onRetry: () => void;
  onCancel: () => void;
}

export const ErrorScreen = ({ onRetry, onCancel }: ErrorScreenProps) => {
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { onCancel(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onCancel]);

  return (
    <div className="min-h-screen bg-gradient-clean flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-glow">
        <CardContent className="pt-6 text-center space-y-6">
          <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto">
            <XCircle className="text-white" size={24} />
          </div>
          <h2 className="text-2xl font-bold text-red-600">Pagamento Negado</h2>
          <p className="text-muted-foreground">A transação não foi aprovada. Tente novamente ou use outro cartão.</p>
          <p className="text-sm text-muted-foreground">Voltando à tela inicial em {countdown}s</p>
          <Progress value={(30 - countdown) / 30 * 100} className="w-full" />
          <div className="flex space-x-2">
            <Button onClick={onRetry} variant="fresh" className="flex-1">Tentar Novamente</Button>
            <Button onClick={onCancel} variant="outline" className="flex-1">Cancelar</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

interface SuccessScreenProps {
  machine: Machine | null;
  transactionData: any;
  onReset: () => void;
}

const SUCCESS_SCREEN_SECONDS = 5;

export const SuccessScreen = ({ machine, transactionData, onReset }: SuccessScreenProps) => {
  const [countdown, setCountdown] = useState(SUCCESS_SCREEN_SECONDS);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { onReset(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onReset]);

  const estimatedEnd = new Date();
  estimatedEnd.setMinutes(estimatedEnd.getMinutes() + (machine?.duration || 0));

  return (
    <div className="min-h-screen bg-gradient-clean flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-glow">
        <CardContent className="pt-6 text-center space-y-6">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="text-white" size={24} />
          </div>
          <h2 className="text-2xl font-bold text-green-600">Pagamento Aprovado!</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              {machine?.icon && <machine.icon size={20} className={machine.type === 'lavadora' ? 'text-blue-600' : 'text-orange-600'} />}
              <p className="font-semibold">{machine?.name}</p>
            </div>
            <p className="text-muted-foreground flex items-center justify-center gap-1">
              <Clock size={14} />
              {machine?.duration} minutos — Previsão: {estimatedEnd.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
            {transactionData && (
              <div className="text-sm space-y-1 border-t pt-4">
                <p><strong>NSU:</strong> {transactionData.nsu || 'N/A'}</p>
                <p><strong>Autorização:</strong> {transactionData.autorizacao || 'N/A'}</p>
                <p><strong>Cartão:</strong> **** **** **** {transactionData.ultimosDigitos || '****'}</p>
              </div>
            )}
            <Badge variant="secondary" className="bg-green-100 text-green-800">Máquina Iniciada</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Nova transação em {countdown}s</p>
          <Progress value={(SUCCESS_SCREEN_SECONDS - countdown) / SUCCESS_SCREEN_SECONDS * 100} className="w-full" />
          <Button onClick={onReset} variant="fresh" className="w-full">Nova Transação</Button>
        </CardContent>
      </Card>
    </div>
  );
};

interface ConfirmationScreenProps {
  machine: Machine;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationScreen = ({ machine, onConfirm, onCancel }: ConfirmationScreenProps) => {
  const IconComponent = machine.icon;
  const colorClass = machine.type === 'lavadora' ? 'text-blue-600' : 'text-orange-600';
  const bgClass = machine.type === 'lavadora' ? 'bg-blue-600' : 'bg-orange-600';

  return (
    <div className="min-h-screen bg-gradient-clean flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-glow">
        <CardHeader className="text-center">
          <div className={`w-16 h-16 ${bgClass} rounded-full flex items-center justify-center mx-auto mb-4`}>
            <IconComponent className="text-white" size={24} />
          </div>
          <CardTitle className="text-xl">Confirmar Seleção</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-3">
            <p className="text-lg font-semibold">{machine.name}</p>
            <span className={`text-3xl font-bold ${colorClass}`}>
              R$ {machine.price.toFixed(2).replace('.', ',')}
            </span>
            <p className="text-muted-foreground">Duração: {machine.duration} minutos</p>
          </div>
          <Separator />
          <div className="flex space-x-3">
            <Button onClick={onCancel} variant="outline" className="flex-1">Voltar</Button>
            <Button onClick={onConfirm} variant="fresh" className="flex-1">Confirmar e Pagar</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

interface PaymentScreenProps {
  machine: Machine;
  config: UniversalPaymentConfig;
  deviceMode: string;
  onSuccess: (result: any) => void;
  onError: (error: string) => void;
  onCancel: () => void;
  onPixQR: (result: any) => void;
}

export const PaymentScreen = ({ machine, config, deviceMode, onSuccess, onError, onCancel, onPixQR }: PaymentScreenProps) => {
  const [timeLeft, setTimeLeft] = useState(120);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { onCancel(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onCancel]);

  return (
    <div className="min-h-screen bg-gradient-clean flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-glow">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <machine.icon className="text-primary-foreground" size={24} />
          </div>
          <CardTitle className="text-xl">{machine.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <span className="text-3xl font-bold text-primary">
              R$ {machine.price.toFixed(2).replace('.', ',')}
            </span>
            <p className="text-muted-foreground">Duração: {machine.duration} minutos</p>
          </div>
          <Separator />
          <UniversalPaymentWidget
            amount={machine.price}
            config={config}
            onSuccess={onSuccess}
            onError={onError}
            onCancel={onCancel}
            onPixQR={onPixQR}
            compactMode={deviceMode === 'smartpos'}
          />
          <div className="text-center text-xs text-muted-foreground">
            Tempo restante: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </div>
          <Button onClick={onCancel} variant="outline" className="w-full">Cancelar</Button>
        </CardContent>
      </Card>
    </div>
  );
};
