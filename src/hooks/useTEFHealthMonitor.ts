import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';

interface TEFHealthMetrics {
  latency: number;
  uptime: number;
  errorRate: number;
  lastSuccessfulTransaction: Date | null;
  consecutiveFailures: number;
  isHealthy: boolean;
}

interface TEFConfig {
  host: string;
  port: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export const useTEFHealthMonitor = (config: TEFConfig, enabled: boolean = true) => {
  const [metrics, setMetrics] = useState<TEFHealthMetrics>({
    latency: 0,
    uptime: 0,
    errorRate: 0,
    lastSuccessfulTransaction: null,
    consecutiveFailures: 0,
    isHealthy: false
  });
  
  const [isMonitoring, setIsMonitoring] = useState(false);
  const { toast } = useToast();

  const performHealthCheck = useCallback(async (): Promise<{
    success: boolean;
    latency: number;
    error?: string;
  }> => {
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`http://${config.host}:${config.port}/health`, {
        method: 'GET',
        mode: 'cors',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;

      if (response.ok) {
        return { success: true, latency };
      } else {
        return { 
          success: false, 
          latency, 
          error: `HTTP ${response.status}: ${response.statusText}` 
        };
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      return { 
        success: false, 
        latency,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }, [config.host, config.port]);

  const updateMetrics = useCallback((success: boolean, latency: number, error?: string) => {
    setMetrics(prev => {
      const newConsecutiveFailures = success ? 0 : prev.consecutiveFailures + 1;
      const newErrorRate = success ? Math.max(0, prev.errorRate - 0.1) : Math.min(1, prev.errorRate + 0.1);
      
      // Calcular health score baseado em múltiplos fatores
      const healthScore = 
        (success ? 0.4 : 0) + // Status atual (40%)
        (latency < 1000 ? 0.3 : latency < 3000 ? 0.15 : 0) + // Latência (30%)
        (newConsecutiveFailures === 0 ? 0.2 : newConsecutiveFailures < 3 ? 0.1 : 0) + // Estabilidade (20%)
        (newErrorRate < 0.2 ? 0.1 : newErrorRate < 0.5 ? 0.05 : 0); // Taxa de erro (10%)

      const isHealthy = healthScore >= 0.7;

      return {
        latency: success ? latency : prev.latency,
        uptime: prev.uptime + (success ? 1 : 0),
        errorRate: newErrorRate,
        lastSuccessfulTransaction: success ? new Date() : prev.lastSuccessfulTransaction,
        consecutiveFailures: newConsecutiveFailures,
        isHealthy
      };
    });

    // Alertas baseados em thresholds
    if (!success && metrics.consecutiveFailures >= 2) {
      toast({
        title: "Alerta TEF",
        description: `Sistema TEF instável: ${metrics.consecutiveFailures + 1} falhas consecutivas`,
        variant: "destructive"
      });
    }

    if (latency > 5000) {
      toast({
        title: "Alerta de Performance",
        description: `TEF respondendo lentamente: ${latency}ms`,
        variant: "destructive"
      });
    }
  }, [metrics.consecutiveFailures, toast]);

  const runHealthCheck = useCallback(async () => {
    if (!enabled || isMonitoring) return;

    setIsMonitoring(true);
    
    try {
      const result = await performHealthCheck();
      updateMetrics(result.success, result.latency, result.error);
      
      console.log(`[TEF_HEALTH] ${new Date().toISOString()}`, {
        success: result.success,
        latency: result.latency,
        error: result.error,
        endpoint: `${config.host}:${config.port}`
      });
    } catch (error) {
      console.error('Health check failed:', error);
      updateMetrics(false, 0, 'Health check exception');
    } finally {
      setIsMonitoring(false);
    }
  }, [enabled, isMonitoring, performHealthCheck, updateMetrics, config.host, config.port]);

  // Health check periódico
  useEffect(() => {
    if (!enabled) return;

    // Check inicial
    runHealthCheck();

    // Intervalo de monitoramento (a cada 30 segundos)
    const interval = setInterval(runHealthCheck, 30000);

    return () => clearInterval(interval);
  }, [enabled, runHealthCheck]);

  // Auto-recovery: tentar reinicializar TEF se necessário
  const attemptRecovery = useCallback(async (): Promise<boolean> => {
    if (metrics.consecutiveFailures < 5) return false;

    try {
      console.log('[TEF_RECOVERY] Attempting auto-recovery...');
      
      const response = await fetch(`http://${config.host}:${config.port}/restart`, {
        method: 'POST',
        mode: 'cors',
        signal: AbortSignal.timeout(10000)
      });

      if (response.ok) {
        toast({
          title: "Recuperação TEF",
          description: "Sistema TEF reinicializado automaticamente",
          variant: "default"
        });
        
        // Aguardar e fazer novo health check
        setTimeout(runHealthCheck, 5000);
        return true;
      }
    } catch (error) {
      console.error('Auto-recovery failed:', error);
    }

    return false;
  }, [metrics.consecutiveFailures, config.host, config.port, toast, runHealthCheck]);

  // Trigger auto-recovery quando necessário
  useEffect(() => {
    if (metrics.consecutiveFailures >= 5 && !isMonitoring) {
      attemptRecovery();
    }
  }, [metrics.consecutiveFailures, isMonitoring, attemptRecovery]);

  return {
    metrics,
    isMonitoring,
    runHealthCheck,
    attemptRecovery
  };
};