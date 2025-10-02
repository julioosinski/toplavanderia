# Script para rebuild do APK com correcoes do Supabase
# Resolve problemas de conectividade HTTPS no Android

Write-Host "Rebuild APK com correcoes do Supabase..." -ForegroundColor Green

# 1. Limpar builds anteriores
Write-Host "Limpando builds anteriores..." -ForegroundColor Yellow
if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
if (Test-Path "android/app/build") { Remove-Item -Recurse -Force "android/app/build" }

# 2. Build da aplicacao web
Write-Host "Fazendo build da aplicacao web..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Erro no build da aplicacao web" -ForegroundColor Red
    exit 1
}

# 3. Sincronizar com Capacitor
Write-Host "Sincronizando com Capacitor..." -ForegroundColor Yellow
npx cap sync android

if ($LASTEXITCODE -ne 0) {
    Write-Host "Erro na sincronizacao do Capacitor" -ForegroundColor Red
    exit 1
}

# 4. Build do APK
Write-Host "Fazendo build do APK..." -ForegroundColor Yellow
cd android
./gradlew assembleDebug

if ($LASTEXITCODE -ne 0) {
    Write-Host "Erro no build do APK" -ForegroundColor Red
    exit 1
}

cd ..

# 5. Copiar APK para pasta de distribuicao
Write-Host "Copiando APK..." -ForegroundColor Yellow
$apkPath = "android/app/build/outputs/apk/debug/app-debug.apk"
$destPath = "apk_build/TopLavanderia_v1.0.1_Supabase_Fixed.apk"

if (Test-Path $apkPath) {
    Copy-Item $apkPath $destPath -Force
    Write-Host "APK copiado para: $destPath" -ForegroundColor Green
} else {
    Write-Host "APK nao encontrado em: $apkPath" -ForegroundColor Red
    exit 1
}

# 6. Criar arquivo de informacoes
$buildInfo = @"
TopLavanderia APK - Supabase Fix
================================

Data: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Versao: 1.0.1
Tipo: Debug

Correcoes aplicadas:
- Configuracao de rede HTTPS para Supabase
- Permissoes de rede atualizadas
- Configuracao do Capacitor otimizada
- Ferramentas de debug adicionadas
- Logs melhorados para diagnostico

Arquivo: $destPath
"@

$buildInfo | Out-File -FilePath "apk_build/BUILD_INFO_SUPABASE_FIX.txt" -Encoding UTF8

Write-Host "Build concluido com sucesso!" -ForegroundColor Green
Write-Host "APK: $destPath" -ForegroundColor Cyan
Write-Host "Info: apk_build/BUILD_INFO_SUPABASE_FIX.txt" -ForegroundColor Cyan

Write-Host ""
Write-Host "Para testar a conectividade:" -ForegroundColor Yellow
Write-Host "1. Instale o APK no tablet" -ForegroundColor White
Write-Host "2. Acesse a area Admin" -ForegroundColor White
Write-Host "3. Va para a aba Debug" -ForegroundColor White
Write-Host "4. Execute os testes de conectividade" -ForegroundColor White