# Guia de Implantação - Totem Lavanderia

## Arquivos Necessários para o Tablet Totem

### 1. Build da Aplicação
Após fazer o build do projeto (`npm run build`), copie a pasta `dist/` completa para o tablet.

### 2. Configuração do Capacitor
- `capacitor.config.ts` - Configuração principal do Capacitor
- Pasta `android/` (se usando Android) ou `ios/` (se usando iOS)

### 3. Arquivos de Configuração
- `.env` ou configurações de ambiente (se houver)
- Certificados SSL (se necessário)

## Pré-requisitos no Tablet

1. **Android**: Android 7.0+ com Chrome WebView atualizado
2. **iOS**: iOS 13.0+ 
3. Conexão estável com a internet
4. Espaço de armazenamento suficiente (mínimo 500MB)

## Instalação no Tablet

### Para Android:
1. Ative "Fontes desconhecidas" nas configurações
2. Instale o APK gerado pelo Capacitor
3. Configure permissões necessárias
4. Ative modo kiosk (se disponível no dispositivo)

### Para iOS:
1. Instale via TestFlight ou Xcode (desenvolvimento)
2. Configure perfil de provisionamento
3. Ative Modo Guiado nas Configurações de Acessibilidade

## Configurações de Kiosk

### Android:
- Use apps como "Kiosk Browser" ou "SureLock"
- Configure para abrir automaticamente a aplicação
- Desative botões de navegação do sistema

### iOS:
- Use "Modo Guiado" nativo
- Ative em Configurações > Acessibilidade > Modo Guiado
- Configure senha para sair do modo

## Manutenção e Monitoramento

1. Configure auto-start da aplicação
2. Monitore logs de erro
3. Configure backup automático de dados
4. Teste conexão PayGO regularmente

## Troubleshooting

### Problemas Comuns:
- **Aplicação não carrega**: Verificar conexão de internet
- **Tela branca**: Limpar cache do WebView
- **PayGO não funciona**: Verificar configurações de rede e firewall
- **Modo kiosk falha**: Reiniciar dispositivo e reconfigurar