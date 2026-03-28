import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useLaundry } from '@/contexts/LaundryContext';
import { ShieldX } from 'lucide-react';

/**
 * Conta autenticada sem perfil de painel (ex.: role `user` ou `totem_device`).
 */
export default function NoAccess() {
  const navigate = useNavigate();
  const { userRole } = useLaundry();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="max-w-md w-full shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950">
            <ShieldX className="h-8 w-8 text-amber-700 dark:text-amber-400" />
          </div>
          <CardTitle className="text-xl">Sem acesso ao painel</CardTitle>
          <CardDescription>
            Sua conta está ativa, mas o perfil <strong>{userRole || 'atual'}</strong> não inclui o painel
            administrativo. Peça a um administrador para atribuir o perfil <em>Operador</em> ou{' '}
            <em>Administrador</em> à sua conta.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button variant="default" onClick={() => void signOut()}>
            Sair e usar outra conta
          </Button>
          <Button variant="outline" onClick={() => navigate('/totem', { replace: true })}>
            Ir para o totem (modo público)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
