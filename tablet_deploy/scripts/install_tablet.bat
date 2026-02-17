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

if exist "paygo\PGIntegrado-v4.1.50.5_CERT_gertec-signed.apk" (
    echo Instalando PayGo Integrado CERT...
    adb install paygo\PGIntegrado-v4.1.50.5_CERT_gertec-signed.apk
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
