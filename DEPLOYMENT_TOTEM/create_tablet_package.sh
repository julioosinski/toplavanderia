#!/bin/bash

# Script para criar pacote completo para tablet Android
# Autor: Sistema Lavanderia Totem
# Versão: 1.0

echo "🚀 Criando pacote para Tablet Android..."

# Criar estrutura de diretórios
PACKAGE_DIR="tablet-android-package"
mkdir -p "$PACKAGE_DIR"/{app,config,docs,support,tools}

echo "📁 Estrutura de diretórios criada"

# Verificar se o APK existe
APK_PATH="android/app/build/outputs/apk/release/app-release.apk"
if [ -f "$APK_PATH" ]; then
    cp "$APK_PATH" "$PACKAGE_DIR/app/"
    echo "✅ APK copiado"
else
    echo "❌ APK não encontrado. Execute primeiro:"
    echo "   npm run build"
    echo "   npx cap sync android"
    echo "   npx cap build android --prod"
    exit 1
fi

# Copiar arquivos de configuração
if [ -f "capacitor.config.ts" ]; then
    cp "capacitor.config.ts" "$PACKAGE_DIR/config/"
    echo "✅ capacitor.config.ts copiado"
fi

if [ -f "DEPLOYMENT_TOTEM/config_template.json" ]; then
    cp "DEPLOYMENT_TOTEM/config_template.json" "$PACKAGE_DIR/config/"
    echo "✅ config_template.json copiado"
fi

# Copiar documentação principal
DOCS_FILES=(
    "DEPLOYMENT_TOTEM/README_TOTEM.md"
    "DEPLOYMENT_TOTEM/build_instructions.md"
    "DEPLOYMENT_TOTEM/deployment_checklist.md"
    "DEPLOYMENT_TOTEM/PAYGO_INTEGRATION_GUIDE.md"
    "PAYGO_PPC930_DOCUMENTATION.md"
    "INTEGRATION_GUIDE.md"
    "README.md"
)

for file in "${DOCS_FILES[@]}"; do
    if [ -f "$file" ]; then
        cp "$file" "$PACKAGE_DIR/docs/"
        echo "✅ $(basename "$file") copiado"
    fi
done

# Copiar documentação estruturada
if [ -d "docs" ]; then
    cp -r docs/* "$PACKAGE_DIR/docs/"
    echo "✅ Documentação estruturada copiada"
fi

# Copiar arquivos de suporte
SUPPORT_FILES=(
    "docs/06-SUPPORT/FAQ.md"
    "docs/06-SUPPORT/CONTACT_INFO.md"
    "docs/02-PAYGO-INTEGRATION/PAYGO_TROUBLESHOOTING.md"
)

for file in "${SUPPORT_FILES[@]}"; do
    if [ -f "$file" ]; then
        cp "$file" "$PACKAGE_DIR/support/"
        echo "✅ $(basename "$file") copiado"
    fi
done

# Criar arquivo de instruções rápidas
cat > "$PACKAGE_DIR/INSTALACAO_RAPIDA.md" << EOF
# 🚀 Instalação Rápida - Tablet Android

## 1. Pré-requisitos
- Android 7.0+ 
- 500MB espaço livre
- Conexão internet estável
- PPC930 conectado via USB

## 2. Instalação
1. Ativar "Fontes desconhecidas" no Android
2. Instalar: \`app/app-release.apk\`
3. Configurar rede em \`config/config_template.json\`
4. Testar conexão PPC930

## 3. Configuração PayGO
- Host: IP do servidor PayGO
- Porta: 60906 (padrão)
- Automation Key: fornecida pelo PayGO

## 4. Testes
- [ ] App abre corretamente
- [ ] PPC930 detectado
- [ ] Transação teste OK

## 5. Suporte
Ver pasta \`support/\` para troubleshooting completo.
EOF

# Criar script de verificação
cat > "$PACKAGE_DIR/tools/verificar_instalacao.sh" << 'EOF'
#!/bin/bash
echo "🔍 Verificando instalação do tablet..."

# Verificar se o APK está instalado
if adb shell pm list packages | grep -q "app.lovable.toplavanderia"; then
    echo "✅ App instalado"
else
    echo "❌ App não encontrado"
fi

# Verificar dispositivos USB
echo "📱 Dispositivos USB conectados:"
adb shell lsusb 2>/dev/null || echo "Comando lsusb não disponível"

# Verificar conectividade de rede
echo "🌐 Testando conectividade:"
adb shell ping -c 1 8.8.8.8 > /dev/null && echo "✅ Internet OK" || echo "❌ Sem internet"

echo "✅ Verificação concluída"
EOF

chmod +x "$PACKAGE_DIR/tools/verificar_instalacao.sh"

# Criar arquivo de versão
cat > "$PACKAGE_DIR/VERSION.txt" << EOF
Totem Lavanderia - Pacote Android
Versão: 1.0.0
Data: $(date '+%Y-%m-%d %H:%M:%S')
Build: $(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

Conteúdo:
- Aplicação Android (APK)
- Configurações PayGO PPC930
- Documentação completa
- Scripts de suporte
- Troubleshooting guides
EOF

# Criar arquivo ZIP
ZIP_NAME="tablet-android-totem-$(date +%Y%m%d).zip"
if command -v zip &> /dev/null; then
    cd "$PACKAGE_DIR" && zip -r "../$ZIP_NAME" . && cd ..
    echo "📦 Pacote ZIP criado: $ZIP_NAME"
else
    echo "📦 Pacote criado em: $PACKAGE_DIR"
    echo "ℹ️  Para criar ZIP, instale o comando 'zip' ou use outro compactador"
fi

# Relatório final
echo ""
echo "🎉 PACOTE CRIADO COM SUCESSO!"
echo "📂 Localização: $PACKAGE_DIR"
echo "📦 Arquivo ZIP: $ZIP_NAME"
echo ""
echo "📋 Conteúdo do pacote:"
echo "   📱 app/app-release.apk (aplicação principal)"
echo "   ⚙️  config/ (configurações)"
echo "   📚 docs/ (documentação completa)"
echo "   🆘 support/ (suporte e troubleshooting)"
echo "   🔧 tools/ (ferramentas de verificação)"
echo ""
echo "🚚 Pronto para transferir ao tablet!"