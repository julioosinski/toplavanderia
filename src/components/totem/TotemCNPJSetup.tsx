import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, XCircle, Loader2 } from "lucide-react";

interface TotemCNPJSetupProps {
  onConfigure: (cnpj: string) => Promise<boolean>;
}

export const TotemCNPJSetup = ({ onConfigure }: TotemCNPJSetupProps) => {
  const [cnpjInput, setCnpjInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConfigure = async () => {
    const clean = cnpjInput.replace(/\D/g, '');
    if (clean.length !== 14) {
      setError('O CNPJ deve ter exatamente 14 dígitos numéricos.');
      return;
    }
    setError('');
    setLoading(true);
    const success = await onConfigure(clean);
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
              placeholder="00000000000000 (14 dígitos)"
              value={cnpjInput}
              onChange={(e) => {
                setCnpjInput(e.target.value.replace(/\D/g, '').slice(0, 14));
                setError('');
              }}
              className="text-center text-lg tracking-widest font-mono"
              maxLength={14}
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
            disabled={loading || cnpjInput.replace(/\D/g, '').length !== 14}
          >
            {loading ? (
              <><Loader2 className="mr-2 animate-spin" size={18} /> Buscando lavanderia...</>
            ) : (
              '✅ Configurar Totem'
            )}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Exemplo: 43652666000137 (TOP LAVANDERIA SINUELO)
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
