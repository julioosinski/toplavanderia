import { useCallback, useState, useEffect, useMemo } from "react";
import { Plus, Trash2, ShieldCheck } from "lucide-react";
import { OperatorAuthorizationDialog } from "@/components/admin/OperatorAuthorizationDialog";
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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLaundry } from "@/hooks/useLaundry";
import { useLaundryFilter } from "@/hooks/useLaundryFilter";
import {
  AppRole,
  CREATABLE_ROLES_BY_ROLE,
  RELEASE_MANAGEABLE_BY_ROLE,
  RELEASE_PERMISSION_ROLES,
  ROLE_LABELS,
} from "@/types/laundry";
import { Badge } from "@/components/ui/badge";
import { getEdgeFunctionErrorMessage } from "@/lib/edgeFunctionError";

/**
 * Cadastro de usuários da lavanderia.
 * - super_admin: qualquer perfil; dono: gerente/operador/usuário/totem; gerente: só operador.
 * - Liberação manual de máquinas: dono decide para gerentes e operadores; gerente só para operadores.
 * As mesmas regras são aplicadas no banco (RLS) e na Edge Function create-user.
 */
export const UserManagement = () => {
  const { currentLaundry, laundries, isSuperAdmin, userRole } = useLaundry();
  const { laundryId } = useLaundryFilter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<UserRoleRow[]>([]);
  const [permissions, setPermissions] = useState<Record<string, ReleasePermissionRow>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const [authDialog, setAuthDialog] = useState<{ userId: string; userName: string; laundryId: string } | null>(null);
  const [formData, setFormData] = useState<CreateUserForm>(INITIAL_FORM);

  const creatableRoles = useMemo(
    () => (userRole ? CREATABLE_ROLES_BY_ROLE[userRole] ?? [] : []),
    [userRole],
  );
  const releaseManageableRoles = useMemo(
    () => (userRole ? RELEASE_MANAGEABLE_BY_ROLE[userRole] ?? [] : []),
    [userRole],
  );

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);

      const { data: authData } = await supabase.auth.getUser();
      setCurrentUserId(authData.user?.id ?? null);

      let rolesQuery = supabase
        .from('user_roles')
        .select('id, user_id, role, laundry_id, created_at')
        .order('created_at', { ascending: false });
      if (laundryId) rolesQuery = rolesQuery.eq('laundry_id', laundryId);

      const { data: rolesData, error: rolesError } = await rolesQuery;
      if (rolesError) throw rolesError;

      if (!rolesData || rolesData.length === 0) {
        setUsers([]);
        setPermissions({});
        return;
      }

      const userIds = [...new Set(rolesData.map((r) => r.user_id))];
      const [profilesResult, permissionsResult] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name').in('user_id', userIds),
        supabase
          .from('operator_release_permissions')
          .select('user_id, laundry_id, can_release, daily_limit_cents, monthly_limit_cents')
          .in('user_id', userIds),
      ]);

      if (profilesResult.error) throw profilesResult.error;
      if (permissionsResult.error) throw permissionsResult.error;

      setUsers(
        rolesData.map((role) => ({
          ...role,
          role: role.role as AppRole,
          full_name: profilesResult.data?.find((p) => p.user_id === role.user_id)?.full_name ?? null,
        })),
      );
      setPermissions(
        Object.fromEntries(
          (permissionsResult.data ?? []).map((p) => [permissionKey(p.user_id, p.laundry_id), p]),
        ),
      );
    } catch (error: unknown) {
      console.error('Error loading users:', error);
      toast({ title: "Erro", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [laundryId, toast]);

  useEffect(() => {
    void loadUsers();
  }, [currentLaundry, loadUsers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const targetLaundryId = isSuperAdmin ? formData.laundry_id : currentLaundry?.id;
    if (formData.role !== 'super_admin' && !targetLaundryId) {
      toast({ title: "Selecione a lavanderia", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ success?: boolean; error?: string }>('create-user', {
        body: {
          email: formData.email.trim(),
          password: formData.password,
          role: formData.role,
          laundry_id: formData.role === 'super_admin' ? null : targetLaundryId,
          full_name: formData.full_name.trim() || formData.email.split('@')[0],
          ...(RELEASE_PERMISSION_ROLES.includes(formData.role) ? { can_release: formData.can_release } : {}),
        },
      });

      if (error) throw new Error(await getEdgeFunctionErrorMessage(error, 'Erro ao criar usuário'));
      if (!data?.success) throw new Error(data?.error || 'Erro ao criar usuário');

      toast({ title: "Usuário criado", description: `${ROLE_LABELS[formData.role]} adicionado com sucesso.` });
      await loadUsers();
      setOpen(false);
      setFormData(INITIAL_FORM);
    } catch (error: unknown) {
      toast({ title: "Erro", description: getErrorMessage(error) || "Falha ao criar usuário", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (row: UserRoleRow) => {
    if (!confirm(`Remover ${row.full_name || 'este usuário'} (${ROLE_LABELS[row.role]})?`)) return;

    try {
      const { data, error } = await supabase.from('user_roles').delete().eq('id', row.id).select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Você não tem permissão para remover este usuário.');

      toast({ title: "Usuário removido", description: "O acesso foi revogado." });
      await loadUsers();
    } catch (error: unknown) {
      toast({ title: "Erro", description: getErrorMessage(error), variant: "destructive" });
    }
  };

  const handleToggleRelease = async (row: UserRoleRow, nextValue: boolean) => {
    if (!row.laundry_id) return;
    const key = permissionKey(row.user_id, row.laundry_id);
    const existing = permissions[key];
    setTogglingKey(key);
    try {
      const { data, error } = await supabase
        .from('operator_release_permissions')
        .upsert(
          {
            user_id: row.user_id,
            laundry_id: row.laundry_id,
            can_release: nextValue,
            daily_limit_cents: existing?.daily_limit_cents ?? null,
            monthly_limit_cents: existing?.monthly_limit_cents ?? null,
            granted_by: currentUserId,
          },
          { onConflict: 'user_id,laundry_id' },
        )
        .select('user_id, laundry_id, can_release, daily_limit_cents, monthly_limit_cents')
        .single();
      if (error) throw error;

      setPermissions((prev) => ({ ...prev, [key]: data }));
      toast({
        title: nextValue ? "Liberação manual habilitada" : "Liberação manual desabilitada",
        description: row.full_name || ROLE_LABELS[row.role],
      });
    } catch (error: unknown) {
      toast({ title: "Erro", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setTogglingKey(null);
    }
  };

  const canManageRow = (row: UserRoleRow) =>
    row.user_id !== currentUserId && creatableRoles.includes(row.role);

  const canManageReleaseOf = (row: UserRoleRow) =>
    Boolean(row.laundry_id) &&
    row.user_id !== currentUserId &&
    releaseManageableRoles.includes(row.role);

  const getLaundryName = (laundryId?: string | null) => {
    if (!laundryId) return "Todas";
    return laundries.find((l) => l.id === laundryId)?.name || "Desconhecida";
  };

  const showReleaseSwitch = RELEASE_PERMISSION_ROLES.includes(formData.role);

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            Gerenciar Usuários
            {users.length > 0 && <Badge variant="secondary">{users.length}</Badge>}
          </CardTitle>
          <CardDescription>{getHeaderDescription(userRole, isSuperAdmin, currentLaundry?.name)}</CardDescription>
        </div>
        {creatableRoles.length > 0 && (isSuperAdmin || currentLaundry) && (
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
                <DialogDescription>Crie o acesso e defina a função e a liberação manual de máquinas.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Nome</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    maxLength={120}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    autoComplete="off"
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
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Função *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: AppRole) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger id="role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {creatableRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
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
                      <SelectTrigger id="laundry">
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
                {showReleaseSwitch && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div>
                      <Label htmlFor="can_release" className="text-sm font-medium">
                        Permitir liberação manual de máquinas
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Limites diário/mensal podem ser definidos depois no botão de escudo.
                      </p>
                    </div>
                    <Switch
                      id="can_release"
                      checked={formData.can_release}
                      onCheckedChange={(checked) => setFormData({ ...formData, can_release: checked })}
                    />
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Criando..." : "Criar"}
                  </Button>
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
                <p className="text-sm mt-1">Nenhum usuário cadastrado em {currentLaundry.name}</p>
              )}
            </div>
          ) : (
            users.map((row) => {
              const needsReleasePermission = RELEASE_PERMISSION_ROLES.includes(row.role) && Boolean(row.laundry_id);
              const key = row.laundry_id ? permissionKey(row.user_id, row.laundry_id) : '';
              const canRelease = Boolean(permissions[key]?.can_release);
              const canEditRelease = canManageReleaseOf(row);

              return (
                <div
                  key={row.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border rounded-lg gap-3"
                >
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">
                      {row.full_name || 'Usuário sem nome'}
                      {row.user_id === currentUserId && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">(você)</span>
                      )}
                    </h3>
                    <p className="text-sm text-muted-foreground">Função: {ROLE_LABELS[row.role]}</p>
                    {row.laundry_id && (
                      <p className="text-sm text-muted-foreground">Lavanderia: {getLaundryName(row.laundry_id)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {needsReleasePermission && (
                      <div className="flex items-center gap-2 rounded-md border px-2 py-1.5">
                        <Label htmlFor={`release-${row.id}`} className="text-xs whitespace-nowrap">
                          Liberação manual
                        </Label>
                        {canEditRelease ? (
                          <Switch
                            id={`release-${row.id}`}
                            checked={canRelease}
                            disabled={togglingKey === key}
                            onCheckedChange={(checked) => void handleToggleRelease(row, checked)}
                            aria-label={`Liberação manual de ${row.full_name || 'usuário'}`}
                          />
                        ) : (
                          <Badge variant={canRelease ? "default" : "outline"}>
                            {canRelease ? "Habilitada" : "Desabilitada"}
                          </Badge>
                        )}
                      </div>
                    )}
                    {needsReleasePermission && canEditRelease && (
                      <Button
                        variant="outline"
                        size="icon"
                        title="Limites de liberação"
                        aria-label="Limites de liberação"
                        onClick={() =>
                          setAuthDialog({
                            userId: row.user_id,
                            userName: row.full_name || ROLE_LABELS[row.role],
                            laundryId: row.laundry_id!,
                          })
                        }
                      >
                        <ShieldCheck className="h-4 w-4" />
                      </Button>
                    )}
                    {canManageRow(row) && (
                      <Button
                        variant="outline"
                        size="icon"
                        title="Remover acesso"
                        aria-label="Remover acesso"
                        onClick={() => void handleDelete(row)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        {authDialog && (
          <OperatorAuthorizationDialog
            open={!!authDialog}
            onOpenChange={(o) => {
              if (!o) {
                setAuthDialog(null);
                void loadUsers();
              }
            }}
            userId={authDialog.userId}
            userName={authDialog.userName}
            laundryId={authDialog.laundryId}
          />
        )}
      </CardContent>
    </Card>
  );
};

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : "Erro desconhecido";
};

const permissionKey = (userId: string, laundryId: string) => `${userId}:${laundryId}`;

const getHeaderDescription = (role: AppRole | null, isSuperAdmin: boolean, laundryName?: string) => {
  if (isSuperAdmin) {
    return laundryName ? `Mostrando usuários de: ${laundryName}` : "Mostrando todos os usuários do sistema";
  }
  if (role === 'manager') return "Cadastre operadores e defina quem pode liberar máquinas manualmente";
  return "Cadastre gerentes e operadores e defina quem pode liberar máquinas manualmente";
};

const INITIAL_FORM: CreateUserForm = {
  full_name: "",
  email: "",
  password: "",
  role: "operator",
  laundry_id: "",
  can_release: false,
};

interface UserRoleRow {
  id: string;
  user_id: string;
  role: AppRole;
  laundry_id: string | null;
  created_at: string | null;
  full_name: string | null;
}

interface ReleasePermissionRow {
  user_id: string;
  laundry_id: string;
  can_release: boolean;
  daily_limit_cents: number | null;
  monthly_limit_cents: number | null;
}

interface CreateUserForm {
  full_name: string;
  email: string;
  password: string;
  role: AppRole;
  laundry_id: string;
  can_release: boolean;
}
