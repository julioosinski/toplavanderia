import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AdminPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthenticate: (pin: string) => boolean;
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
  const { toast } = useToast();

  const maxAttempts = 3;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pin.trim()) {
      toast({
        title: "PIN Obrigatório",
        description: "Digite o PIN de administrador",
        variant: "destructive"
      });
      return;
    }

    const isValid = onAuthenticate(pin);
    
    if (isValid) {
      setPin("");
      setAttempts(0);
      onOpenChange(false);
      toast({
        title: "Acesso Autorizado",
        description: "Bem-vindo, administrador",
      });
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setPin("");
      
      if (newAttempts >= maxAttempts) {
        onOpenChange(false);
        setAttempts(0);
        toast({
          title: "Acesso Bloqueado",
          description: "Muitas tentativas incorretas. Tente novamente mais tarde.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "PIN Incorreto",
          description: `Tentativa ${newAttempts} de ${maxAttempts}`,
          variant: "destructive"
        });
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
          <DialogDescription className="text-center">
            {description}
          </DialogDescription>
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
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPin(!showPin)}
              >
                {showPin ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {attempts > 0 && (
            <div className="text-sm text-destructive text-center">
              Tentativa {attempts} de {maxAttempts}
            </div>
          )}

          <div className="flex space-x-2">
            <Button type="submit" variant="fresh" className="flex-1">
              Autenticar
            </Button>
            <Button type="button" variant="outline" onClick={handleCancel} className="flex-1">
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};