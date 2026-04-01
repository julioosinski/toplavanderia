import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CreditCard, CheckCircle, XCircle, Clock } from "lucide-react";
import type { Machine } from "@/hooks/useMachines";
import { UniversalPaymentWidget } from '@/components/payment/UniversalPaymentWidget';
import { UniversalPaymentConfig } from '@/hooks/useUniversalPayment';

interface ProcessingScreenProps {
  onCancel: () => void;
  variant?: 'payment' | 'activating';
}

export const ProcessingScreen = ({ onCancel, variant = 'payment' }: ProcessingScreenProps) => {
  const isActivating = variant === 'activating';
  return (
    <div className="h-screen flex items-center justify-center p-4 bg-white">
      <div className="text-center space-y-4 max-w-sm w-full">
        <div className="w-14 h-14 bg-primary rounded-full flex items-center justify-center mx-auto animate-pulse">
          <CreditCard className="text-primary-foreground" size={22} />
        </div>
        <h2 className="text-xl font-bold">
          {isActivating ? 'Ativando máquina…' : 'Processando Pagamento…'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isActivating
            ? 'Registrando o pagamento e enviando o comando ao equipamento.'
            : 'Passe ou insira o cartão na maquininha. Aguarde a conclusão.'}
        </p>
        <Progress value={50} className="w-full h-2" />
        <Button onClick={onCancel} variant="outline" className="w-full">
          {isActivating ? 'Voltar ao início' : 'Cancelar'}
        </Button>
      </div>
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
    <div className="h-screen flex items-center justify-center p-4 bg-white">
      <div className="text-center space-y-4 max-w-sm w-full">
        <div className="w-14 h-14 bg-destructive rounded-full flex items-center justify-center mx-auto">
          <XCircle className="text-white" size={22} />
        </div>
        <h2 className="text-xl font-bold text-destructive">Pagamento Negado</h2>
        <p className="text-sm text-muted-foreground">Transação não aprovada. Tente novamente ou use outro cartão.</p>
        <p className="text-xs text-muted-foreground">Voltando em {countdown}s</p>
        <Progress value={(30 - countdown) / 30 * 100} className="w-full h-2" />
        <div className="flex gap-2">
          <Button onClick={onRetry} className="flex-1">Tentar Novamente</Button>
          <Button onClick={onCancel} variant="outline" className="flex-1">Cancelar</Button>
        </div>
      </div>
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
    <div className="h-screen flex items-center justify-center p-4 bg-white">
      <div className="text-center space-y-3 max-w-sm w-full">
        <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="text-white" size={22} />
        </div>
        <h2 className="text-xl font-bold text-green-600">Pagamento Aprovado!</h2>
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2">
            {machine?.icon && <machine.icon size={18} className={machine.type === 'lavadora' ? 'text-blue-600' : 'text-orange-600'} />}
            <p className="font-semibold">{machine?.name}</p>
          </div>
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
            <Clock size={12} />
            {machine?.duration} min — Previsão: {estimatedEnd.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
          {transactionData && (
            <div className="text-xs space-y-0.5 border-t pt-2 mt-2">
              <p><strong>NSU:</strong> {transactionData.nsu || 'N/A'}</p>
              <p><strong>Autorização:</strong> {transactionData.autorizacao || 'N/A'}</p>
              <p><strong>Cartão:</strong> **** {transactionData.ultimosDigitos || '****'}</p>
            </div>
          )}
          <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">Máquina Iniciada</Badge>
        </div>
        <p className="text-xs text-muted-foreground">Nova transação em {countdown}s</p>
        <Progress value={(SUCCESS_SCREEN_SECONDS - countdown) / SUCCESS_SCREEN_SECONDS * 100} className="w-full h-2" />
        <Button onClick={onReset} className="w-full">Nova Transação</Button>
      </div>
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
    <div className="h-screen flex items-center justify-center p-4 bg-white">
      <div className="text-center space-y-4 max-w-sm w-full">
        <div className={`w-14 h-14 ${bgClass} rounded-full flex items-center justify-center mx-auto`}>
          <IconComponent className="text-white" size={22} />
        </div>
        <h2 className="text-lg font-bold">Confirmar Seleção</h2>
        <div className="space-y-2">
          <p className="font-semibold">{machine.name}</p>
          <span className={`text-2xl font-bold ${colorClass}`}>
            R$ {machine.price.toFixed(2).replace('.', ',')}
          </span>
          <p className="text-sm text-muted-foreground">Duração: {machine.duration} minutos</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onCancel} variant="outline" className="flex-1">Voltar</Button>
          <Button onClick={onConfirm} className="flex-1">Confirmar e Pagar</Button>
        </div>
      </div>
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
    <div className="h-screen flex flex-col bg-white">
      {/* Compact header with machine info */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <machine.icon className="text-white" size={20} />
          </div>
          <div>
            <h2 className="font-bold text-base">{machine.name}</h2>
            <p className="text-blue-100 text-xs">{machine.duration} min</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xl font-bold">R$ {machine.price.toFixed(2).replace('.', ',')}</span>
          <p className="text-blue-100 text-xs">
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </p>
        </div>
      </div>

      {/* Payment widget - fills remaining space */}
      <div className="flex-1 overflow-auto p-4 flex flex-col justify-center">
        <div className="max-w-md mx-auto w-full space-y-4">
          <UniversalPaymentWidget
            amount={machine.price}
            config={config}
            onSuccess={onSuccess}
            onError={onError}
            onCancel={onCancel}
            onPixQR={onPixQR}
            compactMode={deviceMode === 'smartpos'}
          />
        </div>
      </div>

      {/* Cancel button pinned at bottom */}
      <div className="px-4 pb-3 shrink-0">
        <Button onClick={onCancel} variant="outline" className="w-full">Cancelar</Button>
      </div>
    </div>
  );
};
