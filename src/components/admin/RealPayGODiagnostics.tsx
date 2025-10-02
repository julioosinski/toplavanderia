import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRealPayGOIntegration, DEFAULT_REAL_PAYGO_CONFIG, RealPayGOConfig } from '@/hooks/useRealPayGOIntegration';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Usb,
  Wifi,
  Settings,
  CreditCard,
  Loader2,
  RefreshCw,
  TestTube
} from 'lucide-react';

interface RealPayGODiagnosticsProps {
  config?: RealPayGOConfig;
  onConfigChange?: (config: RealPayGOConfig) => void;
}

export const RealPayGODiagnostics: React.FC<RealPayGODiagnosticsProps> = ({
  config = DEFAULT_REAL_PAYGO_CONFIG,
  onConfigChange
}) => {
  const [currentConfig, setCurrentConfig] = useState<RealPayGOConfig>(config);
  const [testAmount, setTestAmount] = useState('10.00');
  const [testOrderId, setTestOrderId] = useState('TEST-' + Date.now());

  const {
    isInitialized,
    isConnected,
    isProcessing,
    systemStatus,
    lastError,
    initialize,
    checkStatus,
    getSystemStatus,
    testConnection,
    processPayment,
    cancelTransaction,
    detectPinpad
  } = useRealPayGOIntegration(currentConfig);

  // Update config when props change
  useEffect(() => {
    if (config !== currentConfig) {
      setCurrentConfig(config);
    }
  }, [config, currentConfig]);

  const handleConfigUpdate = () => {
    onConfigChange?.(currentConfig);
    initialize();
  };

  const handleTestPayment = async () => {
    try {
      const amount = parseFloat(testAmount);
      if (isNaN(amount) || amount <= 0) {
        alert('Invalid amount');
        return;
      }

      await processPayment({
        paymentType: 'credit',
        amount,
        orderId: testOrderId
      });

      // Generate new order ID for next test
      setTestOrderId('TEST-' + Date.now());
    } catch (error) {
      console.error('Test payment error:', error);
    }
  };

  const getStatusIcon = (status: boolean) => {
    return status ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getStatusBadge = (status: boolean, trueText: string, falseText: string) => {
    return (
      <Badge variant={status ? "default" : "destructive"}>
        {status ? trueText : falseText}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Configuration Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            PayGO Real Configuration
          </CardTitle>
          <CardDescription>
            Configure the PayGO library connection parameters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="host">Host</Label>
              <Input
                id="host"
                value={currentConfig.host}
                onChange={(e) => setCurrentConfig(prev => ({ ...prev, host: e.target.value }))}
                placeholder="192.168.1.100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="number"
                value={currentConfig.port}
                onChange={(e) => setCurrentConfig(prev => ({ ...prev, port: parseInt(e.target.value) || 9999 }))}
                placeholder="9999"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="automationKey">Automation Key</Label>
            <Input
              id="automationKey"
              value={currentConfig.automationKey}
              onChange={(e) => setCurrentConfig(prev => ({ ...prev, automationKey: e.target.value }))}
              placeholder="Enter automation key"
              type="password"
            />
          </div>
          <Button onClick={handleConfigUpdate} className="w-full">
            Update Configuration & Initialize
          </Button>
        </CardContent>
      </Card>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            PayGO System Status
          </CardTitle>
          <CardDescription>
            Real-time status of the PayGO library and PPC930 device
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                {getStatusIcon(isInitialized)}
                Library Initialized
              </span>
              {getStatusBadge(isInitialized, "Ready", "Not Ready")}
            </div>
            
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                {getStatusIcon(isConnected)}
                Device Connected
              </span>
              {getStatusBadge(isConnected, "Connected", "Disconnected")}
            </div>

            {systemStatus?.usbDeviceDetected !== undefined && (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Usb className="h-4 w-4" />
                  USB Device
                </span>
                {getStatusBadge(systemStatus.usbDeviceDetected, "Detected", "Not Found")}
              </div>
            )}

            {systemStatus?.libraryVersion && (
              <div className="flex items-center justify-between">
                <span>Library Version</span>
                <Badge variant="outline">{systemStatus.libraryVersion}</Badge>
              </div>
            )}
          </div>

          {systemStatus?.deviceInfo && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Device Information</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Device: {systemStatus.deviceInfo.deviceName}</div>
                <div>Serial: {systemStatus.deviceInfo.serialNumber}</div>
                <div>Vendor ID: {systemStatus.deviceInfo.vendorId}</div>
                <div>Product ID: {systemStatus.deviceInfo.productId}</div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={checkStatus} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Status
            </Button>
            <Button onClick={getSystemStatus} variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Get Details
            </Button>
            <Button onClick={testConnection} variant="outline" size="sm">
              <TestTube className="h-4 w-4 mr-2" />
              Test Connection
            </Button>
            <Button onClick={detectPinpad} variant="outline" size="sm">
              <Usb className="h-4 w-4 mr-2" />
              Detect Pinpad
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test Payment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Test Payment
          </CardTitle>
          <CardDescription>
            Test the PayGO integration with a real payment transaction
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="testAmount">Amount (R$)</Label>
              <Input
                id="testAmount"
                value={testAmount}
                onChange={(e) => setTestAmount(e.target.value)}
                placeholder="10.00"
                type="number"
                step="0.01"
                min="0.01"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="testOrderId">Order ID</Label>
              <Input
                id="testOrderId"
                value={testOrderId}
                onChange={(e) => setTestOrderId(e.target.value)}
                placeholder="TEST-123456"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleTestPayment}
              disabled={!isInitialized || !isConnected || isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4 mr-2" />
              )}
              {isProcessing ? 'Processing...' : 'Test Credit Payment'}
            </Button>
            
            <Button 
              onClick={() => cancelTransaction()}
              disabled={!isProcessing}
              variant="destructive"
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {lastError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{lastError}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};