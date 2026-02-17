#!/bin/bash

echo "🚀 Instalando Top Lavanderia no tablet..."

# Verificar ADB
if ! command -v adb &> /dev/null; then
    echo "❌ ADB não encontrado. Instale o Android SDK."
    exit 1
fi

# Verificar dispositivo
if ! adb devices | grep -q "device$"; then
    echo "❌ Nenhum dispositivo Android conectado."
    exit 1
fi

echo "📱 Dispositivo encontrado."

# Instalar PayGo Integrado (CERT para testes)
if [ -f "paygo/PGIntegrado-CERT.apk" ]; then
    echo "💳 Instalando PayGo Integrado CERT..."
    adb install -r paygo/PGIntegrado-CERT.apk
    echo "✅ PayGo Integrado instalado"
else
    echo "⚠️  APK do PayGo CERT não encontrado em paygo/"
fi

# Instalar Top Lavanderia (se APK existir)
APK=$(find . -name "TopLavanderia*.apk" -o -name "app-release.apk" | head -1)
if [ -n "$APK" ]; then
    echo "🏪 Instalando Top Lavanderia: $APK"
    adb install -r "$APK"
    echo "✅ Top Lavanderia instalado"
else
    echo "⚠️  APK do Top Lavanderia não encontrado. Compile primeiro (ver BUILD_APK.md)"
fi

echo ""
echo "🎉 Instalação concluída!"
echo ""
echo "Próximos passos:"
echo "1. Abrir PayGo Integrado e parear com PPC930"
echo "2. Instalar ponto de captura (senha: 314159)"
echo "3. Abrir Top Lavanderia e configurar CNPJ"
