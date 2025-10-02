import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle, Shield, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLaundry } from "@/contexts/LaundryContext";

interface SecurityEvent {
  id: string;
  event_type: string;
  severity: string;
  user_id: string | null;
  device_uuid: string | null;
  details: any;
  resolved: boolean;
  resolved_at: string | null;
  timestamp: string;
}

export const SecurityEventsTab = () => {
  const { currentLaundry, isAdmin } = useLaundry();
  const { toast } = useToast();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) {
      loadEvents();
    }
  }, [currentLaundry, isAdmin]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('security_events')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) throw error;
      setEvents(data || []);
    } catch (error: any) {
      console.error('Error loading security events:', error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResolveEvent = async (eventId: string) => {
    try {
      const { error } = await supabase
        .from('security_events')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', eventId);

      if (error) throw error;

      toast({
        title: "Evento resolvido",
        description: "O evento de segurança foi marcado como resolvido.",
      });

      loadEvents();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-100 text-red-700 border-red-300";
      case "high": return "bg-orange-100 text-orange-700 border-orange-300";
      case "medium": return "bg-yellow-100 text-yellow-700 border-yellow-300";
      case "low": return "bg-blue-100 text-blue-700 border-blue-300";
      default: return "bg-gray-100 text-gray-700 border-gray-300";
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case "critical": return "Crítico";
      case "high": return "Alto";
      case "medium": return "Médio";
      case "low": return "Baixo";
      default: return severity;
    }
  };

  const getEventTypeLabel = (eventType: string) => {
    const types: Record<string, string> = {
      unauthorized_access: "Acesso não autorizado",
      failed_login: "Falha no login",
      suspicious_activity: "Atividade suspeita",
      data_breach: "Violação de dados",
      device_mismatch: "Dispositivo não reconhecido",
    };
    return types[eventType] || eventType;
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              Acesso restrito a administradores
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const unresolvedEvents = events.filter(e => !e.resolved);
  const criticalEvents = events.filter(e => e.severity === 'critical' && !e.resolved);

  return (
    <div className="space-y-6">
      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="text-red-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Eventos Críticos</p>
                <p className="text-2xl font-bold">{criticalEvents.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <XCircle className="text-orange-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Não Resolvidos</p>
                <p className="text-2xl font-bold">{unresolvedEvents.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Resolvidos</p>
                <p className="text-2xl font-bold">
                  {events.filter(e => e.resolved).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Eventos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Eventos de Segurança</CardTitle>
            <CardDescription>
              Monitoramento de atividades suspeitas e incidentes de segurança
            </CardDescription>
          </div>
          <Button onClick={loadEvents} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">Carregando eventos...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <p className="font-medium text-green-700">Sistema Seguro</p>
              <p className="text-sm text-muted-foreground">
                Nenhum evento de segurança registrado
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className={`p-4 border rounded-lg ${
                    event.resolved ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getSeverityColor(event.severity)}>
                          {getSeverityLabel(event.severity)}
                        </Badge>
                        {event.resolved && (
                          <Badge variant="outline" className="border-green-300 text-green-700">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Resolvido
                          </Badge>
                        )}
                      </div>
                      <p className="font-medium">
                        {getEventTypeLabel(event.event_type)}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date(event.timestamp).toLocaleString('pt-BR')}
                      </p>
                      {event.device_uuid && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Dispositivo: {event.device_uuid.substring(0, 8)}...
                        </p>
                      )}
                    </div>
                    {!event.resolved && (
                      <Button
                        onClick={() => handleResolveEvent(event.id)}
                        variant="outline"
                        size="sm"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Resolver
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
