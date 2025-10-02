import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Wifi, WifiOff, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ESP32ConnectionTestProps {
  host: string;
  port: number;
  esp32Id: string;
}

export const ESP32ConnectionTest = ({ host, port, esp32Id }: ESP32ConnectionTestProps) => {
  const { toast } = useToast();
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const testConnection = async () => {
    setTesting(true);
    setStatus("idle");

    try {
      const url = `http://${host}:${port}/status`;
      
      // Timeout de 5 segundos
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        setStatus("success");
        toast({
          title: "Conexão bem-sucedida",
          description: `ESP32 ${esp32Id} está online e respondendo.`,
        });
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error: any) {
      setStatus("error");
      const errorMessage = error.name === "AbortError" 
        ? "Timeout - ESP32 não respondeu em 5 segundos" 
        : error.message;
      
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
  );
};
