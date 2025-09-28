# Script para criar pacote do tablet sem build Android
Write-Host "Criando pacote para tablet..." -ForegroundColor Green

# Configurações
$BUILD_DIR = "tablet_package"
$APK_NAME = "TopLavanderia_v1.0.0_PayGo_Integrated.apk"

# Criar diretório
if (Test-Path $BUILD_DIR) {
    Remove-Item -Recurse -Force $BUILD_DIR
}
New-Item -ItemType Directory -Path $BUILD_DIR | Out-Null

# Build do React
Write-Host "Fazendo build do React..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Erro no build do React" -ForegroundColor Red
    exit 1
}

# Copiar arquivos PayGo
Write-Host "Copiando arquivos PayGo..." -ForegroundColor Yellow
$PAYGO_DIR = "$BUILD_DIR\paygo_files"
New-Item -ItemType Directory -Path $PAYGO_DIR | Out-Null

$PAYGO_CERT = "C:\Users\ideapad GAMING\Desktop\Kit-PayGo-Android-v4.1.50.5\Kit-PayGo-Android-v4.1.50.5\Desenvolvimento\PayGo Integrado CERT (APK)\Padrão\PGIntegrado-v4.1.50.5_CERT_geral_250605.zip"
$PAYGO_PROD = "C:\Users\ideapad GAMING\Desktop\Kit-PayGo-Android-v4.1.50.5\Kit-PayGo-Android-v4.1.50.5\Produção\Padrão\PGIntegrado-v4.1.50.5_PROD_geral_250605.zip"

if (Test-Path $PAYGO_CERT) {
    Copy-Item $PAYGO_CERT $PAYGO_DIR
    Write-Host "PayGo CERT copiado" -ForegroundColor Green
} else {
    Write-Host "PayGo CERT nao encontrado: $PAYGO_CERT" -ForegroundColor Yellow
}

if (Test-Path $PAYGO_PROD) {
    Copy-Item $PAYGO_PROD $PAYGO_DIR
    Write-Host "PayGo PROD copiado" -ForegroundColor Green
} else {
    Write-Host "PayGo PROD nao encontrado: $PAYGO_PROD" -ForegroundColor Yellow
}

# Criar script de instalação
Write-Host "Criando script de instalação..." -ForegroundColor Yellow
$INSTALL_SCRIPT = @"
@echo off
echo Instalando Top Lavanderia no tablet...

adb version >nul 2>&1
if %errorlevel% neq 0 (
    echo ADB nao encontrado. Instale o Android SDK.
    pause
    exit /b 1
)

adb devices | findstr "device$" >nul
if %errorlevel% neq 0 (
    echo Nenhum dispositivo Android conectado.
    pause
    exit /b 1
)

echo Dispositivo encontrado. Iniciando instalacao...

if exist "paygo_files\PGIntegrado-v4.1.50.5_CERT_geral_250605.zip" (
    echo Instalando PayGo Integrado CERT...
    adb install paygo_files\PGIntegrado-v4.1.50.5_CERT_geral_250605.zip
    echo PayGo Integrado instalado
)

if exist "paygo_files\PGIntegrado-v4.1.50.5_PROD_geral_250605.zip" (
    echo Instalando PayGo Integrado PROD...
    adb install paygo_files\PGIntegrado-v4.1.50.5_PROD_geral_250605.zip
    echo PayGo Integrado PROD instalado
)

echo.
echo Instalacao concluida!
echo.
echo Proximos passos:
echo 1. Abrir PayGo Integrado e configurar
echo 2. Instalar ponto de captura
echo 3. Compilar e instalar Top Lavanderia
echo.
pause
"@

$INSTALL_SCRIPT | Out-File -FilePath "$BUILD_DIR\install_tablet.bat" -Encoding ASCII

# Criar documentação
Write-Host "Criando documentação..." -ForegroundColor Yellow
$README = @"
# Top Lavanderia - Pacote para Tablet

## Visao Geral

Este pacote contem os arquivos necessarios para instalar o sistema Top Lavanderia com integracao PayGo em um tablet Android.

## Conteudo do Pacote

- paygo_files/ - Arquivos do PayGo Integrado
- install_tablet.bat - Script de instalacao
- README.md - Este arquivo

## Instalacao

### 1. Instalar PayGo Integrado

Execute o script de instalacao:
``````
install_tablet.bat
``````

### 2. Configurar PayGo Integrado

1. Abrir o aplicativo PayGo Integrado
2. Clicar em Parear Bluetooth
3. Selecionar o PPC930 na lista de dispositivos
4. Inserir senha de pareamento se solicitado
5. Configurar o dispositivo

### 3. Instalar Ponto de Captura

1. Iniciar operacao administrativa
2. Selecionar INSTALACAO
3. Inserir senha tecnica: 314159
4. Indicar o ponto de captura
5. Inserir CNPJ do estabelecimento
6. Confirmar servidor e porta TCP
7. Aguardar impressao do comprovante

### 4. Compilar e Instalar Top Lavanderia

Para compilar o aplicativo:

``````bash
# Instalar dependencias
npm install

# Build do React
npm run build

# Build do Android
npx cap build android

# Instalar no tablet
npx cap run android
``````

## Configuracoes

### PayGo Integrado
- Host: IP do servidor PayGo
- Porta: 3000 (padrao)
- Protocolo: TCP

### Top Lavanderia
- API Endpoint: Configurado nas configuracoes
- PayGo Integration: Ativada por padrao

## Teste de Funcionamento

1. Teste de Conexao:
   - Abrir Top Lavanderia
   - Ir para Diagnosticos > PayGo
   - Verificar status da conexao

2. Teste de Pagamento:
   - Selecionar maquina
   - Escolher metodo de pagamento
   - Inserir cartao no PPC930
   - Verificar aprovacao

## Solucao de Problemas

### PayGo nao conecta
- Verificar se PPC930 esta conectado
- Verificar configuracoes de rede
- Reiniciar PayGo Integrado

### Pagamento nao processa
- Verificar se PayGo Integrado esta rodando
- Verificar conexao USB
- Verificar logs do Android

### Aplicativo nao inicia
- Verificar permissoes
- Verificar espaco em disco
- Reinstalar aplicativo

## Logs e Diagnosticos

### Android Logs
``````bash
adb logcat | grep -E "(TopLavanderia|PayGO|PayGOManager)"
``````

### PayGo Logs
``````bash
adb logcat | grep "PayGo"
``````

## Suporte

Para suporte tecnico:
- Verificar logs do sistema
- Documentar erros encontrados
- Contactar equipe de desenvolvimento

## Versoes

- Top Lavanderia: v1.0.0
- PayGo Integrado: v4.1.50.5
- InterfaceAutomacao: v2.1.0.6
- Android: 5.1+ (API 22+)
"@

$README | Out-File -FilePath "$BUILD_DIR\README.md" -Encoding UTF8

# Criar arquivo de configuração
Write-Host "Criando arquivo de configuração..." -ForegroundColor Yellow
$CONFIG_JSON = @"
{
  "app": {
    "name": "Top Lavanderia",
    "version": "1.0.0",
    "package": "app.lovable.toplavanderia"
  },
  "paygo": {
    "enabled": true,
    "version": "4.1.50.5",
    "interface_version": "2.1.0.6",
    "default_host": "192.168.1.100",
    "default_port": 3000,
    "supported_payments": ["credit", "debit", "pix"],
    "device_support": ["PPC930"]
  },
  "features": {
    "kiosk_mode": true,
    "auto_payment": true,
    "receipt_printing": true,
    "machine_control": true,
    "admin_panel": true
  },
  "requirements": {
    "android_version": "5.1",
    "api_level": 22,
    "usb_support": true,
    "bluetooth_support": true
  }
}
"@

$CONFIG_JSON | Out-File -FilePath "$BUILD_DIR\config.json" -Encoding UTF8

# Criar checklist de verificação
Write-Host "Criando checklist de verificação..." -ForegroundColor Yellow
$CHECKLIST = @"
# Checklist de Verificação - Top Lavanderia PayGo

## Antes da Instalação

- [ ] Tablet Android 5.1+ conectado via USB
- [ ] ADB habilitado no tablet
- [ ] PPC930 conectado e funcionando
- [ ] Conexão de rede disponível
- [ ] Arquivos de instalação baixados

## Durante a Instalação

- [ ] PayGo Integrado instalado com sucesso
- [ ] Nenhum erro durante a instalação

## Após a Instalação

### PayGo Integrado
- [ ] Aplicativo abre normalmente
- [ ] PPC930 detectado e pareado
- [ ] Ponto de captura instalado
- [ ] Comprovante de instalação impresso

### Top Lavanderia
- [ ] Aplicativo compila sem erros
- [ ] Aplicativo instala no tablet
- [ ] Interface carrega corretamente
- [ ] Máquinas são detectadas
- [ ] Configurações acessíveis

## Testes Funcionais

### Conexão PayGo
- [ ] Status "Conectado" no diagnóstico
- [ ] PPC930 detectado via USB
- [ ] Comunicação estabelecida

### Processamento de Pagamento
- [ ] Cartão de crédito processado
- [ ] Cartão de débito processado
- [ ] PIX processado (se disponível)
- [ ] Transação cancelada com sucesso

### Controle de Máquinas
- [ ] Máquina ativada após pagamento
- [ ] Tempo de funcionamento correto
- [ ] Máquina desativa automaticamente

### Interface do Usuário
- [ ] Navegação fluida
- [ ] Mensagens claras
- [ ] Feedback visual adequado
- [ ] Tratamento de erros

## Logs e Diagnósticos

- [ ] Logs do Android sem erros críticos
- [ ] Logs do PayGo funcionando
- [ ] Logs da aplicação sem erros
- [ ] Diagnósticos mostram status correto

## Configurações de Produção

- [ ] Host PayGo configurado corretamente
- [ ] Porta TCP configurada
- [ ] Chave de automação inserida
- [ ] Modo kiosk ativado
- [ ] Configurações de segurança aplicadas

## Documentação

- [ ] Manual de instalação revisado
- [ ] Checklist preenchido
- [ ] Logs de instalação salvos
- [ ] Configurações documentadas

## Aprovação Final

- [ ] Todos os testes passaram
- [ ] Sistema funcionando conforme esperado
- [ ] Pronto para uso em produção
- [ ] Equipe treinada no uso

**Data da Verificação**: ___________
**Responsável**: ___________
**Assinatura**: ___________
"@

$CHECKLIST | Out-File -FilePath "$BUILD_DIR\CHECKLIST_VERIFICACAO.md" -Encoding UTF8

# Criar arquivo de versão
Write-Host "Criando arquivo de versão..." -ForegroundColor Yellow
$VERSION_INFO = @"
Top Lavanderia - Pacote para Tablet
==================================

Versão: 1.0.0
Data: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

Componentes:
- Top Lavanderia App: 1.0.0
- PayGo Integrado: 4.1.50.5
- InterfaceAutomacao: 2.1.0.6
- Android Target: API 22+

Arquivos:
- PayGo CERT: PGIntegrado-v4.1.50.5_CERT_geral_250605.zip
- PayGo PROD: PGIntegrado-v4.1.50.5_PROD_geral_250605.zip

Configurações:
- Host Padrão: 192.168.1.100
- Porta Padrão: 3000
- Dispositivo: PPC930
- Modo: Kiosk
"@

$VERSION_INFO | Out-File -FilePath "$BUILD_DIR\VERSION.txt" -Encoding UTF8

# Criar ZIP
Write-Host "Criando pacote final..." -ForegroundColor Yellow
$ZIP_FILE = "TopLavanderia_Tablet_Package_v1.0.0.zip"
if (Test-Path $ZIP_FILE) {
    Remove-Item $ZIP_FILE
}

Compress-Archive -Path "$BUILD_DIR\*" -DestinationPath $ZIP_FILE

Write-Host ""
Write-Host "Pacote criado com sucesso!" -ForegroundColor Green
Write-Host "Diretório: $BUILD_DIR" -ForegroundColor Cyan
Write-Host "ZIP: $ZIP_FILE" -ForegroundColor Cyan
Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Yellow
Write-Host "1. Transferir arquivos para o tablet" -ForegroundColor White
Write-Host "2. Executar install_tablet.bat" -ForegroundColor White
Write-Host "3. Configurar PayGo Integrado" -ForegroundColor White
Write-Host "4. Compilar e instalar Top Lavanderia" -ForegroundColor White
