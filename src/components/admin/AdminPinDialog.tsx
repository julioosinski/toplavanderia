import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Eye, EyeOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AdminPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthenticate: (pin: string) => Promise<boolean>;
  title?: string;
  description?: string;
}

export const AdminPinDialog = ({
  open,
  onOpenChange,
  onAuthenticate,
  title = "Acesso Administrativo",
  description = "Digite o PIN de administrador para continuar"
}: AdminPinDialogProps) => {
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const maxAttempts = 3;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pin.trim()) {
      toast({ title: "PIN Obrigatório", description: "Digite o PIN de administrador", variant: "destructive" });
      return;
    }

    setLoading(true);
    const isValid = await onAuthenticate(pin);
    setLoading(false);
    
    if (isValid) {
      setPin("");
      setAttempts(0);
      onOpenChange(false);
      toast({ title: "Acesso Autorizado", description: "Bem-vindo, administrador" });
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setPin("");
      
      if (newAttempts >= maxAttempts) {
        onOpenChange(false);
        setAttempts(0);
        toast({ title: "Acesso Bloqueado", description: "Muitas tentativas incorretas. Tente novamente mais tarde.", variant: "destructive" });
      } else {
        toast({ title: "PIN Incorreto", description: `Tentativa ${newAttempts} de ${maxAttempts}`, variant: "destructive" });
      }
    }
  };

  const handleCancel = () => {
    setPin("");
    setAttempts(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center">
              <Shield className="text-primary-foreground" size={24} />
            </div>
          </div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">{description}</DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-pin">PIN de Administrador</Label>
            <div className="relative">
              <Input
                id="admin-pin"
                type={showPin ? "text" : "password"}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Digite o PIN"
                maxLength={10}
                className="pr-10"
                autoComplete="off"
                autoFocus
                disabled={loading}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPin(!showPin)}
              >
                {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {attempts > 0 && (
            <div className="text-sm text-destructive text-center">
              Tentativa {attempts} de {maxAttempts}
            </div>
          )}

          <div className="flex space-x-2">
            <Button type="submit" variant="fresh" className="flex-1" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Validando...</> : 'Autenticar'}
            </Button>
            <Button type="button" variant="outline" onClick={handleCancel} className="flex-1" disabled={loading}>
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
