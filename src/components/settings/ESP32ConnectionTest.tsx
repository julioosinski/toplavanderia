import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Wifi, WifiOff, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CapacitorHttp } from "@capacitor/core";

interface ESP32ConnectionTestProps {
  host: string;
  port: number;
  esp32Id: string;
}

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : "Erro desconhecido";
};

export const ESP32ConnectionTest = ({ host, port, esp32Id }: ESP32ConnectionTestProps) => {
  const { toast } = useToast();
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const testConnection = async () => {
    setTesting(true);
    setStatus("idle");

    try {
      const url = `http://${host}:${port}/status`;
      
      console.log(`🔍 Testando conexão ESP32: ${url}`);
      
      // Usar CapacitorHttp para resolver Mixed Content Error
      const response = await CapacitorHttp.request({
        url: url,
        method: "GET",
        readTimeout: 5000,
        connectTimeout: 5000,
      });

      if (response.status === 200) {
        setStatus("success");
        console.log(`✅ ESP32 ${esp32Id} respondeu:`, response.data);
        toast({
          title: "Conexão bem-sucedida",
          description: `ESP32 ${esp32Id} está online e respondendo.`,
        });
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error: unknown) {
      setStatus("error");
      console.error(`❌ Erro ao conectar ESP32 ${esp32Id}:`, error);
      
      const rawMessage = getErrorMessage(error);
      const errorMessage = rawMessage.includes("timeout") || rawMessage.includes("timed out")
        ? "Timeout - ESP32 não respondeu em 5 segundos" 
        : rawMessage;
      
      toast({
        title: "Falha na conexão",
        description: `Não foi possível conectar ao ESP32 ${esp32Id}. ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const getStatusBadge = () => {
    if (status === "success") {
      return (
        <Badge variant="default" className="bg-green-500">
          <Wifi className="h-3 w-3 mr-1" />
          Online
        </Badge>
      );
    }
    if (status === "error") {
      return (
        <Badge variant="destructive">
          <WifiOff className="h-3 w-3 mr-1" />
          Offline
        </Badge>
      );
    }
    return null;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={testConnection}
          disabled={testing}
        >
          {testing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Testando...
            </>
          ) : (
            <>
              <Wifi className="h-4 w-4 mr-2" />
              Testar Conexão
            </>
          )}
        </Button>
        {getStatusBadge()}
      </div>
      {typeof window !== 'undefined' && window.location.protocol === 'https:' && (
        <p className="text-xs text-muted-foreground">
          ⚠️ Teste de conexão só funciona no app mobile devido a restrições de segurança HTTPS/HTTP
        </p>
      )}
    </div>
  );
};
