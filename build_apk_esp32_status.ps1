Write-Host "=== COMPILANDO APK COM STATUS ESP32 ===" -ForegroundColor Green

# Limpar builds anteriores
Write-Host "Limpando builds anteriores..." -ForegroundColor Yellow
if (Test-Path "android/app/build") {
    Remove-Item -Recurse -Force "android/app/build"
}

# Sincronizar com Capacitor
Write-Host "Sincronizando com Capacitor..." -ForegroundColor Yellow
npx cap sync android

# Compilar APK
Write-Host "Compilando APK..." -ForegroundColor Yellow
cd android
./gradlew assembleDebug
cd ..

# Verificar se o APK foi criado
$apkPath = "android/app/build/outputs/apk/debug/app-debug.apk"
if (Test-Path $apkPath) {
    Write-Host "APK compilado com sucesso!" -ForegroundColor Green
    
    # Instalar no dispositivo
    Write-Host "Instalando APK no dispositivo..." -ForegroundColor Yellow
    adb install -r $apkPath
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "APK instalado com sucesso!" -ForegroundColor Green
        
        # Iniciar a aplicação
        Write-Host "Iniciando aplicação..." -ForegroundColor Yellow
        adb shell am start -n com.toplavanderia.app/app.lovable.toplavanderia.TotemActivity
        
        Write-Host "=== APK ATUALIZADO COM STATUS ESP32 ===" -ForegroundColor Green
        Write-Host "Agora as maquinas mostrarao status correto baseado no ESP32:" -ForegroundColor Cyan
        Write-Host "- Verde DISPONIVEL: ESP32 online + maquina livre" -ForegroundColor Green
        Write-Host "- Amarelo OCUPADA: ESP32 online + maquina ocupada" -ForegroundColor Yellow
        Write-Host "- Laranja MANUTENCAO: ESP32 online + maquina em manutencao" -ForegroundColor Yellow
        Write-Host "- Cinza OFFLINE: ESP32 offline (indisponivel)" -ForegroundColor Red
        Write-Host "Apenas maquinas DISPONIVEIS permitem pagamento!" -ForegroundColor Cyan
    } else {
        Write-Host "Erro ao instalar APK!" -ForegroundColor Red
    }
} else {
    Write-Host "Erro ao compilar APK!" -ForegroundColor Red
}
