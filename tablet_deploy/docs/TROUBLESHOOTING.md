# Solução de Problemas - Top Lavanderia

## PayGo não inicializa

**Sintoma**: Diagnóstico mostra "PayGo NÃO inicializado"

**Soluções**:
1. Verificar se o PayGo Integrado APK está instalado
2. Abrir o PayGo Integrado e verificar se funciona isoladamente
3. Verificar logs: `adb logcat | grep "RealPayGoManager"`
4. Reinstalar PayGo Integrado

## PPC930 não detectado

**Sintoma**: "Nenhum pinpad USB detectado"

**Soluções**:
1. Verificar cabo USB conectado firmemente
2. Verificar se PPC930 está ligado (LED aceso)
3. Testar outra porta USB
4. Verificar permissões USB no Android
5. Logs: `adb logcat | grep "USB"`

## Pagamento não processa

**Sintoma**: Tela trava em "Processando pagamento..."

**Soluções**:
1. Verificar se PayGo Integrado está rodando em segundo plano
2. Verificar conexão USB com PPC930
3. Cancelar e tentar novamente
4. Logs: `adb logcat | grep "PayGOPlugin\|RealPayGoManager"`

## Máquinas não aparecem

**Sintoma**: Tela vazia, sem máquinas

**Soluções**:
1. Verificar conexão WiFi do tablet
2. Verificar se o CNPJ está correto
3. Verificar se há máquinas cadastradas no Supabase para essa lavanderia
4. Logs: `adb logcat | grep "SupabaseHelper"`

## ESP32 offline

**Sintoma**: Máquinas aparecem como "offline"

**Soluções**:
1. Verificar se ESP32 está ligado e conectado ao WiFi
2. Verificar heartbeat no Supabase (deve ser < 2 min)
3. Reiniciar o ESP32
4. Verificar rede local (tablet e ESP32 na mesma rede)

## App não inicia

**Sintoma**: Tela preta ou crash

**Soluções**:
1. Verificar espaço em disco: `adb shell df`
2. Limpar cache: `adb shell pm clear com.toplavanderia.app`
3. Reinstalar o APK
4. Verificar logs: `adb logcat | grep "MainActivity"`

## Erro "AplicacaoNaoInstaladaExcecao"

**Causa**: PayGo Integrado não está instalado no tablet

**Solução**: Instalar o PayGo Integrado (CERT para testes, PROD para produção)

## Erro "QuedaConexaoTerminalExcecao"

**Causa**: Conexão com PPC930 foi perdida durante transação

**Soluções**:
1. Verificar cabo USB
2. Reiniciar PPC930
3. Reinstalar ponto de captura

## Comandos Úteis de Debug

```bash
# Ver todos os logs do app
adb logcat | grep -E "(TopLavanderia|PayGO|RealPayGoManager|MainActivity)"

# Ver logs do PayGo
adb logcat | grep "PayGo"

# Ver dispositivos USB
adb shell lsusb

# Forçar parar o app
adb shell am force-stop com.toplavanderia.app

# Iniciar o app
adb shell am start -n com.toplavanderia.app/app.lovable.toplavanderia.MainActivity

# Ver info do pacote
adb shell dumpsys package com.toplavanderia.app
```
