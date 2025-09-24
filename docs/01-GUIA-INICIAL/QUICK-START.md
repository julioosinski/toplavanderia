# Guia de Início Rápido - TopLavanderia

## Configuração Inicial (5 minutos)

### 1. Pré-requisitos
- Tablet Android 8.0+
- Terminal PayGO PPC930
- Conexão USB ou Bluetooth
- Rede WiFi estável

### 2. Instalação Básica
```bash
# Clone o projeto
git clone [repository-url]
cd toplavanderia

# Instale dependências
npm install

# Configuração inicial
npx cap init
npx cap add android
```

### 3. Configuração PayGO
```json
{
  "host": "192.168.1.100",
  "port": 3000,
  "automationKey": "sua-chave-aqui",
  "timeout": 30000
}
```

### 4. Primeira Execução
```bash
npm run build
npx cap sync
npx cap run android
```

## Teste Rápido
1. Conecte o PPC930 via USB
2. Abra o app no tablet
3. Vá para Admin > PayGO Diagnostics
4. Clique "Detect Pinpad"
5. Teste pagamento de R$ 1,00

## Próximos Passos
- [Configuração Completa](../INTEGRATION_GUIDE.md)
- [PayGO Integration](../02-PAYGO-INTEGRATION/PAYGO_PPC930_DOCUMENTATION.md)
- [Deployment Totem](../03-DEPLOYMENT-TOTEM/README_TOTEM.md)

## Suporte Rápido
**Pinpad não detectado?**
- Verifique cabo USB
- Ative depuração USB no Android
- Reinicie o app

**Pagamento falha?**
- Confirme configuração de rede
- Verifique chave de automação
- Teste conexão manual