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
adb install -r TopLavanderia_v1.0.0_PayGo_Integrated.apk
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

