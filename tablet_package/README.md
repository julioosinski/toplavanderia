# Top Lavanderia - Pacote para Tablet

## Visao Geral

Este pacote contem os arquivos necessarios para instalar o sistema Top Lavanderia com integracao PayGo em um tablet Android.

## Conteudo do Pacote

- paygo_files/ - Arquivos do PayGo Integrado
- install_tablet.bat - Script de instalacao
- README.md - Este arquivo

## Instalacao

### 1. Instalar PayGo Integrado

Execute o script de instalacao:
```
install_tablet.bat
```

### 2. Configurar PayGo Integrado

1. Abrir o aplicativo PayGo Integrado
2. Clicar em Parear Bluetooth
3. Selecionar o PPC930 na lista de dispositivos
4. Inserir senha de pareamento se solicitado
5. Configurar o dispositivo

### 3. Instalar Ponto de Captura

1. Iniciar operacao administrativa
2. Selecionar INSTALACAO
3. Inserir senha tecnica: 314159
4. Indicar o ponto de captura
5. Inserir CNPJ do estabelecimento
6. Confirmar servidor e porta TCP
7. Aguardar impressao do comprovante

### 4. Compilar e Instalar Top Lavanderia

Para compilar o aplicativo:

```bash
# Instalar dependencias
npm install

# Build do React
npm run build

# Build do Android
npx cap build android

# Instalar no tablet
npx cap run android
```

## Configuracoes

### PayGo Integrado
- Host: IP do servidor PayGo
- Porta: 3000 (padrao)
- Protocolo: TCP

### Top Lavanderia
- API Endpoint: Configurado nas configuracoes
- PayGo Integration: Ativada por padrao

## Teste de Funcionamento

1. Teste de Conexao:
   - Abrir Top Lavanderia
   - Ir para Diagnosticos > PayGo
   - Verificar status da conexao

2. Teste de Pagamento:
   - Selecionar maquina
   - Escolher metodo de pagamento
   - Inserir cartao no PPC930
   - Verificar aprovacao

## Solucao de Problemas

### PayGo nao conecta
- Verificar se PPC930 esta conectado
- Verificar configuracoes de rede
- Reiniciar PayGo Integrado

### Pagamento nao processa
- Verificar se PayGo Integrado esta rodando
- Verificar conexao USB
- Verificar logs do Android

### Aplicativo nao inicia
- Verificar permissoes
- Verificar espaco em disco
- Reinstalar aplicativo

## Logs e Diagnosticos

### Android Logs
```bash
adb logcat | grep -E "(TopLavanderia|PayGO|PayGOManager)"
```

### PayGo Logs
```bash
adb logcat | grep "PayGo"
```

## Suporte

Para suporte tecnico:
- Verificar logs do sistema
- Documentar erros encontrados
- Contactar equipe de desenvolvimento

## Versoes

- Top Lavanderia: v1.0.0
- PayGo Integrado: v4.1.50.5
- InterfaceAutomacao: v2.1.0.6
- Android: 5.1+ (API 22+)
