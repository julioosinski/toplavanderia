# Instalação - Top Lavanderia com PayGo

## Pré-requisitos

1. **Tablet Android 5.1+** com depuração USB habilitada
2. **PPC930** conectado via USB
3. **PayGo Integrado** instalado (CERT para testes, PROD para produção)
4. **Conexão de rede** para configuração inicial

## Passos de Instalação

### 1. Instalar PayGo Integrado

#### Para Testes (CERT):
- Baixar: PGIntegrado-v4.1.50.5_CERT_geral_250605.apk
- Instalar: adb install PGIntegrado-v4.1.50.5_CERT_geral_250605.apk

#### Para Produção (PROD):
- Baixar: PGIntegrado-v4.1.50.5_PROD_geral_250605.apk
- Instalar: adb install PGIntegrado-v4.1.50.5_PROD_geral_250605.apk

### 2. Configurar PayGo Integrado

1. Abrir o aplicativo "PayGo Integrado"
2. Clicar em "Parear Bluetooth"
3. Selecionar o PPC930 na lista de dispositivos
4. Inserir senha de pareamento se solicitado
5. Configurar o dispositivo

### 3. Instalar Top Lavanderia

```bash
# Instalar APK
adb install -r TopLavanderia_v1.0.0_PayGo_Integrated.apk

# Abrir aplicativo
adb shell am start -n com.toplavanderia.app/.TotemActivity
```

### 4. Configurar Top Lavanderia

1. Abrir o aplicativo
2. Ir para Configurações > PayGo
3. Configurar:
   - Host: IP do servidor PayGo
   - Porta: 3000 (padrão)
   - Chave de Automação: Fornecida pela PayGo
4. Testar conexão

## Teste de Funcionamento

### 1. Teste de Conexão
- Abrir Top Lavanderia
- Verificar status da conexão PayGo
- Verificar detecção do PPC930

### 2. Teste de Pagamento
- Selecionar máquina disponível
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

- Top Lavanderia: 1.0.0
- PayGo Integrado: v4.1.50.5
- InterfaceAutomacao: v2.1.0.6
- Android: 5.1+ (API 22+)

