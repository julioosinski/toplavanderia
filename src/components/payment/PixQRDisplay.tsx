import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { QrCode, Copy, Clock, Smartphone, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import QRCodeLib from 'qrcode';

interface PixQRDisplayProps {
  qrCode: string;
  qrCodeBase64?: string;
  pixKey?: string;
  amount: number;
  timeRemaining: number;
  totalTime: number;
  onCancel: () => void;
  onCopyCode: () => void;
}

export const PixQRDisplay: React.FC<PixQRDisplayProps> = ({
  qrCode,
  qrCodeBase64,
  pixKey,
  amount,
  timeRemaining,
  totalTime,
  onCancel,
  onCopyCode,
}) => {
  const { toast } = useToast();
  const [generatedQR, setGeneratedQR] = useState<string>('');
  
  const progressPercentage = ((totalTime - timeRemaining) / totalTime) * 100;
  const isExpiringSoon = timeRemaining <= 30;

  // Generate QR code if not provided
  useEffect(() => {
    if (!qrCodeBase64 && qrCode) {
      QRCodeLib.toDataURL(qrCode, {
        width: 192,
        margin: 2,
        color: {
          dark: '#000',
          light: '#FFF',
        },
      })
        .then(url => setGeneratedQR(url))
        .catch(err => console.error('Error generating QR code:', err));
    }
  }, [qrCode, qrCodeBase64]);

  const handleCopyQR = () => {
    navigator.clipboard.writeText(qrCode);
    onCopyCode();
    toast({
      title: "Código copiado!",
      description: "O código Pix foi copiado para a área de transferência.",
    });
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-clean flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-glow">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <QrCode className="text-primary-foreground" size={24} />
          </div>
          <CardTitle className="text-xl">Pagamento Pix</CardTitle>
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            R$ {amount.toFixed(2).replace('.', ',')}
          </Badge>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Timer */}
          <div className={`text-center space-y-2 ${isExpiringSoon ? 'text-red-600' : ''}`}>
            <div className="flex items-center justify-center space-x-2">
              <Clock size={16} />
              <span className="text-lg font-bold">
                {formatTime(timeRemaining)}
              </span>
            </div>
            <Progress 
              value={progressPercentage} 
              className={`w-full ${isExpiringSoon ? 'bg-red-100' : ''}`}
            />
            {isExpiringSoon && (
              <div className="flex items-center justify-center space-x-1 text-red-600 text-xs">
                <AlertCircle size={12} />
                <span>QR Code expirando em breve!</span>
              </div>
            )}
          </div>

          {/* QR Code Display */}
          <div className="text-center space-y-4">
            <div className="bg-white p-6 rounded-lg shadow-sm border mx-auto inline-block">
              {qrCodeBase64 ? (
                <img 
                  src={`data:image/png;base64,${qrCodeBase64}`} 
                  alt="QR Code Pix" 
                  className="w-48 h-48 mx-auto"
                />
              ) : generatedQR ? (
                <img 
                  src={generatedQR} 
                  alt="QR Code Pix" 
                  className="w-48 h-48 mx-auto"
                />
              ) : (
                <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                  <QrCode size={64} className="text-gray-400" />
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                <Smartphone size={14} />
                <span>Escaneie o QR Code com seu app de pagamento</span>
              </div>

              {/* Copy QR Code Button */}
              <Button 
                onClick={handleCopyQR}
                variant="outline" 
                size="sm"
                className="w-full"
              >
                <Copy className="mr-2" size={14} />
                Copiar Código Pix
              </Button>

              {pixKey && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Chave Pix:</span> {pixKey}
                </div>
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 rounded-lg p-4 text-sm">
            <h4 className="font-semibold text-blue-900 mb-2">Como pagar:</h4>
            <ol className="list-decimal list-inside space-y-1 text-blue-800">
              <li>Abra o app do seu banco</li>
              <li>Escolha a opção "Pix"</li>
              <li>Escaneie o QR Code ou cole o código</li>
              <li>Confirme o pagamento</li>
            </ol>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <Button 
              onClick={onCancel} 
              variant="outline" 
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button 
              variant="secondary" 
              className="flex-1"
              disabled
            >
              Aguardando...
            </Button>
          </div>

          {/* Status Message */}
          <div className="text-center text-xs text-muted-foreground">
            Aguardando confirmação do pagamento Pix...
          </div>
        </CardContent>
      </Card>
    </div>
  );
};