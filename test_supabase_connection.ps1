# Script para testar conectividade do Supabase no dispositivo
# Executa comandos no tablet para verificar a integracao

Write-Host "Testando conectividade do Supabase no tablet..." -ForegroundColor Green

# 1. Verificar se a aplicacao esta rodando
Write-Host "1. Verificando se a aplicacao esta rodando..." -ForegroundColor Yellow
$appRunning = adb shell "ps | grep toplavanderia"
if ($appRunning) {
    Write-Host "Aplicacao esta rodando" -ForegroundColor Green
} else {
    Write-Host "Aplicacao nao esta rodando" -ForegroundColor Red
}

# 2. Verificar conectividade de rede
Write-Host "2. Testando conectividade de rede..." -ForegroundColor Yellow
$networkTest = adb shell "ping -c 3 8.8.8.8"
if ($networkTest -match "3 received") {
    Write-Host "Conectividade de rede OK" -ForegroundColor Green
} else {
    Write-Host "Problema de conectividade de rede" -ForegroundColor Red
}

# 3. Verificar se consegue acessar o Supabase
Write-Host "3. Testando acesso ao Supabase..." -ForegroundColor Yellow
$supabaseTest = adb shell "curl -s -o /dev/null -w '%{http_code}' https://rkdybjzwiwwqqzjfmerm.supabase.co/rest/v1/machines?select=id&limit=1"
if ($supabaseTest -eq "200") {
    Write-Host "Supabase acessivel" -ForegroundColor Green
} else {
    Write-Host "Problema ao acessar Supabase (HTTP: $supabaseTest)" -ForegroundColor Red
}

# 4. Verificar logs de erro da aplicacao
Write-Host "4. Verificando logs de erro..." -ForegroundColor Yellow
$errorLogs = adb logcat -d | Select-String -Pattern "ERROR|FATAL" | Select-Object -Last 5
if ($errorLogs) {
    Write-Host "Logs de erro encontrados:" -ForegroundColor Yellow
    $errorLogs | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
} else {
    Write-Host "Nenhum erro critico encontrado" -ForegroundColor Green
}

# 5. Verificar se a aplicacao consegue carregar dados
Write-Host "5. Verificando carregamento de dados..." -ForegroundColor Yellow
$dataLogs = adb logcat -d | Select-String -Pattern "machines|ESP32|Supabase" | Select-Object -Last 10
if ($dataLogs) {
    Write-Host "Logs de dados encontrados:" -ForegroundColor Cyan
    $dataLogs | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
} else {
    Write-Host "Nenhum log de dados encontrado" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Teste concluido!" -ForegroundColor Green
Write-Host "Para ver logs em tempo real, execute: adb logcat" -ForegroundColor Cyan