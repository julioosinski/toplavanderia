import { useCallback, useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLaundry } from "@/contexts/LaundryContext";
import { useLaundryFilter } from "@/hooks/useLaundryFilter";
import { AppRole, Laundry } from "@/types/laundry";
import { Badge } from "@/components/ui/badge";

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  laundry_id?: string;
  created_at: string;
  profiles?: {
    full_name: string | null;
  };
}

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : "Erro desconhecido";
};

export const UserManagement = () => {
  const { currentLaundry, laundries, isSuperAdmin } = useLaundry();
  const { laundryId, laundryName, addFilter } = useLaundryFilter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    role: "operator" as AppRole,
    laundry_id: "",
  });

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      
      // Buscar user_roles com filtro pela lavanderia selecionada
      let rolesQuery = supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: false });

      // Se há uma lavanderia selecionada, filtra por ela (super admin ou não)
      rolesQuery = addFilter(rolesQuery);

      const { data: rolesData, error: rolesError } = await rolesQuery;
      if (rolesError) throw rolesError;

      // Buscar profiles para cada user_role
      if (rolesData && rolesData.length > 0) {
        const userIds = rolesData.map(r => r.user_id);
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);

        if (profilesError) throw profilesError;

        // Combinar os dados
        const usersWithProfiles = rolesData.map(role => ({
          ...role,
          profiles: profilesData?.find(p => p.user_id === role.user_id) || { full_name: null }
        }));

        setUsers(usersWithProfiles);
      } else {
        setUsers([]);
      }
    } catch (error: unknown) {
      console.error('Error loading users:', error);
      toast({
        title: "Erro",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [addFilter, toast]);

  useEffect(() => {
    loadUsers();
  }, [currentLaundry, loadUsers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      console.log('🔵 Iniciando criação de usuário via edge function...');
      
      // Obter token de autenticação atual
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão não encontrada");

      console.log('🔵 Sessão obtida, chamando edge function...');

      // Chamar edge function para criar usuário (não causa logout)
      const response = await fetch('https://rkdybjzwiwwqqzjfmerm.supabase.co/functions/v1/create-user', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          role: formData.role,
          laundry_id: isSuperAdmin ? formData.laundry_id : currentLaundry?.id,
          full_name: formData.email.split('@')[0],
        }),
      });

      console.log('🔵 Response status:', response.status);

      const result = (await response.json()) as { error?: string };
      console.log('🔵 Response data:', result);

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar usuário');
      }

      toast({
        title: "Usuário criado",
        description: "Novo usuário adicionado com sucesso.",
      });

      await loadUsers();
      setOpen(false);
      setFormData({
        email: "",
        password: "",
        role: "operator",
        laundry_id: "",
      });
    } catch (error: unknown) {
      console.error('🔴 Error creating user:', error);
      toast({
        title: "Erro",
        description: getErrorMessage(error) || "Falha ao criar usuário",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Tem certeza que deseja remover este usuário?")) return;

    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Usuário removido",
        description: "O usuário foi removido com sucesso.",
      });

      await loadUsers();
    } catch (error: unknown) {
      toast({
        title: "Erro",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const getRoleLabel = (role: AppRole) => {
    const labels: Record<AppRole, string> = {
      super_admin: "Super Admin",
      admin: "Administrador",
      operator: "Operador",
      user: "Usuário",
      totem_device: "Totem",
    };
    return labels[role];
  };

  const getLaundryName = (laundryId?: string) => {
    if (!laundryId) return "Todas";
    const laundry = laundries.find(l => l.id === laundryId);
    return laundry?.name || "Desconhecida";
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            Gerenciar Usuários
            {users.length > 0 && (
              <Badge variant="secondary">
                {users.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {isSuperAdmin 
              ? currentLaundry
                ? `Mostrando usuários de: ${currentLaundry.name}`
                : "Mostrando todos os usuários do sistema"
              : "Adicione operadores e usuários da sua lavanderia"}
          </CardDescription>
        </div>
        {(isSuperAdmin || currentLaundry) && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Usuário
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Usuário</DialogTitle>
              <DialogDescription>
                Crie um novo usuário e atribua suas permissões
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Função *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: AppRole) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {isSuperAdmin && (
                      <>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </>
                    )}
                    <SelectItem value="operator">Operador</SelectItem>
                    <SelectItem value="user">Usuário</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isSuperAdmin && formData.role !== 'super_admin' && (
                <div className="space-y-2">
                  <Label htmlFor="laundry">Lavanderia *</Label>
                  <Select
                    value={formData.laundry_id}
                    onValueChange={(value) => setFormData({ ...formData, laundry_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a lavanderia" />
                    </SelectTrigger>
                    <SelectContent>
                      {laundries.map((laundry) => (
                        <SelectItem key={laundry.id} value={laundry.id}>
                          {laundry.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">Criar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-pulse space-y-3">
                <div className="h-16 bg-muted rounded-lg"></div>
                <div className="h-16 bg-muted rounded-lg"></div>
                <div className="h-16 bg-muted rounded-lg"></div>
              </div>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p className="font-medium">Nenhum usuário encontrado</p>
              {currentLaundry && (
                <p className="text-sm mt-1">
                  Nenhum usuário cadastrado em {currentLaundry.name}
                </p>
              )}
            </div>
          ) : (
            users.map((user) => (
                <div
                key={user.id}
                className="flex items-center justify-between p-3 sm:p-4 border rounded-lg gap-2"
              >
                <div>
                  <h3 className="font-semibold">
                    {user.profiles?.full_name || 'Usuário sem nome'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Função: {getRoleLabel(user.role)}
                  </p>
                  {user.laundry_id && (
                    <p className="text-sm text-muted-foreground">
                      Lavanderia: {getLaundryName(user.laundry_id)}
                    </p>
                  )}
                </div>
                {(isSuperAdmin || (currentLaundry && user.role !== 'admin' && user.role !== 'super_admin')) && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleDelete(user.user_id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
