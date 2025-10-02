import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, FileText, Trash2, Edit, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLaundry } from "@/contexts/LaundryContext";

interface AuditLog {
  id: string;
  action: string;
  table_name: string;
  record_id: string | null;
  old_values: any;
  new_values: any;
  timestamp: string;
  user_id: string | null;
}

export const AuditLogsTab = () => {
  const { currentLaundry, isSuperAdmin } = useLaundry();
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, [currentLaundry]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      console.error('Error loading audit logs:', error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "INSERT": return <Plus className="h-4 w-4" />;
      case "UPDATE": return <Edit className="h-4 w-4" />;
      case "DELETE": return <Trash2 className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "INSERT": return "bg-green-100 text-green-700";
      case "UPDATE": return "bg-blue-100 text-blue-700";
      case "DELETE": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "INSERT": return "Criado";
      case "UPDATE": return "Atualizado";
      case "DELETE": return "Excluído";
      default: return action;
    }
  };

  const formatTableName = (tableName: string) => {
    const names: Record<string, string> = {
      machines: "Máquinas",
      transactions: "Transações",
      laundries: "Lavanderias",
      user_roles: "Usuários",
      system_settings: "Configurações",
    };
    return names[tableName] || tableName;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Log de Auditoria</CardTitle>
            <CardDescription>
              Histórico de todas as ações realizadas no sistema
            </CardDescription>
          </div>
          <Button onClick={loadLogs} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">Carregando logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhum log de auditoria encontrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/5 transition-colors"
                >
                  <div className="flex items-start gap-3 flex-1">
                    <Badge className={getActionColor(log.action)}>
                      {getActionIcon(log.action)}
                      <span className="ml-1">{getActionLabel(log.action)}</span>
                    </Badge>
                    <div className="flex-1">
                      <p className="font-medium">
                        {formatTableName(log.table_name)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString('pt-BR')}
                      </p>
                      {log.record_id && (
                        <p className="text-xs text-muted-foreground mt-1">
                          ID: {log.record_id.substring(0, 8)}...
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Estatísticas de Auditoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {logs.filter(l => l.action === 'INSERT').length}
                </div>
                <div className="text-sm text-muted-foreground">Registros Criados</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {logs.filter(l => l.action === 'UPDATE').length}
                </div>
                <div className="text-sm text-muted-foreground">Registros Atualizados</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {logs.filter(l => l.action === 'DELETE').length}
                </div>
                <div className="text-sm text-muted-foreground">Registros Excluídos</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
