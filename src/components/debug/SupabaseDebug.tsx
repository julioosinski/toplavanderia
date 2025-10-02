import React from 'react';
import { useSupabaseConnectivity } from '@/hooks/useSupabaseConnectivity';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Loader2, RefreshCw, Wifi, WifiOff } from 'lucide-react';

export const SupabaseDebug: React.FC = () => {
  const {
    isConnected,
    isLoading,
    lastError,
    testConnection,
    testESP32Status,
    testMachines,
    runFullDiagnostic
  } = useSupabaseConnectivity();

  const getStatusIcon = () => {
    if (isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (isConnected === true) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (isConnected === false) return <AlertCircle className="h-4 w-4 text-red-500" />;
    return <WifiOff className="h-4 w-4 text-gray-500" />;
  };

  const getStatusText = () => {
    if (isLoading) return 'Testando...';
    if (isConnected === true) return 'Conectado';
    if (isConnected === false) return 'Desconectado';
    return 'Não testado';
  };

  const getStatusVariant = () => {
    if (isConnected === true) return 'default';
    if (isConnected === false) return 'destructive';
    return 'secondary';
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wifi className="h-5 w-5" />
          Debug Supabase
        </CardTitle>
        <CardDescription>
          Teste de conectividade e diagnóstico do banco de dados
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Atual */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="font-medium">Status:</span>
            <Badge variant={getStatusVariant()}>
              {getStatusText()}
            </Badge>
          </div>
          <Button
            onClick={testConnection}
            disabled={isLoading}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Testar
          </Button>
        </div>

        {/* Erro */}
        {lastError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">Erro:</span>
            </div>
            <p className="text-sm text-red-700 mt-1">{lastError}</p>
          </div>
        )}

        {/* Botões de Teste */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Button
            onClick={testMachines}
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            Testar Máquinas
          </Button>
          <Button
            onClick={testESP32Status}
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            Testar ESP32
          </Button>
          <Button
            onClick={runFullDiagnostic}
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            Diagnóstico Completo
          </Button>
        </div>

        {/* Informações de Debug */}
        <div className="text-xs text-gray-500 space-y-1">
          <p><strong>URL:</strong> https://rkdybjzwiwwqqzjfmerm.supabase.co</p>
          <p><strong>Ambiente:</strong> {typeof window !== 'undefined' ? 'Web' : 'Mobile'}</p>
          <p><strong>User Agent:</strong> {navigator.userAgent}</p>
        </div>
      </CardContent>
    </Card>
  );
};
