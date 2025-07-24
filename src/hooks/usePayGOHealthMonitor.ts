import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { PayGOConfig } from './usePayGOIntegration';

interface PayGOHealthMetrics {
  latency: number;
  uptime: number;
  errorRate: number;
  lastSuccessfulTransaction: Date | null;
  consecutiveFailures: number;
  status: 'healthy' | 'degraded' | 'unhealthy';
}

export const usePayGOHealthMonitor = (config: PayGOConfig, enabled: boolean = true) => {
  const [metrics, setMetrics] = useState<PayGOHealthMetrics>({
    latency: 0,
    uptime: 0,
    errorRate: 0,
    lastSuccessfulTransaction: null,
    consecutiveFailures: 0,
    status: 'unhealthy',
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
      const response = await fetch(`http://${config.host}:${config.port}/health`, {
        method: 'GET',
        headers: {
          'X-Automation-Key': config.automationKey,
        },
        signal: AbortSignal.timeout(config.timeout),
      });

      const latency = Date.now() - startTime;
      
      return {
        success: response.ok,
        latency,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      return {
        success: false,
        latency,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }, [config]);

  const updateMetrics = useCallback((healthResult: {
    success: boolean;
    latency: number;
    error?: string;
  }) => {
    setMetrics(prev => {
      const newConsecutiveFailures = healthResult.success ? 0 : prev.consecutiveFailures + 1;
      const newErrorRate = healthResult.success ? 
        Math.max(0, prev.errorRate - 0.1) : 
        Math.min(1, prev.errorRate + 0.1);

      let newStatus: 'healthy' | 'degraded' | 'unhealthy';
      if (newConsecutiveFailures === 0 && newErrorRate < 0.1) {
        newStatus = 'healthy';
      } else if (newConsecutiveFailures < 3 && newErrorRate < 0.5) {
        newStatus = 'degraded';
      } else {
        newStatus = 'unhealthy';
      }

      // Alert on status changes
      if (prev.status !== newStatus) {
        if (newStatus === 'unhealthy') {
          toast({
            title: "PayGO Sistema Instável",
            description: "O sistema PayGO está com problemas de conectividade",
            variant: "destructive",
          });
        } else if (newStatus === 'healthy' && prev.status === 'unhealthy') {
          toast({
            title: "PayGO Recuperado",
            description: "O sistema PayGO voltou ao normal",
          });
        }
      }

      return {
        latency: healthResult.latency,
        uptime: healthResult.success ? prev.uptime + 1 : prev.uptime,
        errorRate: newErrorRate,
        lastSuccessfulTransaction: healthResult.success ? new Date() : prev.lastSuccessfulTransaction,
        consecutiveFailures: newConsecutiveFailures,
        status: newStatus,
      };
    });
  }, [toast]);

  const runHealthCheck = useCallback(async () => {
    if (!enabled) return;
    
    setIsMonitoring(true);
    const result = await performHealthCheck();
    updateMetrics(result);
    setIsMonitoring(false);
  }, [enabled, performHealthCheck, updateMetrics]);

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(runHealthCheck, 30000); // Check every 30 seconds
    runHealthCheck(); // Initial check

    return () => clearInterval(interval);
  }, [enabled, runHealthCheck]);

  const attemptRecovery = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`http://${config.host}:${config.port}/restart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Automation-Key': config.automationKey,
        },
        signal: AbortSignal.timeout(config.timeout * 2),
      });

      if (response.ok) {
        toast({
          title: "PayGO Reiniciado",
          description: "Sistema PayGO foi reiniciado com sucesso",
        });
        
        // Wait a bit before checking status again
        setTimeout(runHealthCheck, 5000);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('PayGO recovery failed:', error);
      return false;
    }
  }, [config, toast, runHealthCheck]);

  useEffect(() => {
    if (metrics.consecutiveFailures >= 5) {
      attemptRecovery();
    }
  }, [metrics.consecutiveFailures, attemptRecovery]);

  return {
    metrics,
    isMonitoring,
    runHealthCheck,
    attemptRecovery,
  };
};