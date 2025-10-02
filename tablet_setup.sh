#!/bin/bash
# Script de configuração para tablet Android
# Top Lavanderia - PayGo Integration

echo "🚀 Configurando Top Lavanderia no tablet..."

# Verificar se dispositivo está conectado
adb devices | grep "device$" > /dev/null
if [ $? -ne 0 ]; then
    echo "❌ Nenhum dispositivo Android conectado."
    exit 1
fi

echo "📱 Dispositivo encontrado. Iniciando configuração..."

# Criar diretório de configuração no tablet
echo "📁 Criando diretório de configuração..."
adb shell mkdir -p /sdcard/TopLavanderia

# Copiar arquivos de configuração
echo "📋 Copiando arquivos de configuração..."
adb push apk_build/INSTALACAO.md /sdcard/TopLavanderia/
adb push apk_build/BUILD_INFO.txt /sdcard/TopLavanderia/

# Criar script de teste no tablet
echo "🔧 Criando script de teste..."
adb shell "echo '#!/system/bin/sh
echo \"Top Lavanderia - Teste de Configuração\"
echo \"=====================================\"
echo \"1. Verificar se PayGo Integrado está instalado\"
echo \"2. Conectar PPC930 via USB\"
echo \"3. Abrir Top Lavanderia\"
echo \"4. Testar pagamento\"
echo \"\"
echo \"Para abrir o app: am start -n com.toplavanderia.app/.TotemActivity\"
' > /sdcard/TopLavanderia/teste_configuracao.sh"

# Dar permissão de execução
adb shell chmod 755 /sdcard/TopLavanderia/teste_configuracao.sh

# Verificar instalação do app
echo "✅ Verificando instalação do aplicativo..."
adb shell pm list packages | grep toplavanderia

# Abrir o aplicativo
echo "🚀 Abrindo Top Lavanderia..."
adb shell am start -n com.toplavanderia.app/.TotemActivity

echo "🎉 Configuração concluída!"
echo "📋 Arquivos transferidos para: /sdcard/Download/ e /sdcard/TopLavanderia/"
echo "📱 Aplicativo instalado e aberto"
echo ""
echo "📋 Próximos passos:"
echo "1. Instalar PayGo Integrado (CERT ou PROD)"
echo "2. Configurar PayGo Integrado com PPC930"
echo "3. Testar pagamentos no totem"

