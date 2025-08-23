import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Download, 
  Usb, 
  Wifi, 
  Settings, 
  CheckCircle,
  ExternalLink,
  AlertTriangle
} from 'lucide-react';

export const PayGOSetupGuide: React.FC = () => {
  const steps = [
    {
      title: "1. Download do Software PayGO",
      description: "Baixe e instale o software oficial da Elgin",
      icon: <Download className="w-5 h-5 text-blue-500" />,
      details: [
        "Acesse o site da Elgin: https://elgin.com.br",
        "Baixe o PayGO Elgin para Windows",
        "Execute como administrador",
        "Siga o assistente de instalação"
      ]
    },
    {
      title: "2. Conectar a Maquininha",
      description: "Conecte via USB ou configure Wi-Fi",
      icon: <Usb className="w-5 h-5 text-green-500" />,
      details: [
        "Via USB: Conecte o cabo na maquininha e PC",
        "Via Wi-Fi: Configure rede na maquininha",
        "Verifique se foi reconhecida pelo sistema",
        "Teste a comunicação no software PayGO"
      ]
    },
    {
      title: "3. Configurar API/Automação",
      description: "Habilite a interface de automação",
      icon: <Settings className="w-5 h-5 text-orange-500" />,
      details: [
        "Abra as configurações do PayGO",
        "Habilite 'Interface de Automação'",
        "Configure porta (padrão: 8080)",
        "Defina chave de automação (se necessário)"
      ]
    },
    {
      title: "4. Testar Integração",
      description: "Valide se tudo está funcionando",
      icon: <CheckCircle className="w-5 h-5 text-green-600" />,
      details: [
        "Use o widget de teste do sistema",
        "Teste pagamento crédito/débito",
        "Teste geração de PIX",
        "Verifique logs de transação"
      ]
    }
  ];

  const commonIssues = [
    {
      problem: "Maquininha não conecta",
      solution: "Verifique drivers USB ou configuração Wi-Fi"
    },
    {
      problem: "Erro de comunicação",
      solution: "Confirme se PayGO está rodando e porta liberada"
    },
    {
      problem: "Pagamento negado",
      solution: "Verifique configuração do estabelecimento"
    }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="text-primary" />
            <span>Guia de Configuração PayGO</span>
          </CardTitle>
          <CardDescription>
            Passo a passo para integrar sua maquininha Elgin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {steps.map((step, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  {step.icon}
                  <div className="flex-1">
                    <h3 className="font-medium mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      {step.description}
                    </p>
                    <ul className="text-sm space-y-1">
                      {step.details.map((detail, detailIndex) => (
                        <li key={detailIndex} className="flex items-start space-x-2">
                          <span className="text-muted-foreground">•</span>
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Configurações Técnicas */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações Técnicas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">Configuração Padrão:</h4>
              <ul className="text-sm space-y-1">
                <li><strong>Host:</strong> 127.0.0.1 (localhost)</li>
                <li><strong>Porta:</strong> 8080</li>
                <li><strong>Timeout:</strong> 30000ms</li>
                <li><strong>Protocolo:</strong> HTTP/JSON</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Endpoints Principais:</h4>
              <ul className="text-sm space-y-1">
                <li><code>/status</code> - Status da maquininha</li>
                <li><code>/transaction</code> - Processar pagamento</li>
                <li><code>/pix/generate</code> - Gerar PIX</li>
                <li><code>/cancel</code> - Cancelar transação</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Problemas Comuns */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="text-yellow-500" />
            <span>Problemas Comuns</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {commonIssues.map((issue, index) => (
              <div key={index} className="border-l-4 border-yellow-500 pl-4 py-2">
                <h4 className="font-medium text-sm">{issue.problem}</h4>
                <p className="text-sm text-muted-foreground">{issue.solution}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Links Úteis */}
      <Card>
        <CardHeader>
          <CardTitle>Links Úteis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start" asChild>
              <a href="https://elgin.com.br" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Site Oficial Elgin
              </a>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <a href="https://elgin.com.br/suporte" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Suporte Técnico Elgin
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};