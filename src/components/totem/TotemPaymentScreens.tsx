import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { CreditCard, CheckCircle, XCircle } from "lucide-react";
import type { Machine } from "@/hooks/useMachines";
import { UniversalPaymentWidget } from '@/components/payment/UniversalPaymentWidget';
import { UniversalPaymentConfig } from '@/hooks/useUniversalPayment';

interface ProcessingScreenProps {
  onCancel: () => void;
}

export const ProcessingScreen = ({ onCancel }: ProcessingScreenProps) => (
  <div className="min-h-screen bg-gradient-clean flex items-center justify-center p-4">
    <Card className="w-full max-w-md shadow-glow">
      <CardContent className="pt-6 text-center space-y-6">
        <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto animate-pulse">
          <CreditCard className="text-primary-foreground" size={24} />
        </div>
        <h2 className="text-2xl font-bold">Processando Pagamento</h2>
        <p className="text-muted-foreground">Passe ou insira o cartão na maquininha...<br />Aguarde a conclusão da transação.</p>
        <Progress value={50} className="w-full" />
        <div className="flex space-x-2">
          <Button onClick={onCancel} variant="outline" className="flex-1">Cancelar Pagamento</Button>
          <Button onClick={onCancel} variant="destructive" className="flex-1">Cancelar Tudo</Button>
        </div>
      </CardContent>
    </Card>
  </div>
);

interface ErrorScreenProps {
  onRetry: () => void;
  onCancel: () => void;
}

export const ErrorScreen = ({ onRetry, onCancel }: ErrorScreenProps) => (
  <div className="min-h-screen bg-gradient-clean flex items-center justify-center p-4">
    <Card className="w-full max-w-md shadow-glow">
      <CardContent className="pt-6 text-center space-y-6">
        <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto">
          <XCircle className="text-white" size={24} />
        </div>
        <h2 className="text-2xl font-bold text-red-600">Pagamento Negado</h2>
        <p className="text-muted-foreground">A transação não foi aprovada. Tente novamente ou use outro cartão.</p>
        <div className="flex space-x-2">
          <Button onClick={onRetry} variant="fresh" className="flex-1">Tentar Novamente</Button>
          <Button onClick={onCancel} variant="outline" className="flex-1">Cancelar</Button>
        </div>
      </CardContent>
    </Card>
  </div>
);

interface SuccessScreenProps {
  machine: Machine | null;
  transactionData: any;
  onReset: () => void;
}

export const SuccessScreen = ({ machine, transactionData, onReset }: SuccessScreenProps) => (
  <div className="min-h-screen bg-gradient-clean flex items-center justify-center p-4">
    <Card className="w-full max-w-md shadow-glow">
      <CardContent className="pt-6 text-center space-y-6">
        <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="text-white" size={24} />
        </div>
        <h2 className="text-2xl font-bold text-green-600">Pagamento Aprovado!</h2>
        <div className="space-y-2">
          <p className="font-semibold">{machine?.name}</p>
          <p className="text-muted-foreground">Tempo estimado: {machine?.duration} minutos</p>
          {transactionData && (
            <div className="text-sm space-y-1 border-t pt-4">
              <p><strong>NSU:</strong> {transactionData.nsu || 'N/A'}</p>
              <p><strong>Autorização:</strong> {transactionData.autorizacao || 'N/A'}</p>
              <p><strong>Cartão:</strong> **** **** **** {transactionData.ultimosDigitos || '****'}</p>
            </div>
          )}
          <Badge variant="secondary" className="bg-green-100 text-green-800">Máquina Iniciada</Badge>
        </div>
        <Button onClick={onReset} variant="fresh" className="w-full">Nova Transação</Button>
      </CardContent>
    </Card>
  </div>
);

interface PaymentScreenProps {
  machine: Machine;
  config: UniversalPaymentConfig;
  deviceMode: string;
  onSuccess: (result: any) => void;
  onError: (error: string) => void;
  onCancel: () => void;
  onPixQR: (result: any) => void;
}

export const PaymentScreen = ({ machine, config, deviceMode, onSuccess, onError, onCancel, onPixQR }: PaymentScreenProps) => (
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
        <Button onClick={onCancel} variant="outline" className="w-full">Cancelar</Button>
      </CardContent>
    </Card>
  </div>
);
