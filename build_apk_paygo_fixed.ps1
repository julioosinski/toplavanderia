# Script PowerShell para gerar APK com integração PayGo
# Top Lavanderia - PayGo Integration

Write-Host "🏗️  Construindo APK com integração PayGo - Top Lavanderia" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green

# Configurações
$PROJECT_NAME = "TopLavanderia"
$VERSION = "1.0.0"
$BUILD_DIR = "apk_build"
$APK_NAME = "${PROJECT_NAME}_v${VERSION}_PayGo_Integrated.apk"

# Criar diretório de build
Write-Host "📁 Criando diretório de build..." -ForegroundColor Yellow
if (Test-Path $BUILD_DIR) {
    Remove-Item -Recurse -Force $BUILD_DIR
}
New-Item -ItemType Directory -Path $BUILD_DIR | Out-Null

# 1. Verificar dependências
Write-Host "🔍 Verificando dependências..." -ForegroundColor Yellow

# Verificar se Node.js está instalado
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js não encontrado. Instale o Node.js primeiro." -ForegroundColor Red
    exit 1
}

# Verificar se npm está instalado
try {
    $npmVersion = npm --version
    Write-Host "✅ npm: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ npm não encontrado. Instale o npm primeiro." -ForegroundColor Red
    exit 1
}

# 2. Instalar dependências do projeto
Write-Host "📦 Instalando dependências do projeto..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao instalar dependências. Abortando." -ForegroundColor Red
    exit 1
}

# 3. Build do projeto React/TypeScript
Write-Host "⚛️  Fazendo build do projeto React..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro no build do React. Abortando." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build do React concluído" -ForegroundColor Green

# 4. Verificar se a biblioteca PayGo está presente
Write-Host "💳 Verificando biblioteca PayGo..." -ForegroundColor Yellow
$paygoLib = "android\app\libs\InterfaceAutomacao-v2.1.0.6.aar"
if (Test-Path $paygoLib) {
    Write-Host "✅ Biblioteca PayGo encontrada: $paygoLib" -ForegroundColor Green
} else {
    Write-Host "❌ Biblioteca PayGo não encontrada: $paygoLib" -ForegroundColor Red
    Write-Host "   Certifique-se de que o arquivo InterfaceAutomacao-v2.1.0.6.aar está em android/app/libs/" -ForegroundColor Yellow
    exit 1
}

# 5. Limpar build anterior do Android
Write-Host "🧹 Limpando build anterior do Android..." -ForegroundColor Yellow
Set-Location android
./gradlew clean

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Aviso: Erro ao limpar build anterior, continuando..." -ForegroundColor Yellow
}

# 6. Build do Android (Debug)
Write-Host "🤖 Fazendo build do Android (Debug)..." -ForegroundColor Yellow
./gradlew assembleDebug

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro no build do Android. Verificando logs..." -ForegroundColor Red
    Set-Location ..
    exit 1
}

Set-Location ..

# 7. Verificar se APK foi gerado
Write-Host "📱 Verificando APK gerado..." -ForegroundColor Yellow
$APK_SOURCE = "android\app\build\outputs\apk\debug\app-debug.apk"
if (Test-Path $APK_SOURCE) {
    $APK_SIZE = (Get-Item $APK_SOURCE).Length
    $APK_SIZE_MB = [math]::Round($APK_SIZE / 1MB, 2)
    Write-Host "✅ APK gerado com sucesso: $APK_SIZE_MB MB" -ForegroundColor Green
} else {
    Write-Host "❌ APK não encontrado em: $APK_SOURCE" -ForegroundColor Red
    exit 1
}

# 8. Copiar APK para diretório de build
Write-Host "📋 Copiando APK..." -ForegroundColor Yellow
Copy-Item $APK_SOURCE "$BUILD_DIR\$APK_NAME"
Write-Host "✅ APK copiado: $APK_NAME" -ForegroundColor Green

# 9. Criar arquivo de informações do build
Write-Host "📝 Criando arquivo de informações..." -ForegroundColor Yellow
$BUILD_INFO = @"
Top Lavanderia - APK com Integração PayGo
========================================

Versão: $VERSION
Data de Build: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Tamanho do APK: $APK_SIZE_MB MB

Componentes Incluídos:
- Top Lavanderia App: $VERSION
- PayGo Integration: v2.1.0.6
- Android Target: API 22+
- Capacitor: $(npm list @capacitor/core --depth=0 2>$null | Select-String "@capacitor/core" | ForEach-Object { $_.Line.Split()[1] })

Funcionalidades:
- ✅ Integração PayGo real
- ✅ Comunicação com PPC930
- ✅ Processamento de pagamentos
- ✅ Interface de totem
- ✅ Gerenciamento de máquinas
- ✅ Modo kiosk

Requisitos:
- Android 5.1+ (API 22+)
- PPC930 conectado via USB
- PayGo Integrado instalado
- Conexão de rede

Instalação:
1. Instalar PayGo Integrado (CERT ou PROD)
2. Instalar este APK
3. Configurar conexão PayGo
4. Testar com PPC930

Arquivo: $APK_NAME
"@

$BUILD_INFO | Out-File -FilePath "$BUILD_DIR\BUILD_INFO.txt" -Encoding UTF8

# 10. Criar script de instalação
Write-Host "🔧 Criando script de instalação..." -ForegroundColor Yellow
$INSTALL_SCRIPT = @"
@echo off
echo 🚀 Instalando Top Lavanderia com PayGo...

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
    echo    Conecte o tablet via USB e habilite a depuração USB.
    pause
    exit /b 1
)

echo 📱 Dispositivo encontrado. Iniciando instalação...

REM Instalar APK
echo 💳 Instalando Top Lavanderia...
adb install -r $APK_NAME
if %errorlevel% equ 0 (
    echo ✅ Top Lavanderia instalado com sucesso!
) else (
    echo ❌ Erro ao instalar Top Lavanderia.
    pause
    exit /b 1
)

echo 🎉 Instalação concluída!
echo 📋 Próximos passos:
echo 1. Instalar PayGo Integrado (CERT ou PROD)
echo 2. Configurar PayGo Integrado
echo 3. Conectar PPC930 via USB
echo 4. Abrir Top Lavanderia e testar
echo.
echo 📱 Para abrir o app: adb shell am start -n com.toplavanderia.app/.TotemActivity
pause
"@

$INSTALL_SCRIPT | Out-File -FilePath "$BUILD_DIR\install_apk.bat" -Encoding ASCII

# 11. Criar documentação de instalação
Write-Host "📚 Criando documentação..." -ForegroundColor Yellow
$INSTALL_DOC = @"
# Instalação - Top Lavanderia com PayGo

## Pré-requisitos

1. **Tablet Android 5.1+** com depuração USB habilitada
2. **PPC930** conectado via USB
3. **PayGo Integrado** instalado (CERT para testes, PROD para produção)
4. **Conexão de rede** para configuração inicial

## Passos de Instalação

### 1. Instalar PayGo Integrado

#### Para Testes (CERT):
- Baixar: PGIntegrado-v4.1.50.5_CERT_geral_250605.apk
- Instalar: adb install PGIntegrado-v4.1.50.5_CERT_geral_250605.apk

#### Para Produção (PROD):
- Baixar: PGIntegrado-v4.1.50.5_PROD_geral_250605.apk
- Instalar: adb install PGIntegrado-v4.1.50.5_PROD_geral_250605.apk

### 2. Configurar PayGo Integrado

1. Abrir o aplicativo "PayGo Integrado"
2. Clicar em "Parear Bluetooth"
3. Selecionar o PPC930 na lista de dispositivos
4. Inserir senha de pareamento se solicitado
5. Configurar o dispositivo

### 3. Instalar Top Lavanderia

```bash
# Instalar APK
adb install -r $APK_NAME

# Abrir aplicativo
adb shell am start -n com.toplavanderia.app/.TotemActivity
```

### 4. Configurar Top Lavanderia

1. Abrir o aplicativo
2. Ir para Configurações > PayGo
3. Configurar:
   - Host: IP do servidor PayGo
   - Porta: 3000 (padrão)
   - Chave de Automação: Fornecida pela PayGo
4. Testar conexão

## Teste de Funcionamento

### 1. Teste de Conexão
- Abrir Top Lavanderia
- Verificar status da conexão PayGo
- Verificar detecção do PPC930

### 2. Teste de Pagamento
- Selecionar máquina disponível
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
```bash
adb logcat | grep -E "(TopLavanderia|PayGO|PayGOManager)"
```

### PayGo Logs
```bash
adb logcat | grep "PayGo"
```

## Suporte

Para suporte técnico:
- Verificar logs do sistema
- Documentar erros encontrados
- Contactar equipe de desenvolvimento

## Versões

- Top Lavanderia: $VERSION
- PayGo Integrado: v4.1.50.5
- InterfaceAutomacao: v2.1.0.6
- Android: 5.1+ (API 22+)
"@

$INSTALL_DOC | Out-File -FilePath "$BUILD_DIR\INSTALACAO.md" -Encoding UTF8

# 12. Criar checksum do APK
Write-Host "🔐 Criando checksum do APK..." -ForegroundColor Yellow
$CHECKSUM = Get-FileHash "$BUILD_DIR\$APK_NAME" -Algorithm MD5
$CHECKSUM_FILE = "$BUILD_DIR\checksum.md5"
"$($CHECKSUM.Hash)  $APK_NAME" | Out-File -FilePath $CHECKSUM_FILE -Encoding ASCII
Write-Host "✅ Checksum criado: $($CHECKSUM.Hash)" -ForegroundColor Green

# 13. Resumo final
Write-Host ""
Write-Host "🎉 APK com integração PayGo criado com sucesso!" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host "📁 Diretório: $BUILD_DIR" -ForegroundColor Cyan
Write-Host "📱 APK: $APK_NAME" -ForegroundColor Cyan
Write-Host "📏 Tamanho: $APK_SIZE_MB MB" -ForegroundColor Cyan
Write-Host "🔐 Checksum: $($CHECKSUM.Hash)" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Arquivos incluídos:" -ForegroundColor Yellow
Write-Host "  - $APK_NAME (APK principal)" -ForegroundColor White
Write-Host "  - install_apk.bat (Script de instalação)" -ForegroundColor White
Write-Host "  - INSTALACAO.md (Documentação)" -ForegroundColor White
Write-Host "  - BUILD_INFO.txt (Informações do build)" -ForegroundColor White
Write-Host "  - checksum.md5 (Verificação de integridade)" -ForegroundColor White
Write-Host ""
Write-Host "📋 Próximos passos:" -ForegroundColor Yellow
Write-Host "1. Instalar PayGo Integrado no tablet" -ForegroundColor White
Write-Host "2. Executar install_apk.bat" -ForegroundColor White
Write-Host "3. Seguir INSTALACAO.md" -ForegroundColor White
Write-Host "4. Testar com PPC930" -ForegroundColor White
Write-Host ""
Write-Host "✅ Build concluído!" -ForegroundColor Green

