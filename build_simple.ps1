# Script simples para gerar pacote do tablet
Write-Host "Construindo pacote para tablet..." -ForegroundColor Green

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

# Build do Android
Write-Host "Fazendo build do Android..." -ForegroundColor Yellow
Set-Location android
./gradlew assembleRelease

if ($LASTEXITCODE -ne 0) {
    Write-Host "Erro no build do Android" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Set-Location ..

# Copiar APK
Write-Host "Copiando APK..." -ForegroundColor Yellow
$APK_SOURCE = "android\app\build\outputs\apk\release\app-release.apk"
if (Test-Path $APK_SOURCE) {
    Copy-Item $APK_SOURCE "$BUILD_DIR\$APK_NAME"
    Write-Host "APK copiado: $APK_NAME" -ForegroundColor Green
} else {
    Write-Host "APK nao encontrado" -ForegroundColor Red
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
}

if (Test-Path $PAYGO_PROD) {
    Copy-Item $PAYGO_PROD $PAYGO_DIR
    Write-Host "PayGo PROD copiado" -ForegroundColor Green
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

if exist "paygo_files\PGIntegrado-v4.1.50.5_CERT_geral_250605.apk" (
    adb install paygo_files\PGIntegrado-v4.1.50.5_CERT_geral_250605.apk
    echo PayGo Integrado instalado
)

if exist "TopLavanderia_v1.0.0_PayGo_Integrated.apk" (
    adb install TopLavanderia_v1.0.0_PayGo_Integrated.apk
    echo Top Lavanderia instalado
)

echo Instalacao concluida!
pause
"@

$INSTALL_SCRIPT | Out-File -FilePath "$BUILD_DIR\install_tablet.bat" -Encoding ASCII

# Criar README
Write-Host "Criando documentacao..." -ForegroundColor Yellow
$README = @"
# Top Lavanderia - Pacote para Tablet

## Instalacao

1. Conectar tablet via USB
2. Executar: install_tablet.bat
3. Configurar PayGo Integrado
4. Testar aplicacao

## Arquivos

- TopLavanderia_v1.0.0_PayGo_Integrated.apk
- paygo_files/ (arquivos PayGo)
- install_tablet.bat

## Versao

v1.0.0 - Integracao PayGo completa
"@

$README | Out-File -FilePath "$BUILD_DIR\README.md" -Encoding UTF8

# Criar ZIP
Write-Host "Criando pacote final..." -ForegroundColor Yellow
$ZIP_FILE = "TopLavanderia_Tablet_Package_v1.0.0.zip"
if (Test-Path $ZIP_FILE) {
    Remove-Item $ZIP_FILE
}

Compress-Archive -Path "$BUILD_DIR\*" -DestinationPath $ZIP_FILE

Write-Host ""
Write-Host "Pacote criado com sucesso!" -ForegroundColor Green
Write-Host "Diretorio: $BUILD_DIR" -ForegroundColor Cyan
Write-Host "ZIP: $ZIP_FILE" -ForegroundColor Cyan
Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor Yellow
Write-Host "1. Transferir arquivos para o tablet" -ForegroundColor White
Write-Host "2. Executar install_tablet.bat" -ForegroundColor White
Write-Host "3. Configurar PayGo Integrado" -ForegroundColor White
Write-Host "4. Testar aplicacao" -ForegroundColor White
