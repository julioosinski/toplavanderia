import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLaundry } from "@/contexts/LaundryContext";
import { Laundry, AppRole } from "@/types/laundry";

export const LaundryManagement = () => {
  const { laundries, refreshLaundries, isSuperAdmin } = useLaundry();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editingLaundry, setEditingLaundry] = useState<Laundry | null>(null);
  const [currentTab, setCurrentTab] = useState("info");
  const [formData, setFormData] = useState({
    name: "",
    cnpj: "",
    address: "",
    city: "",
    state: "",
    phone: "",
    email: "",
  });
  const [adminData, setAdminData] = useState({
    email: "",
    password: "",
    fullName: "",
  });
  const [laundryAdmins, setLaundryAdmins] = useState<any[]>([]);

  // Proteção: apenas super admins podem usar este componente
  if (!isSuperAdmin) {
    return null;
  }

  const resetForm = () => {
    setFormData({
      name: "",
      cnpj: "",
      address: "",
      city: "",
      state: "",
      phone: "",
      email: "",
    });
    setAdminData({
      email: "",
      password: "",
      fullName: "",
    });
    setEditingLaundry(null);
    setCurrentTab("info");
  };

  const handleEdit = async (laundry: Laundry) => {
    setEditingLaundry(laundry);
    setFormData({
      name: laundry.name,
      cnpj: laundry.cnpj,
      address: laundry.address || "",
      city: laundry.city || "",
      state: laundry.state || "",
      phone: laundry.phone || "",
      email: laundry.email || "",
    });

    // Carregar administradores da lavanderia
    await loadLaundryAdmins(laundry.id);
    setOpen(true);
  };

  const loadLaundryAdmins = async (laundryId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          id,
          user_id,
          role,
          profiles:user_id (
            full_name,
            user_id
          )
        `)
        .eq('laundry_id', laundryId)
        .eq('role', 'admin');

      if (error) throw error;

      // Buscar emails dos usuários
      const adminsWithEmails = await Promise.all(
        (data || []).map(async (admin: any) => {
          const { data: authData } = await supabase.auth.admin.getUserById(admin.user_id);
          return {
            ...admin,
            email: authData?.user?.email || 'N/A',
          };
        })
      );

      setLaundryAdmins(adminsWithEmails);
    } catch (error) {
      console.error('Erro ao carregar admins:', error);
    }
  };

  const handleSubmitLaundry = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingLaundry) {
        const { error } = await supabase
          .from('laundries')
          .update(formData)
          .eq('id', editingLaundry.id);

        if (error) throw error;

        toast({
          title: "Lavanderia atualizada",
          description: "As informações foram atualizadas com sucesso.",
        });
      } else {
        const { data: newLaundry, error } = await supabase
          .from('laundries')
          .insert([formData])
          .select()
          .single();

        if (error) throw error;

        toast({
          title: "Lavanderia criada",
          description: "Nova lavanderia adicionada com sucesso.",
        });

        setEditingLaundry(newLaundry);
        setCurrentTab("admins");
      }

      await refreshLaundries();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingLaundry) {
      toast({
        title: "Erro",
        description: "Salve a lavanderia antes de adicionar administradores.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Criar usuário
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: adminData.email,
        password: adminData.password,
        options: {
          data: {
            full_name: adminData.fullName,
          },
        },
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error("Erro ao criar usuário");
      }

      // Criar role de admin
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: 'admin' as AppRole,
          laundry_id: editingLaundry.id,
        });

      if (roleError) throw roleError;

      toast({
        title: "Administrador criado",
        description: "Novo administrador adicionado com sucesso.",
      });

      setAdminData({
        email: "",
        password: "",
        fullName: "",
      });

      await loadLaundryAdmins(editingLaundry.id);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteAdmin = async (userId: string) => {
    if (!confirm("Tem certeza que deseja remover este administrador?")) return;

    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('laundry_id', editingLaundry?.id);

      if (error) throw error;

      toast({
        title: "Administrador removido",
        description: "O administrador foi removido com sucesso.",
      });

      if (editingLaundry) {
        await loadLaundryAdmins(editingLaundry.id);
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja desativar esta lavanderia?")) return;

    try {
      const { error } = await supabase
        .from('laundries')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Lavanderia desativada",
        description: "A lavanderia foi desativada com sucesso.",
      });

      await refreshLaundries();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Gerenciar Lavanderias</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Lavanderia
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingLaundry ? "Editar Lavanderia" : "Nova Lavanderia"}
              </DialogTitle>
              <DialogDescription>
                {currentTab === "info" 
                  ? "Preencha os dados da lavanderia" 
                  : "Gerencie os administradores da lavanderia"}
              </DialogDescription>
            </DialogHeader>

            <Tabs value={currentTab} onValueChange={setCurrentTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="info">Dados da Lavanderia</TabsTrigger>
                <TabsTrigger value="admins" disabled={!editingLaundry}>
                  Administradores
                </TabsTrigger>
              </TabsList>

              <TabsContent value="info">
                <form onSubmit={handleSubmitLaundry} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ *</Label>
                    <Input
                      id="cnpj"
                      value={formData.cnpj}
                      onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Endereço</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">Cidade</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">Estado</Label>
                      <Input
                        id="state"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setOpen(false);
                        resetForm();
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit">
                      {editingLaundry ? "Salvar" : "Criar e Continuar"}
                    </Button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="admins" className="space-y-4">
                {/* Formulário para adicionar admin */}
                <form onSubmit={handleAddAdmin} className="space-y-4 p-4 border rounded-lg">
                  <h4 className="font-semibold">Adicionar Administrador</h4>
                  <div className="space-y-2">
                    <Label htmlFor="adminName">Nome Completo *</Label>
                    <Input
                      id="adminName"
                      value={adminData.fullName}
                      onChange={(e) => setAdminData({ ...adminData, fullName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adminEmail">E-mail *</Label>
                    <Input
                      id="adminEmail"
                      type="email"
                      value={adminData.email}
                      onChange={(e) => setAdminData({ ...adminData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adminPassword">Senha Temporária *</Label>
                    <Input
                      id="adminPassword"
                      type="password"
                      value={adminData.password}
                      onChange={(e) => setAdminData({ ...adminData, password: e.target.value })}
                      required
                      minLength={6}
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    <Users className="mr-2 h-4 w-4" />
                    Criar Administrador
                  </Button>
                </form>

                {/* Lista de admins existentes */}
                <div className="space-y-2">
                  <h4 className="font-semibold">Administradores Atuais</h4>
                  {laundryAdmins.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum administrador cadastrado
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {laundryAdmins.map((admin) => (
                        <div
                          key={admin.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div>
                            <p className="font-medium">{admin.profiles?.full_name || 'Sem nome'}</p>
                            <p className="text-sm text-muted-foreground">{admin.email}</p>
                          </div>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleDeleteAdmin(admin.user_id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setOpen(false);
                      resetForm();
                    }}
                  >
                    Fechar
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {laundries.map((laundry) => (
            <div
              key={laundry.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div>
                <h3 className="font-semibold">{laundry.name}</h3>
                <p className="text-sm text-muted-foreground">CNPJ: {laundry.cnpj}</p>
                {laundry.city && laundry.state && (
                  <p className="text-sm text-muted-foreground">
                    {laundry.city}, {laundry.state}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleEdit(laundry)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleDelete(laundry.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {laundries.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma lavanderia cadastrada
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
