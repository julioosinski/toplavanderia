@echo off
echo === INSTALADOR PAYGO PARA TABLET ===
echo.

REM Verificar se ADB está disponível
echo Verificando ADB...
adb version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: ADB não encontrado!
    echo Instale o Android SDK e adicione ao PATH
    echo Download: https://developer.android.com/studio
    pause
    exit /b 1
)
echo ADB encontrado

REM Verificar dispositivos conectados
echo Verificando dispositivos conectados...
adb devices | findstr "device$" >nul
if %errorlevel% neq 0 (
    echo ERRO: Nenhum dispositivo Android conectado!
    echo Verifique se:
    echo 1. Tablet está conectado via USB
    echo 2. Depuração USB está ativada
    echo 3. Cabo USB está funcionando
    pause
    exit /b 1
)
echo Dispositivo Android detectado

REM Verificar arquivos PayGo
echo Verificando arquivos PayGo...
if exist "paygo_files\PGIntegrado-v4.1.50.5_CERT_geral_250605.zip" (
    echo PayGo CERT encontrado
) else (
    echo AVISO: PayGo CERT não encontrado
)

if exist "paygo_files\PGIntegrado-v4.1.50.5_PROD_geral_250605.zip" (
    echo PayGo PROD encontrado
) else (
    echo AVISO: PayGo PROD não encontrado
)

REM Perguntar qual versão instalar
echo.
echo Qual versão do PayGo deseja instalar?
echo 1. CERT (para testes)
echo 2. PROD (para produção)
echo 3. Ambas
set /p choice="Digite sua escolha (1-3): "

REM Instalar PayGo CERT
if "%choice%"=="1" goto install_cert
if "%choice%"=="2" goto install_prod
if "%choice%"=="3" goto install_both
goto invalid_choice

:install_cert
if exist "paygo_files\PGIntegrado-v4.1.50.5_CERT_geral_250605.zip" (
    echo Instalando PayGo CERT...
    adb install paygo_files\PGIntegrado-v4.1.50.5_CERT_geral_250605.zip
    if %errorlevel% equ 0 (
        echo PayGo CERT instalado com sucesso!
    ) else (
        echo Erro ao instalar PayGo CERT
    )
) else (
    echo PayGo CERT não encontrado
)
goto verify_installation

:install_prod
if exist "paygo_files\PGIntegrado-v4.1.50.5_PROD_geral_250605.zip" (
    echo Instalando PayGo PROD...
    adb install paygo_files\PGIntegrado-v4.1.50.5_PROD_geral_250605.zip
    if %errorlevel% equ 0 (
        echo PayGo PROD instalado com sucesso!
    ) else (
        echo Erro ao instalar PayGo PROD
    )
) else (
    echo PayGo PROD não encontrado
)
goto verify_installation

:install_both
if exist "paygo_files\PGIntegrado-v4.1.50.5_CERT_geral_250605.zip" (
    echo Instalando PayGo CERT...
    adb install paygo_files\PGIntegrado-v4.1.50.5_CERT_geral_250605.zip
    if %errorlevel% equ 0 (
        echo PayGo CERT instalado com sucesso!
    ) else (
        echo Erro ao instalar PayGo CERT
    )
)

if exist "paygo_files\PGIntegrado-v4.1.50.5_PROD_geral_250605.zip" (
    echo Instalando PayGo PROD...
    adb install paygo_files\PGIntegrado-v4.1.50.5_PROD_geral_250605.zip
    if %errorlevel% equ 0 (
        echo PayGo PROD instalado com sucesso!
    ) else (
        echo Erro ao instalar PayGo PROD
    )
)
goto verify_installation

:invalid_choice
echo Escolha inválida!
pause
exit /b 1

:verify_installation
echo Verificando instalação...
adb shell pm list packages | findstr paygo
if %errorlevel% equ 0 (
    echo PayGo instalado no tablet
) else (
    echo PayGo não foi instalado
)

echo.
echo === PRÓXIMOS PASSOS ===
echo 1. No tablet: Abrir PayGo Integrado
echo 2. Parear com PPC930 via Bluetooth
echo 3. Instalar ponto de captura
echo 4. Compilar e instalar Top Lavanderia
echo.
echo Para compilar Top Lavanderia:
echo npm install
echo npm run build
echo npx cap build android
echo npx cap run android
echo.
pause
