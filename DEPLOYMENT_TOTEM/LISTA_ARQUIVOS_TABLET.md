# 📋 Lista de Arquivos para Tablet Android

## ✅ Arquivos OBRIGATÓRIOS (Essenciais)

### 1. Aplicação Principal
```
📱 android/app/build/outputs/apk/release/app-release.apk
```
**Descrição:** Aplicação principal do totem  
**Como obter:** `npm run build && npx cap sync android && npx cap build android --prod`

### 2. Configuração Capacitor
```
⚙️ capacitor.config.ts
```
**Descrição:** Configuração principal da aplicação  
**Localização:** Raiz do projeto

### 3. Template de Configuração PayGO
```
🔧 DEPLOYMENT_TOTEM/config_template.json
```
**Descrição:** Template para configurar PayGO no tablet

## 📚 Documentação ESSENCIAL

### 4. Guia de Instalação
```
📖 DEPLOYMENT_TOTEM/README_TOTEM.md
```
**Descrição:** Instruções completas de instalação no tablet

### 5. Checklist de Deployment
```
✅ DEPLOYMENT_TOTEM/deployment_checklist.md
```
**Descrição:** Lista de verificação para implantação

### 6. Guia PayGO PPC930
```
💳 PAYGO_PPC930_DOCUMENTATION.md
```
**Descrição:** Documentação completa da integração PayGO

## 🆘 Suporte e Troubleshooting

### 7. FAQ e Soluções
```
❓ docs/06-SUPPORT/FAQ.md
🔧 docs/02-PAYGO-INTEGRATION/PAYGO_TROUBLESHOOTING.md
📞 docs/06-SUPPORT/CONTACT_INFO.md
```

## 🚀 COMO USAR

### Opção 1: Script Automático
```bash
# Execute o script para criar pacote completo
chmod +x DEPLOYMENT_TOTEM/create_tablet_package.sh
./DEPLOYMENT_TOTEM/create_tablet_package.sh
```

### Opção 2: Cópia Manual
```bash
# Criar pasta
mkdir tablet-files

# Copiar arquivos essenciais
cp android/app/build/outputs/apk/release/app-release.apk tablet-files/
cp capacitor.config.ts tablet-files/
cp DEPLOYMENT_TOTEM/config_template.json tablet-files/
cp DEPLOYMENT_TOTEM/README_TOTEM.md tablet-files/
cp DEPLOYMENT_TOTEM/deployment_checklist.md tablet-files/
cp PAYGO_PPC930_DOCUMENTATION.md tablet-files/

# Copiar documentação de suporte
mkdir tablet-files/support
cp docs/06-SUPPORT/FAQ.md tablet-files/support/
cp docs/02-PAYGO-INTEGRATION/PAYGO_TROUBLESHOOTING.md tablet-files/support/
cp docs/06-SUPPORT/CONTACT_INFO.md tablet-files/support/
```

## 📦 Estrutura Final para Tablet

```
tablet-files/
├── 📱 app-release.apk              ← APLICAÇÃO PRINCIPAL
├── ⚙️ capacitor.config.ts          ← CONFIGURAÇÃO APP
├── 🔧 config_template.json         ← TEMPLATE PAYGO
├── 📖 README_TOTEM.md              ← GUIA INSTALAÇÃO
├── ✅ deployment_checklist.md      ← CHECKLIST
├── 💳 PAYGO_PPC930_DOCUMENTATION.md ← GUIA PAYGO
└── support/
    ├── ❓ FAQ.md
    ├── 🔧 PAYGO_TROUBLESHOOTING.md
    └── 📞 CONTACT_INFO.md
```

## 🎯 Passos no Tablet

### 1. Antes da Instalação
- [ ] Android 7.0+ instalado
- [ ] 500MB espaço livre
- [ ] PPC930 conectado via USB
- [ ] Conexão internet estável

### 2. Instalação
- [ ] Ativar "Fontes desconhecidas"
- [ ] Instalar `app-release.apk`
- [ ] Configurar rede usando `config_template.json`
- [ ] Seguir `README_TOTEM.md`

### 3. Configuração PayGO
- [ ] Configurar IP do servidor PayGO
- [ ] Testar conexão PPC930
- [ ] Realizar transação teste
- [ ] Validar usando `deployment_checklist.md`

### 4. Testes Finais
- [ ] App abre corretamente
- [ ] Interface responsiva
- [ ] PPC930 detectado
- [ ] Transações funcionando
- [ ] Modo kiosk ativo

## 🚨 IMPORTANTE

⚠️ **SEMPRE teste primeiro em ambiente de desenvolvimento**  
⚠️ **Mantenha backup da configuração original**  
⚠️ **Documente as configurações específicas do cliente**

## 📞 Suporte

Em caso de problemas, consulte:
1. `FAQ.md` - Problemas comuns
2. `PAYGO_TROUBLESHOOTING.md` - Problemas PayGO
3. `CONTACT_INFO.md` - Contatos técnicos