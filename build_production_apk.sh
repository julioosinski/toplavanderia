#!/bin/bash

echo "🚀 ======================================"
echo "🚀 Build APK - Top Lavanderia PayGO"
echo "🚀 ======================================"
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para verificar erros
check_error() {
  if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Erro: $1${NC}"
    exit 1
  fi
}

# 1. Verificar se Node.js está instalado
echo -e "${YELLOW}📦 Verificando dependências...${NC}"
if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Node.js não encontrado. Instale Node.js 18+${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Node.js $(node -v)${NC}"

# 2. Verificar se Android SDK está configurado
if [ -z "$ANDROID_HOME" ]; then
  echo -e "${RED}❌ ANDROID_HOME não configurado${NC}"
  echo "Configure o Android SDK antes de continuar"
  exit 1
fi
echo -e "${GREEN}✅ Android SDK: $ANDROID_HOME${NC}"

# 3. Instalar dependências
echo ""
echo -e "${YELLOW}📦 Instalando dependências...${NC}"
npm install
check_error "Falha ao instalar dependências"

# 4. Build do frontend
echo ""
echo -e "${YELLOW}🔨 Construindo aplicação React...${NC}"
npm run build
check_error "Falha no build do frontend"

# 5. Sync Capacitor
echo ""
echo -e "${YELLOW}🔄 Sincronizando com Capacitor...${NC}"
npx cap sync android
check_error "Falha ao sincronizar Capacitor"

# 6. Verificar biblioteca PayGO
echo ""
echo -e "${YELLOW}📚 Verificando biblioteca PayGO...${NC}"
if [ ! -f "android/app/libs/InterfaceAutomacao-v2.1.0.6.aar" ]; then
  echo -e "${YELLOW}⚠️  Biblioteca PayGO não encontrada em android/app/libs/${NC}"
  echo "Copie InterfaceAutomacao-v2.1.0.6.aar para android/app/libs/"
  read -p "Pressione Enter quando estiver pronto..."
fi

# 7. Escolher tipo de build
echo ""
echo -e "${YELLOW}📱 Tipo de build:${NC}"
echo "1) Debug (para testes)"
echo "2) Release (produção - requer keystore)"
read -p "Escolha (1 ou 2): " BUILD_TYPE

cd android || exit 1

if [ "$BUILD_TYPE" = "1" ]; then
  echo ""
  echo -e "${YELLOW}🔨 Gerando APK Debug...${NC}"
  ./gradlew clean assembleDebug
  check_error "Falha ao gerar APK debug"
  
  APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
  OUTPUT_NAME="toplavanderia-paygo-debug-$(date +%Y%m%d-%H%M).apk"
  
elif [ "$BUILD_TYPE" = "2" ]; then
  echo ""
  echo -e "${YELLOW}🔨 Gerando APK Release...${NC}"
  
  # Verificar keystore
  if [ ! -f "../my-release-key.keystore" ]; then
    echo -e "${RED}❌ Keystore não encontrado: my-release-key.keystore${NC}"
    echo ""
    echo "Gerar novo keystore? (y/n)"
    read -p "> " CREATE_KEYSTORE
    
    if [ "$CREATE_KEYSTORE" = "y" ]; then
      echo "Gerando keystore..."
      keytool -genkey -v -keystore ../my-release-key.keystore \
        -alias toplavanderia -keyalg RSA -keysize 2048 -validity 10000
      check_error "Falha ao gerar keystore"
    else
      echo "Coloque o keystore na raiz do projeto como: my-release-key.keystore"
      exit 1
    fi
  fi
  
  ./gradlew clean assembleRelease
  check_error "Falha ao gerar APK release"
  
  APK_PATH="app/build/outputs/apk/release/app-release-unsigned.apk"
  OUTPUT_NAME="toplavanderia-paygo-release-$(date +%Y%m%d-%H%M).apk"
  
  # Assinar APK
  echo ""
  echo -e "${YELLOW}✍️  Assinando APK...${NC}"
  jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
    -keystore ../my-release-key.keystore \
    "$APK_PATH" toplavanderia
  check_error "Falha ao assinar APK"
  
  # Zipalign
  echo ""
  echo -e "${YELLOW}🗜️  Otimizando APK...${NC}"
  zipalign -v 4 "$APK_PATH" "app/build/outputs/apk/release/app-release-signed.apk"
  check_error "Falha ao otimizar APK"
  
  APK_PATH="app/build/outputs/apk/release/app-release-signed.apk"
  
else
  echo -e "${RED}❌ Opção inválida${NC}"
  exit 1
fi

# 8. Copiar APK para pasta dist
cd ..
mkdir -p dist
cp "android/$APK_PATH" "dist/$OUTPUT_NAME"
check_error "Falha ao copiar APK"

# 9. Calcular tamanho do APK
APK_SIZE=$(du -h "dist/$OUTPUT_NAME" | cut -f1)

# 10. Sucesso!
echo ""
echo -e "${GREEN}✅ ======================================"
echo "✅ APK gerado com sucesso!"
echo "✅ ======================================${NC}"
echo ""
echo -e "${GREEN}📦 Arquivo: dist/$OUTPUT_NAME${NC}"
echo -e "${GREEN}📊 Tamanho: $APK_SIZE${NC}"
echo ""
echo -e "${YELLOW}📱 Próximos passos:${NC}"
echo "1. Instalar no tablet:"
echo "   adb install dist/$OUTPUT_NAME"
echo ""
echo "2. Ou copiar para tablet via USB/rede"
echo ""
echo "3. Configurar tablet em modo Kiosk"
echo ""
echo -e "${GREEN}🎉 Pronto para testar!${NC}"
