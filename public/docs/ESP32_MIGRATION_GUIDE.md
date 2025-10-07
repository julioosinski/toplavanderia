# Guia de Migração ESP32 - Atualização de Firmware

## 📋 Visão Geral

Este guia ajuda você a atualizar ESP32s existentes do **formato antigo** de `relay_status` para o **novo formato** que suporta múltiplos relés de forma adequada.

---

## 🔍 Como Identificar Se Preciso Atualizar?

### Formato Antigo (PRECISA ATUALIZAR):
```json
{
  "relay_status": {
    "status": "on"
  }
}
```

### Formato Novo (ATUALIZADO):
```json
{
  "relay_status": {
    "relay_1": "on",
    "relay_2": "off",
    "relay_3": "off"
  }
}
```

### No Painel Admin:
- Acesse **Admin → ESP32 Diagnostics**
- ESP32s desatualizados terão um badge **"Firmware Desatualizado"** em laranja
- O sistema mostrará um aviso recomendando a atualização

---

## ⚠️ Por Que Atualizar?

1. **Suporte Adequado a Múltiplos Relés**: O formato antigo não diferencia entre relay_1, relay_2, etc.
2. **Evita Conflitos**: Com o formato novo, cada máquina tem seu relé específico identificado
3. **Melhor Diagnóstico**: Logs mais claros e troubleshooting mais eficiente
4. **Compatibilidade Futura**: Novas funcionalidades exigirão o formato atualizado

---

## 📦 Passo-a-Passo para Atualizar

### 1️⃣ **Identificar o ESP32 a Atualizar**
- Acesse **Admin → ESP32 Diagnostics**
- Anote o **ESP32_ID** (ex: "main", "Cj01", "Cj02")
- Anote quais **máquinas** estão vinculadas a esse ESP32
- Anote os **relay_pin** de cada máquina

### 2️⃣ **Gerar Novo Código Arduino**
1. Acesse **Configurações → Configurar ESP32**
2. Digite o **ESP32_ID** (o mesmo que está no dispositivo atual)
3. Clique em **"Baixar .ino"**
4. Salve o arquivo (ex: `ESP32_main_v3.ino`)

### 3️⃣ **Fazer Upload no ESP32**

#### Requisitos:
- Arduino IDE instalado
- Bibliotecas necessárias:
  - `WiFi.h`
  - `WebServer.h`
  - `HTTPClient.h`
  - `ArduinoJson.h`

#### Processo:
1. Abra o Arduino IDE
2. Abra o arquivo `.ino` baixado
3. Conecte o ESP32 ao computador via USB
4. Selecione:
   - **Placa**: ESP32 Dev Module
   - **Porta**: A porta COM do seu ESP32
5. Clique em **Upload** (seta para a direita)
6. Aguarde a mensagem **"Upload concluído"**

### 4️⃣ **Verificar Atualização**

#### No Serial Monitor (Arduino IDE):
```
✅ WiFi conectado!
📡 IP: 192.168.0.84
✅ Heartbeat enviado! HTTP 200
```

#### No Painel Admin:
1. Acesse **Admin → ESP32 Diagnostics**
2. Verifique se o badge **"Firmware Desatualizado"** desapareceu
3. Expanda a seção **"Status dos Relés"** e confirme:
```json
{
  "relay_1": "off",
  "relay_2": "off"
}
```

---

## 🛠️ Troubleshooting

### Problema: "Upload failed" no Arduino IDE
**Solução:**
- Pressione e segure o botão **BOOT** no ESP32
- Clique em **Upload** no Arduino IDE
- Solte o botão **BOOT** quando começar o upload

### Problema: ESP32 não aparece online após upload
**Solução:**
1. Abra o **Serial Monitor** (115200 baud)
2. Pressione o botão **RESET** no ESP32
3. Verifique se há erros de conexão WiFi
4. Confirme se o **LAUNDRY_ID** e **ESP32_ID** estão corretos no código

### Problema: Badge "Firmware Desatualizado" ainda aparece
**Solução:**
1. Confirme que o upload foi bem-sucedido
2. Aguarde pelo menos 30 segundos (próximo heartbeat)
3. Recarregue a página do painel admin
4. Verifique os logs do Serial Monitor para confirmar o formato do heartbeat

### Problema: Máquinas não respondem após atualização
**Solução:**
1. Verifique se os **relay_pin** no banco de dados correspondem ao código
2. Confirme que o hardware está conectado corretamente:
   - ESP32 GPIO → Módulo Relé IN
   - Relé COM → Fonte de Alimentação
   - Relé NO/NC → Máquina
3. Teste manualmente via `/start` e `/stop` do ESP32

---

## 📊 Checklist Pós-Atualização

- [ ] ESP32 aparece **"Online"** no painel
- [ ] Badge **"Firmware Desatualizado"** removido
- [ ] `relay_status` mostra formato `{"relay_1": "...", "relay_2": "..."}`
- [ ] Todas as máquinas vinculadas aparecem com status correto
- [ ] Teste de conexão via botão **"Testar Conexão"** funciona
- [ ] Máquinas podem ser iniciadas e paradas normalmente

---

## 🔄 Migração em Lote

Se você tem **múltiplos ESP32s** para atualizar:

1. **Liste todos** os ESP32s na página de diagnóstico
2. **Priorize** ESP32s com conflitos de relay_pin
3. **Atualize um de cada vez** para evitar downtime
4. **Documente** o processo (anotações sobre qual ESP32 foi atualizado quando)
5. **Teste** cada ESP32 antes de passar para o próximo

---

## 📞 Suporte

Se após seguir este guia você ainda tiver problemas:

1. **Capture os logs** do Serial Monitor (Ctrl+A, Ctrl+C)
2. **Tire um screenshot** da página ESP32 Diagnostics
3. **Anote os erros** exatos que aparecem
4. **Entre em contato** com o suporte incluindo:
   - ESP32_ID afetado
   - Versão do firmware anterior
   - Logs completos
   - Screenshots dos erros

---

## ✅ Benefícios da Atualização

- ✨ **Suporte real a múltiplos relés**: Cada máquina tem seu relé claramente identificado
- 🔧 **Melhor diagnóstico**: Logs e status mais claros
- 🚀 **Performance**: Sistema otimizado para lidar com expansões futuras
- 🛡️ **Confiabilidade**: Menos conflitos e erros
- 📈 **Escalabilidade**: Facilita adicionar novas máquinas ao mesmo ESP32

---

**Última atualização:** 2025-10-07  
**Versão do guia:** 1.0  
**Firmware recomendado:** v3.0.0+
