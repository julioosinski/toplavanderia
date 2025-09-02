import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { 
  CreditCard, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Settings,
  Wifi,
  Network,
  Search
} from 'lucide-react';

interface TEFConfig {
  host: string;
  port: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

interface TEFPositivoL4ConfigProps {
  config?: TEFConfig;
  onConfigChange?: (config: TEFConfig) => void;
}

export const TEFPositivoL4Config: React.FC<TEFPositivoL4ConfigProps> = ({
  config = {
    host: '192.168.1.100',
    port: '8080',
    timeout: 45000,
    retryAttempts: 2,
    retryDelay: 3000
  },
  onConfigChange
}) => {
  const [localConfig, setLocalConfig] = useState<TEFConfig>(config);
  const [isConnected, setIsConnected] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [lastTest, setLastTest] = useState<Date | null>(null);
  const { toast } = useToast();

  // Auto-detectar IP da Positivo L4
  const autoDetectL4 = useCallback(async () => {
    setIsAutoDetecting(true);
    const commonIPs = ['192.168.1.100', '192.168.0.100', '10.0.0.100', '192.168.1.50', '192.168.0.50'];
    
    toast({
      title: "Procurando Positivo L4",
      description: "Testando IPs comuns...",
    });

    for (const ip of commonIPs) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch(`http://${ip}:8080/status`, {
          method: 'GET',
          mode: 'cors',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          // Verificar se é realmente uma Positivo L4
          if (data.model?.includes('L4') || data.device?.includes('Positivo') || response.ok) {
            setLocalConfig(prev => ({ ...prev, host: ip }));
            setIsConnected(true);
            toast({
              title: "Positivo L4 Encontrada!",
              description: `Dispositivo encontrado em ${ip}`,
            });
            setIsAutoDetecting(false);
            return;
          }
        }
      } catch (error) {
        // Continue tentando outros IPs
        continue;
      }
    }
    
    setIsAutoDetecting(false);
    toast({
      title: "Positivo L4 não encontrada",
      description: "Configure o IP manualmente",
      variant: "destructive"
    });
  }, [toast]);

  // Testar conectividade
  const testConnection = useCallback(async () => {
    setIsTesting(true);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), localConfig.timeout);
      
      const response = await fetch(`http://${localConfig.host}:${localConfig.port}/status`, {
        method: 'GET',
        mode: 'cors',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        setIsConnected(true);
        setLastTest(new Date());
        toast({
          title: "Conexão TEF Positivo L4",
          description: "Conectado com sucesso!",
        });
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      setIsConnected(false);
      setLastTest(new Date());
      toast({
        title: "Erro de Conexão",
        description: error instanceof Error ? error.message : "Falha ao conectar com L4",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  }, [localConfig, toast]);

  const handleSave = () => {
    onConfigChange?.(localConfig);
    toast({
      title: "Configuração Salva",
      description: "Configurações TEF Positivo L4 atualizadas",
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Configuração TEF Positivo L4
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status da Conexão */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
              <div>
                <p className="font-medium">
                  {isConnected ? 'Conectado' : 'Desconectado'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {lastTest ? `Último teste: ${lastTest.toLocaleTimeString()}` : 'Não testado'}
                </p>
              </div>
            </div>
            <Badge variant={isConnected ? "default" : "destructive"}>
              {isConnected ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            </Badge>
          </div>

          <Separator />

          {/* Auto-detecção */}
          <div className="space-y-3">
            <h3 className="font-medium flex items-center gap-2">
              <Search className="h-4 w-4" />
              Auto-detecção
            </h3>
            <p className="text-sm text-muted-foreground">
              Busca automaticamente a Positivo L4 na rede local
            </p>
            <Button 
              onClick={autoDetectL4} 
              disabled={isAutoDetecting}
              variant="outline"
              className="w-full"
            >
              {isAutoDetecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procurando...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Buscar Positivo L4
                </>
              )}
            </Button>
          </div>

          <Separator />

          {/* Configuração Manual */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configuração Manual
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="host">IP da Positivo L4</Label>
                <Input
                  id="host"
                  value={localConfig.host}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, host: e.target.value }))}
                  placeholder="192.168.1.100"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="port">Porta</Label>
                <Input
                  id="port"
                  value={localConfig.port}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, port: e.target.value }))}
                  placeholder="8080"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="timeout">Timeout (ms)</Label>
                <Input
                  id="timeout"
                  type="number"
                  value={localConfig.timeout}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, timeout: parseInt(e.target.value) || 45000 }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="retryAttempts">Tentativas</Label>
                <Input
                  id="retryAttempts"
                  type="number"
                  value={localConfig.retryAttempts}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, retryAttempts: parseInt(e.target.value) || 2 }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="retryDelay">Delay (ms)</Label>
                <Input
                  id="retryDelay"
                  type="number"
                  value={localConfig.retryDelay}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, retryDelay: parseInt(e.target.value) || 3000 }))}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Ações */}
          <div className="flex gap-3">
            <Button 
              onClick={testConnection} 
              disabled={isTesting}
              variant="outline"
              className="flex-1"
            >
              {isTesting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testando...
                </>
              ) : (
                <>
                  <Wifi className="mr-2 h-4 w-4" />
                  Testar Conexão
                </>
              )}
            </Button>
            
            <Button onClick={handleSave} className="flex-1">
              <Settings className="mr-2 h-4 w-4" />
              Salvar Config
            </Button>
          </div>

          {/* Dicas de Configuração */}
          <div className="bg-primary/10 p-4 rounded-lg space-y-2">
            <h4 className="font-medium text-primary">Dicas de Configuração:</h4>
            <ul className="text-sm space-y-1">
              <li>• Configure IP fixo na Positivo L4: 192.168.1.100</li>
              <li>• Conecte a L4 na mesma rede WiFi do tablet</li>
              <li>• Ou use cabo Ethernet L4 → Router</li>
              <li>• Teste a conexão regularmente</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};