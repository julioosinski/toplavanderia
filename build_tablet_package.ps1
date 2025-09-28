# Script PowerShell para gerar o pacote completo para o tablet
# Top Lavanderia - PayGo Integration

Write-Host "🏗️  Construindo pacote para tablet - Top Lavanderia PayGo Integration" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green

# Configurações
$PROJECT_NAME = "TopLavanderia"
$VERSION = "1.0.0"
$BUILD_DIR = "tablet_package"
$APK_NAME = "${PROJECT_NAME}_v${VERSION}_PayGo_Integrated.apk"

# Criar diretório de build
Write-Host "📁 Criando diretório de build..." -ForegroundColor Yellow
if (Test-Path $BUILD_DIR) {
    Remove-Item -Recurse -Force $BUILD_DIR
}
New-Item -ItemType Directory -Path $BUILD_DIR | Out-Null

# 1. Build do projeto React/TypeScript
Write-Host "⚛️  Fazendo build do projeto React..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro no build do React. Abortando." -ForegroundColor Red
    exit 1
}

# 2. Build do Android
Write-Host "🤖 Fazendo build do Android..." -ForegroundColor Yellow
Set-Location android
./gradlew assembleRelease

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro no build do Android. Abortando." -ForegroundColor Red
    Set-Location ..
    exit 1
}

Set-Location ..

# 3. Copiar APK gerado
Write-Host "📱 Copiando APK..." -ForegroundColor Yellow
$APK_SOURCE = "android\app\build\outputs\apk\release\app-release.apk"
if (Test-Path $APK_SOURCE) {
    Copy-Item $APK_SOURCE "$BUILD_DIR\$APK_NAME"
    Write-Host "✅ APK copiado: $APK_NAME" -ForegroundColor Green
} else {
    Write-Host "❌ APK não encontrado em: $APK_SOURCE" -ForegroundColor Red
    exit 1
}

# 4. Copiar arquivos PayGo necessários
Write-Host "💳 Copiando arquivos PayGo..." -ForegroundColor Yellow
$PAYGO_DIR = "$BUILD_DIR\paygo_files"
New-Item -ItemType Directory -Path $PAYGO_DIR | Out-Null

# Caminhos dos arquivos PayGo
$PAYGO_CERT = "C:\Users\ideapad GAMING\Desktop\Kit-PayGo-Android-v4.1.50.5\Kit-PayGo-Android-v4.1.50.5\Desenvolvimento\PayGo Integrado CERT (APK)\Padrão\PGIntegrado-v4.1.50.5_CERT_geral_250605.zip"
$PAYGO_PROD = "C:\Users\ideapad GAMING\Desktop\Kit-PayGo-Android-v4.1.50.5\Kit-PayGo-Android-v4.1.50.5\Produção\Padrão\PGIntegrado-v4.1.50.5_PROD_geral_250605.zip"

if (Test-Path $PAYGO_CERT) {
    Copy-Item $PAYGO_CERT $PAYGO_DIR
    Write-Host "✅ PayGo CERT copiado" -ForegroundColor Green
} else {
    Write-Host "⚠️  PayGo CERT não encontrado: $PAYGO_CERT" -ForegroundColor Yellow
}

if (Test-Path $PAYGO_PROD) {
    Copy-Item $PAYGO_PROD $PAYGO_DIR
    Write-Host "✅ PayGo PROD copiado" -ForegroundColor Green
} else {
    Write-Host "⚠️  PayGo PROD não encontrado: $PAYGO_PROD" -ForegroundColor Yellow
}

# 5. Criar documentação de instalação
Write-Host "📚 Criando documentação..." -ForegroundColor Yellow
$INSTALL_DOC = @"
# Instalação no Tablet - Top Lavanderia PayGo

## Arquivos Incluídos

- TopLavanderia_v1.0.0_PayGo_Integrated.apk - Aplicativo principal
- paygo_files/ - Arquivos do PayGo Integrado

## Pré-requisitos

1. Tablet Android com versão 5.1 ou superior
2. PPC930 conectado via USB
3. Conexão de rede para configuração inicial

## Passos de Instalação

### 1. Instalar PayGo Integrado

#### Para Testes (CERT):
adb install paygo_files/PGIntegrado-v4.1.50.5_CERT_geral_250605.apk

#### Para Produção (PROD):
adb install paygo_files/PGIntegrado-v4.1.50.5_PROD_geral_250605.apk

### 2. Configurar PayGo Integrado

1. Abrir o aplicativo "PayGo Integrado"
2. Clicar em "Parear Bluetooth"
3. Selecionar o PPC930 na lista de dispositivos
4. Inserir senha de pareamento se solicitado
5. Configurar o dispositivo

### 3. Instalar Ponto de Captura

1. Iniciar operação administrativa
2. Selecionar "INSTALACAO"
3. Inserir senha técnica: 314159
4. Indicar o ponto de captura
5. Inserir CNPJ do estabelecimento
6. Confirmar servidor e porta TCP
7. Aguardar impressão do comprovante

### 4. Instalar Top Lavanderia

adb install TopLavanderia_v1.0.0_PayGo_Integrated.apk

### 5. Configurar Top Lavanderia

1. Abrir o aplicativo
2. Ir para Configurações > PayGo
3. Configurar:
   - Host: IP do servidor PayGo
   - Porta: 3000 (padrão)
   - Chave de Automação: Fornecida pela PayGo
4. Testar conexão

## Configurações de Rede

### PayGo Integrado
- Host: IP do servidor PayGo
- Porta: 3000 (padrão)
- Protocolo: TCP

### Top Lavanderia
- API Endpoint: Configurado nas configurações
- PayGo Integration: Ativada por padrão

## Teste de Funcionamento

1. Teste de Conexão:
   - Abrir Top Lavanderia
   - Ir para Diagnósticos > PayGo
   - Verificar status da conexão

2. Teste de Pagamento:
   - Selecionar máquina
   - Escolher método de pagamento
   - Inserir cartão no PPC930
   - Verificar aprovação

## Solução de Problemas

### PayGo não conecta
- Verificar se PPC930 está conectado
- Verificar configurações de rede
- Reiniciar PayGo Integrado

### Pagamento não processa
- Verificar se PayGo Integrado está rodando
- Verificar conexão USB
- Verificar logs do Android

### Aplicativo não inicia
- Verificar permissões
- Verificar espaço em disco
- Reinstalar aplicativo

## Logs e Diagnósticos

### Android Logs
adb logcat | grep -E "(TopLavanderia|PayGO|PayGOManager)"

### PayGo Logs
adb logcat | grep "PayGo"

## Suporte

Para suporte técnico:
- Verificar logs do sistema
- Documentar erros encontrados
- Contactar equipe de desenvolvimento

## Versões

- Top Lavanderia: v1.0.0
- PayGo Integrado: v4.1.50.5
- InterfaceAutomacao: v2.1.0.6
- Android: 5.1+ (API 22+)
"@

$INSTALL_DOC | Out-File -FilePath "$BUILD_DIR\INSTALACAO_TABLET.md" -Encoding UTF8

# 6. Criar script de instalação automática
Write-Host "🔧 Criando script de instalação..." -ForegroundColor Yellow
$INSTALL_SCRIPT = @"
@echo off
echo 🚀 Instalando Top Lavanderia no tablet...

REM Verificar se ADB está disponível
adb version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ADB não encontrado. Instale o Android SDK.
    pause
    exit /b 1
)

REM Verificar se dispositivo está conectado
adb devices | findstr "device$" >nul
if %errorlevel% neq 0 (
    echo ❌ Nenhum dispositivo Android conectado.
    pause
    exit /b 1
)

echo 📱 Dispositivo encontrado. Iniciando instalação...

REM Instalar PayGo Integrado (CERT para testes)
echo 💳 Instalando PayGo Integrado...
if exist "paygo_files\PGIntegrado-v4.1.50.5_CERT_geral_250605.apk" (
    adb install paygo_files\PGIntegrado-v4.1.50.5_CERT_geral_250605.apk
    echo ✅ PayGo Integrado instalado
) else (
    echo ⚠️  APK do PayGo não encontrado. Instale manualmente.
)

REM Instalar Top Lavanderia
echo 🏪 Instalando Top Lavanderia...
if exist "TopLavanderia_v1.0.0_PayGo_Integrated.apk" (
    adb install TopLavanderia_v1.0.0_PayGo_Integrated.apk
    echo ✅ Top Lavanderia instalado
) else (
    echo ❌ APK do Top Lavanderia não encontrado.
    pause
    exit /b 1
)

echo 🎉 Instalação concluída!
echo 📋 Próximos passos:
echo 1. Abrir PayGo Integrado e configurar
echo 2. Instalar ponto de captura
echo 3. Abrir Top Lavanderia e testar
pause
"@

$INSTALL_SCRIPT | Out-File -FilePath "$BUILD_DIR\install_tablet.bat" -Encoding ASCII

# 7. Criar arquivo de configuração
Write-Host "⚙️  Criando arquivo de configuração..." -ForegroundColor Yellow
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

# 8. Criar checklist de verificação
Write-Host "✅ Criando checklist de verificação..." -ForegroundColor Yellow
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
- [ ] Top Lavanderia instalado com sucesso
- [ ] Nenhum erro durante a instalação

## Após a Instalação

### PayGo Integrado
- [ ] Aplicativo abre normalmente
- [ ] PPC930 detectado e pareado
- [ ] Ponto de captura instalado
- [ ] Comprovante de instalação impresso

### Top Lavanderia
- [ ] Aplicativo abre em modo kiosk
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

# 9. Criar resumo do pacote
Write-Host "📋 Criando resumo do pacote..." -ForegroundColor Yellow
$README = @"
# Top Lavanderia - Pacote para Tablet

## Visão Geral

Este pacote contém todos os arquivos necessários para instalar e executar o sistema Top Lavanderia com integração PayGo em um tablet Android.

## Conteúdo do Pacote

tablet_package/
├── TopLavanderia_v1.0.0_PayGo_Integrated.apk    # Aplicativo principal
├── paygo_files/                                  # Arquivos PayGo
│   ├── PGIntegrado-v4.1.50.5_CERT_geral_250605.zip
│   └── PGIntegrado-v4.1.50.5_PROD_geral_250605.zip
├── install_tablet.bat                           # Script de instalação
├── config.json                                  # Configurações
├── INSTALACAO_TABLET.md                         # Manual de instalação
├── CHECKLIST_VERIFICACAO.md                     # Checklist de verificação
└── README.md                                    # Este arquivo

## Instalação Rápida

1. Conectar tablet via USB
2. Executar: install_tablet.bat
3. Seguir: INSTALACAO_TABLET.md

## Características Técnicas

- Android: 5.1+ (API 22+)
- PayGo: v4.1.50.5
- Interface: v2.1.0.6
- Dispositivo: PPC930
- Modo: Kiosk

## Suporte

Para suporte técnico, consulte a documentação incluída ou entre em contato com a equipe de desenvolvimento.

## Versão

v1.0.0 - Integração PayGo completa
"@

$README | Out-File -FilePath "$BUILD_DIR\README.md" -Encoding UTF8

# 10. Criar arquivo de versão
Write-Host "📝 Criando arquivo de versão..." -ForegroundColor Yellow
$VERSION_INFO = @"
Top Lavanderia - Pacote para Tablet
==================================

Versão: 1.0.0
Data: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Build: $(git rev-parse --short HEAD 2>$null)

Componentes:
- Top Lavanderia App: 1.0.0
- PayGo Integrado: 4.1.50.5
- InterfaceAutomacao: 2.1.0.6
- Android Target: API 22+
- Capacitor: $(npm list @capacitor/core --depth=0 2>$null | Select-String "@capacitor/core" | ForEach-Object { $_.Line.Split()[1] })

Arquivos:
- APK Principal: TopLavanderia_v1.0.0_PayGo_Integrated.apk
- PayGo CERT: PGIntegrado-v4.1.50.5_CERT_geral_250605.zip
- PayGo PROD: PGIntegrado-v4.1.50.5_PROD_geral_250605.zip

Configurações:
- Host Padrão: 192.168.1.100
- Porta Padrão: 3000
- Dispositivo: PPC930
- Modo: Kiosk
"@

$VERSION_INFO | Out-File -FilePath "$BUILD_DIR\VERSION.txt" -Encoding UTF8

# 11. Verificar integridade do build
Write-Host "🔍 Verificando integridade do build..." -ForegroundColor Yellow

# Verificar se APK foi criado
if (Test-Path "$BUILD_DIR\$APK_NAME") {
    $APK_SIZE = (Get-Item "$BUILD_DIR\$APK_NAME").Length
    $APK_SIZE_MB = [math]::Round($APK_SIZE / 1MB, 2)
    Write-Host "📱 Tamanho do APK: $APK_SIZE_MB MB" -ForegroundColor Green
} else {
    Write-Host "❌ APK não foi criado. Verificando build do Android..." -ForegroundColor Red
    exit 1
}

# Verificar arquivos PayGo
if (Test-Path "$BUILD_DIR\paygo_files\PGIntegrado-v4.1.50.5_CERT_geral_250605.zip") {
    Write-Host "✅ PayGo CERT encontrado" -ForegroundColor Green
} else {
    Write-Host "⚠️  Arquivo PayGo CERT não encontrado" -ForegroundColor Yellow
}

if (Test-Path "$BUILD_DIR\paygo_files\PGIntegrado-v4.1.50.5_PROD_geral_250605.zip") {
    Write-Host "✅ PayGo PROD encontrado" -ForegroundColor Green
} else {
    Write-Host "⚠️  Arquivo PayGo PROD não encontrado" -ForegroundColor Yellow
}

# 12. Criar arquivo de checksum
Write-Host "🔐 Criando checksums..." -ForegroundColor Yellow
$CHECKSUM_FILE = "$BUILD_DIR\checksums.md5"
Get-ChildItem -Path $BUILD_DIR -Recurse -Include "*.apk", "*.zip", "*.bat" | ForEach-Object {
    $hash = Get-FileHash $_.FullName -Algorithm MD5
    "$($hash.Hash)  $($_.Name)" | Add-Content $CHECKSUM_FILE
}

# 13. Criar pacote final
Write-Host "📦 Criando pacote final..." -ForegroundColor Yellow
$ZIP_FILE = "TopLavanderia_Tablet_Package_v1.0.0.zip"
if (Test-Path $ZIP_FILE) {
    Remove-Item $ZIP_FILE
}

Compress-Archive -Path "$BUILD_DIR\*" -DestinationPath $ZIP_FILE

Write-Host ""
Write-Host "🎉 Pacote para tablet criado com sucesso!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host "📁 Diretório: $BUILD_DIR" -ForegroundColor Cyan
Write-Host "📱 APK: $APK_NAME" -ForegroundColor Cyan
Write-Host "📦 Pacote: $ZIP_FILE" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Próximos passos:" -ForegroundColor Yellow
Write-Host "1. Transferir arquivos para o tablet" -ForegroundColor White
Write-Host "2. Executar install_tablet.bat" -ForegroundColor White
Write-Host "3. Seguir INSTALACAO_TABLET.md" -ForegroundColor White
Write-Host "4. Usar CHECKLIST_VERIFICACAO.md" -ForegroundColor White
Write-Host ""
Write-Host "✅ Build concluído!" -ForegroundColor Green
