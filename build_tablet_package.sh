#!/bin/bash

# Script para gerar o pacote completo para o tablet
# Top Lavanderia - PayGo Integration

echo "🏗️  Construindo pacote para tablet - Top Lavanderia PayGo Integration"
echo "=================================================================="

# Configurações
PROJECT_NAME="TopLavanderia"
VERSION="1.0.0"
BUILD_DIR="tablet_package"
APK_NAME="${PROJECT_NAME}_v${VERSION}_PayGo_Integrated.apk"

# Criar diretório de build
echo "📁 Criando diretório de build..."
rm -rf $BUILD_DIR
mkdir -p $BUILD_DIR

# 1. Build do projeto React/TypeScript
echo "⚛️  Fazendo build do projeto React..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Erro no build do React. Abortando."
    exit 1
fi

# 2. Build do Android
echo "🤖 Fazendo build do Android..."
cd android
./gradlew assembleRelease

if [ $? -ne 0 ]; then
    echo "❌ Erro no build do Android. Abortando."
    exit 1
fi

cd ..

# 3. Copiar APK gerado
echo "📱 Copiando APK..."
cp android/app/build/outputs/apk/release/app-release.apk $BUILD_DIR/$APK_NAME

# 4. Copiar arquivos PayGo necessários
echo "💳 Copiando arquivos PayGo..."
mkdir -p $BUILD_DIR/paygo_files

# Copiar APKs do PayGo
cp "C:\Users\ideapad GAMING\Desktop\Kit-PayGo-Android-v4.1.50.5\Kit-PayGo-Android-v4.1.50.5\Desenvolvimento\PayGo Integrado CERT (APK)\Padrão\PGIntegrado-v4.1.50.5_CERT_geral_250605.zip" $BUILD_DIR/paygo_files/
cp "C:\Users\ideapad GAMING\Desktop\Kit-PayGo-Android-v4.1.50.5\Kit-PayGo-Android-v4.1.50.5\Produção\Padrão\PGIntegrado-v4.1.50.5_PROD_geral_250605.zip" $BUILD_DIR/paygo_files/

# 5. Criar documentação de instalação
echo "📚 Criando documentação..."
cat > $BUILD_DIR/INSTALACAO_TABLET.md << 'EOF'
# Instalação no Tablet - Top Lavanderia PayGo

## Arquivos Incluídos

- `TopLavanderia_v1.0.0_PayGo_Integrated.apk` - Aplicativo principal
- `paygo_files/` - Arquivos do PayGo Integrado

## Pré-requisitos

1. **Tablet Android** com versão 5.1 ou superior
2. **PPC930** conectado via USB
3. **Conexão de rede** para configuração inicial

## Passos de Instalação

### 1. Instalar PayGo Integrado

#### Para Testes (CERT):
```bash
adb install paygo_files/PGIntegrado-v4.1.50.5_CERT_geral_250605.apk
```

#### Para Produção (PROD):
```bash
adb install paygo_files/PGIntegrado-v4.1.50.5_PROD_geral_250605.apk
```

### 2. Configurar PayGo Integrado

1. Abrir o aplicativo "PayGo Integrado"
2. Clicar em "Parear Bluetooth"
3. Selecionar o PPC930 na lista de dispositivos
4. Inserir senha de pareamento se solicitado
5. Configurar o dispositivo

### 3. Instalar Ponto de Captura

1. Iniciar operação administrativa
2. Selecionar "INSTALACAO"
3. Inserir senha técnica: `314159`
4. Indicar o ponto de captura
5. Inserir CNPJ do estabelecimento
6. Confirmar servidor e porta TCP
7. Aguardar impressão do comprovante

### 4. Instalar Top Lavanderia

```bash
adb install TopLavanderia_v1.0.0_PayGo_Integrated.apk
```

### 5. Configurar Top Lavanderia

1. Abrir o aplicativo
2. Ir para Configurações > PayGo
3. Configurar:
   - Host: IP do servidor PayGo
   - Porta: 3000 (padrão)
   - Chave de Automação: Fornecida pela PayGo
4. Testar conexão

## Configurações de Rede

### PayGo Integrado
- **Host**: IP do servidor PayGo
- **Porta**: 3000 (padrão)
- **Protocolo**: TCP

### Top Lavanderia
- **API Endpoint**: Configurado nas configurações
- **PayGo Integration**: Ativada por padrão

## Teste de Funcionamento

1. **Teste de Conexão**:
   - Abrir Top Lavanderia
   - Ir para Diagnósticos > PayGo
   - Verificar status da conexão

2. **Teste de Pagamento**:
   - Selecionar máquina
   - Escolher método de pagamento
   - Inserir cartão no PPC930
   - Verificar aprovação

## Solução de Problemas

### PayGo não conecta
- Verificar se PPC930 está conectado
- Verificar configurações de rede
- Reiniciar PayGo Integrado

### Pagamento não processa
- Verificar se PayGo Integrado está rodando
- Verificar conexão USB
- Verificar logs do Android

### Aplicativo não inicia
- Verificar permissões
- Verificar espaço em disco
- Reinstalar aplicativo

## Logs e Diagnósticos

### Android Logs
```bash
adb logcat | grep -E "(TopLavanderia|PayGO|PayGOManager)"
```

### PayGo Logs
```bash
adb logcat | grep "PayGo"
```

## Suporte

Para suporte técnico:
- Verificar logs do sistema
- Documentar erros encontrados
- Contactar equipe de desenvolvimento

## Versões

- **Top Lavanderia**: v1.0.0
- **PayGo Integrado**: v4.1.50.5
- **InterfaceAutomacao**: v2.1.0.6
- **Android**: 5.1+ (API 22+)
EOF

# 6. Criar script de instalação automática
echo "🔧 Criando script de instalação..."
cat > $BUILD_DIR/install_tablet.sh << 'EOF'
#!/bin/bash

echo "🚀 Instalando Top Lavanderia no tablet..."

# Verificar se ADB está disponível
if ! command -v adb &> /dev/null; then
    echo "❌ ADB não encontrado. Instale o Android SDK."
    exit 1
fi

# Verificar se dispositivo está conectado
if ! adb devices | grep -q "device$"; then
    echo "❌ Nenhum dispositivo Android conectado."
    exit 1
fi

echo "📱 Dispositivo encontrado. Iniciando instalação..."

# Instalar PayGo Integrado (CERT para testes)
echo "💳 Instalando PayGo Integrado..."
if [ -f "paygo_files/PGIntegrado-v4.1.50.5_CERT_geral_250605.apk" ]; then
    adb install paygo_files/PGIntegrado-v4.1.50.5_CERT_geral_250605.apk
    echo "✅ PayGo Integrado instalado"
else
    echo "⚠️  APK do PayGo não encontrado. Instale manualmente."
fi

# Instalar Top Lavanderia
echo "🏪 Instalando Top Lavanderia..."
if [ -f "TopLavanderia_v1.0.0_PayGo_Integrated.apk" ]; then
    adb install TopLavanderia_v1.0.0_PayGo_Integrated.apk
    echo "✅ Top Lavanderia instalado"
else
    echo "❌ APK do Top Lavanderia não encontrado."
    exit 1
fi

echo "🎉 Instalação concluída!"
echo "📋 Próximos passos:"
echo "1. Abrir PayGo Integrado e configurar"
echo "2. Instalar ponto de captura"
echo "3. Abrir Top Lavanderia e testar"
EOF

chmod +x $BUILD_DIR/install_tablet.sh

# 7. Criar arquivo de configuração
echo "⚙️  Criando arquivo de configuração..."
cat > $BUILD_DIR/config.json << 'EOF'
{
  "app": {
    "name": "Top Lavanderia",
    "version": "1.0.0",
    "package": "app.lovable.toplavanderia"
  },
  "paygo": {
    "enabled": true,
    "version": "4.1.50.5",
    "interface_version": "2.1.0.6",
    "default_host": "192.168.1.100",
    "default_port": 3000,
    "supported_payments": ["credit", "debit", "pix"],
    "device_support": ["PPC930"]
  },
  "features": {
    "kiosk_mode": true,
    "auto_payment": true,
    "receipt_printing": true,
    "machine_control": true,
    "admin_panel": true
  },
  "requirements": {
    "android_version": "5.1",
    "api_level": 22,
    "usb_support": true,
    "bluetooth_support": true
  }
}
EOF

# 8. Criar checklist de verificação
echo "✅ Criando checklist de verificação..."
cat > $BUILD_DIR/CHECKLIST_VERIFICACAO.md << 'EOF'
# Checklist de Verificação - Top Lavanderia PayGo

## Antes da Instalação

- [ ] Tablet Android 5.1+ conectado via USB
- [ ] ADB habilitado no tablet
- [ ] PPC930 conectado e funcionando
- [ ] Conexão de rede disponível
- [ ] Arquivos de instalação baixados

## Durante a Instalação

- [ ] PayGo Integrado instalado com sucesso
- [ ] Top Lavanderia instalado com sucesso
- [ ] Nenhum erro durante a instalação

## Após a Instalação

### PayGo Integrado
- [ ] Aplicativo abre normalmente
- [ ] PPC930 detectado e pareado
- [ ] Ponto de captura instalado
- [ ] Comprovante de instalação impresso

### Top Lavanderia
- [ ] Aplicativo abre em modo kiosk
- [ ] Interface carrega corretamente
- [ ] Máquinas são detectadas
- [ ] Configurações acessíveis

## Testes Funcionais

### Conexão PayGo
- [ ] Status "Conectado" no diagnóstico
- [ ] PPC930 detectado via USB
- [ ] Comunicação estabelecida

### Processamento de Pagamento
- [ ] Cartão de crédito processado
- [ ] Cartão de débito processado
- [ ] PIX processado (se disponível)
- [ ] Transação cancelada com sucesso

### Controle de Máquinas
- [ ] Máquina ativada após pagamento
- [ ] Tempo de funcionamento correto
- [ ] Máquina desativa automaticamente

### Interface do Usuário
- [ ] Navegação fluida
- [ ] Mensagens claras
- [ ] Feedback visual adequado
- [ ] Tratamento de erros

## Logs e Diagnósticos

- [ ] Logs do Android sem erros críticos
- [ ] Logs do PayGo funcionando
- [ ] Logs da aplicação sem erros
- [ ] Diagnósticos mostram status correto

## Configurações de Produção

- [ ] Host PayGo configurado corretamente
- [ ] Porta TCP configurada
- [ ] Chave de automação inserida
- [ ] Modo kiosk ativado
- [ ] Configurações de segurança aplicadas

## Documentação

- [ ] Manual de instalação revisado
- [ ] Checklist preenchido
- [ ] Logs de instalação salvos
- [ ] Configurações documentadas

## Aprovação Final

- [ ] Todos os testes passaram
- [ ] Sistema funcionando conforme esperado
- [ ] Pronto para uso em produção
- [ ] Equipe treinada no uso

**Data da Verificação**: ___________
**Responsável**: ___________
**Assinatura**: ___________
EOF

# 9. Criar resumo do pacote
echo "📋 Criando resumo do pacote..."
cat > $BUILD_DIR/README.md << 'EOF'
# Top Lavanderia - Pacote para Tablet

## Visão Geral

Este pacote contém todos os arquivos necessários para instalar e executar o sistema Top Lavanderia com integração PayGo em um tablet Android.

## Conteúdo do Pacote

```
tablet_package/
├── TopLavanderia_v1.0.0_PayGo_Integrated.apk    # Aplicativo principal
├── paygo_files/                                  # Arquivos PayGo
│   ├── PGIntegrado-v4.1.50.5_CERT_geral_250605.zip
│   └── PGIntegrado-v4.1.50.5_PROD_geral_250605.zip
├── install_tablet.sh                            # Script de instalação
├── config.json                                  # Configurações
├── INSTALACAO_TABLET.md                         # Manual de instalação
├── CHECKLIST_VERIFICACAO.md                     # Checklist de verificação
└── README.md                                    # Este arquivo
```

## Instalação Rápida

1. **Conectar tablet via USB**
2. **Executar**: `./install_tablet.sh`
3. **Seguir**: `INSTALACAO_TABLET.md`

## Características Técnicas

- **Android**: 5.1+ (API 22+)
- **PayGo**: v4.1.50.5
- **Interface**: v2.1.0.6
- **Dispositivo**: PPC930
- **Modo**: Kiosk

## Suporte

Para suporte técnico, consulte a documentação incluída ou entre em contato com a equipe de desenvolvimento.

## Versão

**v1.0.0** - Integração PayGo completa
EOF

# 10. Criar arquivo de versão
echo "📝 Criando arquivo de versão..."
cat > $BUILD_DIR/VERSION.txt << EOF
Top Lavanderia - Pacote para Tablet
==================================

Versão: 1.0.0
Data: $(date)
Build: $(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

Componentes:
- Top Lavanderia App: 1.0.0
- PayGo Integrado: 4.1.50.5
- InterfaceAutomacao: 2.1.0.6
- Android Target: API 22+
- Capacitor: $(npm list @capacitor/core --depth=0 2>/dev/null | grep @capacitor/core || echo "unknown")

Arquivos:
- APK Principal: TopLavanderia_v1.0.0_PayGo_Integrated.apk
- PayGo CERT: PGIntegrado-v4.1.50.5_CERT_geral_250605.zip
- PayGo PROD: PGIntegrado-v4.1.50.5_PROD_geral_250605.zip

Configurações:
- Host Padrão: 192.168.1.100
- Porta Padrão: 3000
- Dispositivo: PPC930
- Modo: Kiosk
EOF

# 11. Verificar integridade do build
echo "🔍 Verificando integridade do build..."

# Verificar se APK foi criado
if [ ! -f "$BUILD_DIR/$APK_NAME" ]; then
    echo "❌ APK não foi criado. Verificando build do Android..."
    exit 1
fi

# Verificar tamanho do APK
APK_SIZE=$(du -h "$BUILD_DIR/$APK_NAME" | cut -f1)
echo "📱 Tamanho do APK: $APK_SIZE"

# Verificar arquivos PayGo
if [ ! -f "$BUILD_DIR/paygo_files/PGIntegrado-v4.1.50.5_CERT_geral_250605.zip" ]; then
    echo "⚠️  Arquivo PayGo CERT não encontrado"
fi

if [ ! -f "$BUILD_DIR/paygo_files/PGIntegrado-v4.1.50.5_PROD_geral_250605.zip" ]; then
    echo "⚠️  Arquivo PayGo PROD não encontrado"
fi

# 12. Criar arquivo de checksum
echo "🔐 Criando checksums..."
cd $BUILD_DIR
find . -type f -name "*.apk" -o -name "*.zip" -o -name "*.sh" | while read file; do
    echo "$(md5sum "$file" | cut -d' ' -f1)  $file" >> checksums.md5
done
cd ..

# 13. Criar pacote final
echo "📦 Criando pacote final..."
cd $BUILD_DIR
zip -r "../TopLavanderia_Tablet_Package_v1.0.0.zip" .
cd ..

echo ""
echo "🎉 Pacote para tablet criado com sucesso!"
echo "=========================================="
echo "📁 Diretório: $BUILD_DIR"
echo "📱 APK: $APK_NAME"
echo "📦 Pacote: TopLavanderia_Tablet_Package_v1.0.0.zip"
echo ""
echo "📋 Próximos passos:"
echo "1. Transferir arquivos para o tablet"
echo "2. Executar install_tablet.sh"
echo "3. Seguir INSTALACAO_TABLET.md"
echo "4. Usar CHECKLIST_VERIFICACAO.md"
echo ""
echo "✅ Build concluído!"
