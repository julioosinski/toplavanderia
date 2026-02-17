# Guia de Instalação - Top Lavanderia no Tablet

## 1. Preparação do Tablet

### Requisitos
- Tablet Android 5.1+ (API 22)
- PPC930 conectado via USB ou Bluetooth
- Conexão WiFi configurada
- Modo desenvolvedor ativado (para ADB)

### Ativar Modo Desenvolvedor
1. Configurações → Sobre o tablet → Tocar 7x no "Número da versão"
2. Voltar → Opções do desenvolvedor → Ativar "Depuração USB"

## 2. Instalar PayGo Integrado

### Para Testes (CERT)
```bash
adb install paygo/PGIntegrado-CERT.apk
```

### Para Produção (PROD)
```bash
adb install paygo/PGIntegrado-PROD.apk
```

### Configurar PayGo Integrado
1. Abrir o app "PayGo Integrado" no tablet
2. Clicar em "Parear Bluetooth" → selecionar o PPC930
3. Iniciar operação administrativa → "INSTALAÇÃO"
4. Inserir senha técnica: `314159`
5. Indicar ponto de captura
6. Inserir CNPJ do estabelecimento
7. Confirmar servidor e porta TCP
8. Aguardar impressão do comprovante de instalação

## 3. Instalar Top Lavanderia

### Via ADB
```bash
adb install TopLavanderia.apk
```

### Via Script
**Windows:**
```cmd
scripts\install_tablet.bat
```

**Linux/Mac:**
```bash
./scripts/install_tablet.sh
```

## 4. Configurar Top Lavanderia

1. Abrir o app Top Lavanderia
2. Na tela inicial, inserir o CNPJ da lavanderia
3. O app buscará automaticamente as máquinas no Supabase
4. Verificar se as máquinas aparecem na tela

### Configurações PayGo (em Configurações → PayGo)
- **Host**: IP do servidor PayGo (padrão: 192.168.1.100)
- **Porta**: 3000 (padrão)
- **Chave de Automação**: fornecida pela PayGo

## 5. Teste de Funcionamento

### Teste Básico
1. Selecionar uma máquina disponível
2. Escolher tipo de pagamento (Crédito/Débito/PIX)
3. Inserir cartão no PPC930
4. Verificar aprovação na tela

### Teste de Diagnóstico
1. Menu → Diagnósticos → PayGo
2. Verificar: "PayGo inicializado" = ✅
3. Verificar: "Pinpad USB detectado" = ✅

## 6. Modo Kiosk

O app já inicia em modo kiosk (tela cheia, sem barra de navegação). Para sair:
- Pressionar e segurar o botão "Voltar" por 5 segundos
- Ou usar ADB: `adb shell am force-stop com.toplavanderia.app`

## Configurações de Rede

| Serviço | Host | Porta | Protocolo |
|---------|------|-------|-----------|
| PayGo Integrado | Local | 3000 | TCP |
| Supabase | rkdybjzwiwwqqzjfmerm.supabase.co | 443 | HTTPS |
| ESP32 | Rede local | 80 | HTTP |
