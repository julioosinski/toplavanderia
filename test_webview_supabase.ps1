# Script para testar se a aplicacao web (React) esta carregando dados do Supabase
# Verifica se o WebView consegue acessar o Supabase

Write-Host "Testando aplicacao web (React) no WebView..." -ForegroundColor Green

# 1. Verificar se a aplicacao esta rodando
Write-Host "1. Verificando aplicacao..." -ForegroundColor Yellow
$appRunning = adb shell "ps | grep toplavanderia"
if ($appRunning) {
    Write-Host "Aplicacao esta rodando" -ForegroundColor Green
} else {
    Write-Host "Aplicacao nao esta rodando" -ForegroundColor Red
    exit 1
}

# 2. Verificar logs do WebView
Write-Host "2. Verificando logs do WebView..." -ForegroundColor Yellow
$webviewLogs = adb logcat -d | Select-String -Pattern "WebView|Chrome|machines|Supabase" | Select-Object -Last 10
if ($webviewLogs) {
    Write-Host "Logs do WebView encontrados:" -ForegroundColor Cyan
    $webviewLogs | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
} else {
    Write-Host "Nenhum log do WebView encontrado" -ForegroundColor Yellow
}

# 3. Verificar se ha erros de JavaScript
Write-Host "3. Verificando erros de JavaScript..." -ForegroundColor Yellow
$jsErrors = adb logcat -d | Select-String -Pattern "JavaScript|JS|Error" | Select-Object -Last 5
if ($jsErrors) {
    Write-Host "Erros de JavaScript encontrados:" -ForegroundColor Red
    $jsErrors | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
} else {
    Write-Host "Nenhum erro de JavaScript encontrado" -ForegroundColor Green
}

# 4. Verificar se a aplicacao consegue carregar a interface
Write-Host "4. Verificando carregamento da interface..." -ForegroundColor Yellow
$interfaceLogs = adb logcat -d | Select-String -Pattern "index.html|main.js|assets" | Select-Object -Last 5
if ($interfaceLogs) {
    Write-Host "Interface carregada:" -ForegroundColor Green
    $interfaceLogs | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
} else {
    Write-Host "Interface nao carregada" -ForegroundColor Yellow
}

# 5. Simular toque na tela para ativar a aplicacao
Write-Host "5. Ativando aplicacao..." -ForegroundColor Yellow
adb shell input tap 500 300
Start-Sleep -Seconds 2

# 6. Verificar logs apos ativacao
Write-Host "6. Verificando logs apos ativacao..." -ForegroundColor Yellow
$recentLogs = adb logcat -d | Select-String -Pattern "machines|Supabase|React" | Select-Object -Last 10
if ($recentLogs) {
    Write-Host "Logs recentes encontrados:" -ForegroundColor Cyan
    $recentLogs | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
} else {
    Write-Host "Nenhum log recente encontrado" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Teste concluido!" -ForegroundColor Green
Write-Host "A aplicacao web deve estar funcionando mesmo com erros no codigo Java nativo" -ForegroundColor Cyan
Write-Host "Verifique a tela do tablet para ver se as maquinas estao sendo exibidas" -ForegroundColor Yellow
