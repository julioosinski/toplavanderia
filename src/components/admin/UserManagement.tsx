import { useState, useEffect } from "react";
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
import { AppRole, Laundry } from "@/types/laundry";

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

export const UserManagement = () => {
  const { currentLaundry, laundries, isSuperAdmin } = useLaundry();
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

  useEffect(() => {
    loadUsers();
  }, [currentLaundry]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      // Buscar user_roles
      let rolesQuery = supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: false });

      // Se não é super admin, filtra apenas usuários da lavanderia atual
      if (!isSuperAdmin && currentLaundry) {
        rolesQuery = rolesQuery.eq('laundry_id', currentLaundry.id);
      }

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
    } catch (error: any) {
      console.error('Error loading users:', error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Criar usuário no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.email.split('@')[0],
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Usuário não foi criado");

      // Aguardar um pouco para o trigger criar o perfil
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Criar role do usuário
      const roleData: any = {
        user_id: authData.user.id,
        role: formData.role,
      };

      // Se não for super_admin, adiciona laundry_id
      if (formData.role !== 'super_admin') {
        roleData.laundry_id = isSuperAdmin ? formData.laundry_id : currentLaundry?.id;
      }

      const { error: roleError } = await supabase
        .from('user_roles')
        .insert([roleData]);

      if (roleError) throw roleError;

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
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
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
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
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
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Gerenciar Usuários</CardTitle>
          <CardDescription>
            {isSuperAdmin 
              ? "Adicione, edite ou remova usuários do sistema" 
              : "Visualize os usuários da sua lavanderia"}
          </CardDescription>
        </div>
        {isSuperAdmin && (
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
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                    )}
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="operator">Operador</SelectItem>
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
            <p className="text-center text-muted-foreground py-8">
              Carregando usuários...
            </p>
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum usuário cadastrado
            </p>
          ) : (
            users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 border rounded-lg"
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
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleDelete(user.user_id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
