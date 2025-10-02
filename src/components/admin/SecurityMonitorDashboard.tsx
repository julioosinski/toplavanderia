import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Shield, Activity, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AuditLog {
  id: string;
  action: string;
  table_name: string;
  timestamp: string;
  old_values?: any;
  new_values?: any;
}

interface SecurityEvent {
  id: string;
  event_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  resolved: boolean;
  details?: any;
}

export const SecurityMonitorDashboard = () => {
  const [selectedTab, setSelectedTab] = useState('events');

  // Query para security events
  const { data: securityEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ['security-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('security_events')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as SecurityEvent[];
    },
    refetchInterval: 30000, // Refresh a cada 30 segundos
  });

  // Query para audit logs
  const { data: auditLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as AuditLog[];
    },
  });

  // Resolver evento de segurança
  const resolveSecurityEvent = async (eventId: string) => {
    const { error } = await supabase
      .from('security_events')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', eventId);

    if (!error) {
      // Invalidar query para recarregar
    }
  };

  // Estatísticas de eventos
  const eventStats = securityEvents
    ? {
        total: securityEvents.length,
        critical: securityEvents.filter((e) => e.severity === 'critical').length,
        high: securityEvents.filter((e) => e.severity === 'high').length,
        unresolved: securityEvents.filter((e) => !e.resolved).length,
      }
    : { total: 0, critical: 0, high: 0, unresolved: 0 };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getEventTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      failed_login: 'Falha de Login',
      suspicious_payment: 'Pagamento Suspeito',
      unauthorized_access: 'Acesso Não Autorizado',
      device_change: 'Mudança de Dispositivo',
      rate_limit_exceeded: 'Limite de Taxa Excedido',
      invalid_pin_attempt: 'Tentativa de PIN Inválido',
    };
    return labels[type] || type;
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      INSERT: 'Criação',
      UPDATE: 'Atualização',
      DELETE: 'Exclusão',
    };
    return labels[action] || action;
  };

  return (
    <div className="space-y-6">
      {/* Resumo de Estatísticas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Eventos</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{eventStats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eventos Críticos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{eventStats.critical}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alta Prioridade</CardTitle>
            <Shield className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{eventStats.high}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Não Resolvidos</CardTitle>
            <XCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{eventStats.unresolved}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs para Eventos e Logs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="events">Eventos de Segurança</TabsTrigger>
          <TabsTrigger value="audit">Logs de Auditoria</TabsTrigger>
        </TabsList>

        {/* Eventos de Segurança */}
        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Eventos de Segurança Recentes</CardTitle>
              <CardDescription>
                Monitore eventos de segurança críticos e tome ações imediatas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {eventsLoading ? (
                <div className="text-center py-8">Carregando eventos...</div>
              ) : securityEvents && securityEvents.length > 0 ? (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {securityEvents.map((event) => (
                      <Card key={event.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant={getSeverityColor(event.severity)}>
                                {event.severity.toUpperCase()}
                              </Badge>
                              <span className="font-medium">
                                {getEventTypeLabel(event.event_type)}
                              </span>
                              {event.resolved && (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(event.timestamp), "PPp", { locale: ptBR })}
                            </p>
                            {event.details && (
                              <div className="text-xs bg-muted p-2 rounded">
                                <pre>{JSON.stringify(event.details, null, 2)}</pre>
                              </div>
                            )}
                          </div>
                          {!event.resolved && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resolveSecurityEvent(event.id)}
                            >
                              Resolver
                            </Button>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum evento de segurança registrado
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs de Auditoria */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Logs de Auditoria</CardTitle>
              <CardDescription>
                Histórico completo de alterações no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="text-center py-8">Carregando logs...</div>
              ) : auditLogs && auditLogs.length > 0 ? (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {auditLogs.map((log) => (
                      <Card key={log.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{getActionLabel(log.action)}</Badge>
                              <span className="text-sm font-medium">{log.table_name}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(log.timestamp), "PPp", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum log de auditoria registrado
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
