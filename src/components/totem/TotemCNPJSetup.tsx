import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, XCircle, Loader2 } from "lucide-react";

interface TotemCNPJSetupProps {
  onConfigure: (cnpj: string) => Promise<boolean>;
}

const formatCNPJ = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
};

export const TotemCNPJSetup = ({ onConfigure }: TotemCNPJSetupProps) => {
  const [cnpjInput, setCnpjInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const cleanDigits = cnpjInput.replace(/\D/g, '');

  const handleConfigure = async () => {
    if (cleanDigits.length !== 14) {
      setError('O CNPJ deve ter exatamente 14 dígitos numéricos.');
      return;
    }
    setError('');
    setLoading(true);
    const success = await onConfigure(cleanDigits);
    setLoading(false);
    if (!success) {
      setError('CNPJ não encontrado ou lavanderia inativa. Verifique e tente novamente.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center space-y-3">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto">
            <Settings className="text-white" size={28} />
          </div>
          <CardTitle className="text-2xl">🧺 Configuração Inicial</CardTitle>
          <p className="text-muted-foreground text-sm">
            Digite o CNPJ da lavanderia para configurar este totem.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">CNPJ da Lavanderia</label>
            <Input
              placeholder="00.000.000/0000-00"
              value={formatCNPJ(cnpjInput)}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, '').slice(0, 14);
                setCnpjInput(raw);
                setError('');
              }}
              className="text-center text-lg tracking-widest font-mono"
              maxLength={18}
              inputMode="numeric"
              disabled={loading}
            />
            {error && (
              <p className="text-destructive text-sm flex items-center gap-1">
                <XCircle size={14} />{error}
              </p>
            )}
          </div>
          <Button
            className="w-full"
            size="lg"
            onClick={handleConfigure}
            disabled={loading || cleanDigits.length !== 14}
          >
            {loading ? (
              <><Loader2 className="mr-2 animate-spin" size={18} /> Buscando lavanderia...</>
            ) : (
              '✅ Configurar Totem'
            )}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Exemplo: 43.652.666/0001-37 (TOP LAVANDERIA SINUELO)
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
