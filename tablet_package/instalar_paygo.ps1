# Script PowerShell para instalar PayGo no tablet
# Execute este script no COMPUTADOR, não no tablet

Write-Host "=== INSTALADOR PAYGO PARA TABLET ===" -ForegroundColor Green
Write-Host ""

# Verificar se ADB está disponível
Write-Host "Verificando ADB..." -ForegroundColor Yellow
try {
    $adbVersion = adb version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ ADB encontrado" -ForegroundColor Green
    } else {
        throw "ADB não encontrado"
    }
} catch {
    Write-Host "❌ ADB não encontrado!" -ForegroundColor Red
    Write-Host "Instale o Android SDK e adicione ao PATH" -ForegroundColor Yellow
    Write-Host "Download: https://developer.android.com/studio" -ForegroundColor Cyan
    pause
    exit 1
}

# Verificar dispositivos conectados
Write-Host "Verificando dispositivos conectados..." -ForegroundColor Yellow
$devices = adb devices
if ($devices -match "device$") {
    Write-Host "✅ Dispositivo Android detectado" -ForegroundColor Green
} else {
    Write-Host "❌ Nenhum dispositivo Android conectado!" -ForegroundColor Red
    Write-Host "Verifique se:" -ForegroundColor Yellow
    Write-Host "1. Tablet está conectado via USB" -ForegroundColor White
    Write-Host "2. Depuração USB está ativada" -ForegroundColor White
    Write-Host "3. Cabo USB está funcionando" -ForegroundColor White
    pause
    exit 1
}

# Verificar se arquivos PayGo existem
Write-Host "Verificando arquivos PayGo..." -ForegroundColor Yellow
$paygoCert = "paygo_files\PGIntegrado-v4.1.50.5_CERT_geral_250605.zip"
$paygoProd = "paygo_files\PGIntegrado-v4.1.50.5_PROD_geral_250605.zip"

if (Test-Path $paygoCert) {
    Write-Host "✅ PayGo CERT encontrado" -ForegroundColor Green
} else {
    Write-Host "❌ PayGo CERT não encontrado: $paygoCert" -ForegroundColor Red
}

if (Test-Path $paygoProd) {
    Write-Host "✅ PayGo PROD encontrado" -ForegroundColor Green
} else {
    Write-Host "❌ PayGo PROD não encontrado: $paygoProd" -ForegroundColor Red
}

# Perguntar qual versão instalar
Write-Host ""
Write-Host "Qual versão do PayGo deseja instalar?" -ForegroundColor Cyan
Write-Host "1. CERT (para testes)" -ForegroundColor White
Write-Host "2. PROD (para produção)" -ForegroundColor White
Write-Host "3. Ambas" -ForegroundColor White
$choice = Read-Host "Digite sua escolha (1-3)"

# Instalar PayGo CERT
if ($choice -eq "1" -or $choice -eq "3") {
    if (Test-Path $paygoCert) {
        Write-Host "Instalando PayGo CERT..." -ForegroundColor Yellow
        adb install $paygoCert
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ PayGo CERT instalado com sucesso!" -ForegroundColor Green
        } else {
            Write-Host "❌ Erro ao instalar PayGo CERT" -ForegroundColor Red
        }
    }
}

# Instalar PayGo PROD
if ($choice -eq "2" -or $choice -eq "3") {
    if (Test-Path $paygoProd) {
        Write-Host "Instalando PayGo PROD..." -ForegroundColor Yellow
        adb install $paygoProd
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ PayGo PROD instalado com sucesso!" -ForegroundColor Green
        } else {
            Write-Host "❌ Erro ao instalar PayGo PROD" -ForegroundColor Red
        }
    }
}

# Verificar instalação
Write-Host "Verificando instalação..." -ForegroundColor Yellow
$installedApps = adb shell pm list packages | findstr paygo
if ($installedApps) {
    Write-Host "✅ PayGo instalado no tablet:" -ForegroundColor Green
    Write-Host $installedApps -ForegroundColor White
} else {
    Write-Host "❌ PayGo não foi instalado" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== PRÓXIMOS PASSOS ===" -ForegroundColor Green
Write-Host "1. No tablet: Abrir PayGo Integrado" -ForegroundColor White
Write-Host "2. Parear com PPC930 via Bluetooth" -ForegroundColor White
Write-Host "3. Instalar ponto de captura" -ForegroundColor White
Write-Host "4. Compilar e instalar Top Lavanderia" -ForegroundColor White
Write-Host ""
Write-Host "Para compilar Top Lavanderia:" -ForegroundColor Cyan
Write-Host "npm install" -ForegroundColor White
Write-Host "npm run build" -ForegroundColor White
Write-Host "npx cap build android" -ForegroundColor White
Write-Host "npx cap run android" -ForegroundColor White
Write-Host ""
pause
