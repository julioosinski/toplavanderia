import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Receipt, Send, TestTube } from 'lucide-react';
import { useNFSeIntegration } from '@/hooks/useNFSeIntegration';
import { useToast } from '@/hooks/use-toast';

interface NFSeTestWidgetProps {
  webhookUrl: string;
  companyName: string;
  companyCnpj: string;
  companyEmail: string;
}

export const NFSeTestWidget: React.FC<NFSeTestWidgetProps> = ({
  webhookUrl,
  companyName,
  companyCnpj,
  companyEmail,
}) => {
  const [testData, setTestData] = useState({
    customerName: 'Cliente Teste',
    customerEmail: 'cliente@teste.com',
    serviceDescription: 'Hospedagem - Quarto Standard',
    serviceValue: 150.00,
  });

  const { isProcessing, sendToZapier, testWebhook } = useNFSeIntegration();
  const { toast } = useToast();

  const handleTestNFSe = async () => {
    if (!webhookUrl) {
      toast({
        title: "Erro",
        description: "Configure primeiro a URL do webhook Zapier",
        variant: "destructive",
      });
      return;
    }

    const nfseData = {
      companyName,
      companyCnpj,
      companyEmail,
      customerName: testData.customerName,
      customerEmail: testData.customerEmail,
      customerDocument: '',
      serviceDescription: testData.serviceDescription,
      serviceValue: testData.serviceValue,
      transactionId: `test-${Date.now()}`,
      machineId: 'test-machine',
      machineName: 'Máquina Teste',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      paymentMethod: 'credit_card',
    };

    await sendToZapier(webhookUrl, nfseData);
  };

  const handleTestConnection = async () => {
    await testWebhook(webhookUrl);
  };

  if (!webhookUrl) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Receipt className="text-primary" />
            <span>Teste NFSe</span>
          </CardTitle>
          <CardDescription>
            Configure primeiro a URL do webhook Zapier para testar a integração
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Receipt className="text-primary" />
          <span>Teste de Integração NFSe</span>
        </CardTitle>
        <CardDescription>
          Teste a integração enviando dados fictícios para o Zapier
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="test-customer-name">Nome do Cliente (Teste)</Label>
            <Input
              id="test-customer-name"
              value={testData.customerName}
              onChange={(e) => setTestData(prev => ({ ...prev, customerName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="test-customer-email">Email do Cliente (Teste)</Label>
            <Input
              id="test-customer-email"
              type="email"
              value={testData.customerEmail}
              onChange={(e) => setTestData(prev => ({ ...prev, customerEmail: e.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="test-service-description">Descrição do Serviço</Label>
          <Textarea
            id="test-service-description"
            value={testData.serviceDescription}
            onChange={(e) => setTestData(prev => ({ ...prev, serviceDescription: e.target.value }))}
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="test-service-value">Valor do Serviço (R$)</Label>
          <Input
            id="test-service-value"
            type="number"
            step="0.01"
            min="0"
            value={testData.serviceValue}
            onChange={(e) => setTestData(prev => ({ ...prev, serviceValue: parseFloat(e.target.value) || 0 }))}
          />
        </div>

        <div className="flex space-x-2 pt-4">
          <Button
            onClick={handleTestConnection}
            variant="outline"
            disabled={isProcessing}
          >
            <TestTube className="w-4 h-4 mr-2" />
            Testar Conexão
          </Button>
          <Button
            onClick={handleTestNFSe}
            disabled={isProcessing}
          >
            <Send className="w-4 h-4 mr-2" />
            {isProcessing ? 'Enviando...' : 'Testar NFSe'}
          </Button>
        </div>

        <div className="mt-4 p-4 bg-muted rounded-lg">
          <h4 className="font-medium mb-2">Dados da Empresa:</h4>
          <div className="text-sm space-y-1">
            <p><strong>Nome:</strong> {companyName || 'Não configurado'}</p>
            <p><strong>CNPJ:</strong> {companyCnpj || 'Não configurado'}</p>
            <p><strong>Email:</strong> {companyEmail || 'Não configurado'}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};