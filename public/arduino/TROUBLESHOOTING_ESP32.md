# 🔧 Troubleshooting ESP32 - Top Lavanderia

## ❌ Problema: ESP32 não aparece online no painel

### 🔍 **Causas mais comuns:**

#### 1. **LAUNDRY_ID ou ESP32_ID errados** (90% dos casos)

**Como verificar:**
```cpp
// No código Arduino, verifique as linhas 28-30:
#define LAUNDRY_ID "8ace0bcb-83a9-4555-a712-63ef5f52e709"  // ⚠️ Deve coincidir com o banco
#define ESP32_ID "lavadora_01"                             // ⚠️ Deve ser único e coincidir com a máquina
```

**Como corrigir:**

1. **Descobrir o LAUNDRY_ID correto:**
   - Acesse: `https://sua-url.lovable.app/admin`
   - Vá em: Configurações → Lavanderia
   - Copie o UUID da lavanderia

2. **Definir ESP32_ID único para cada máquina:**
   ```
   Lavadora 01 → lavadora_01
   Lavadora 02 → lavadora_02
   Secadora 01 → secadora_01
   Secadora 02 → secadora_02
   ```

3. **Cadastrar máquina no banco de dados:**
   - Acesse: Painel Admin → Máquinas → Adicionar Máquina
   - Preencha:
     - Nome: `Lavadora 01`
     - Tipo: `LAVAR`
     - ESP32 ID: `lavadora_01` (mesmo do código Arduino)
     - Pino do Relé: `1`
     - Preço por kg: `18.00`
     - Tempo de ciclo: `35` minutos

---

#### 2. **WiFi não conectado**

**Serial Monitor deve mostrar:**
```
📡 Conectando ao WiFi...
   SSID: SuaRedeWiFi
✅ WiFi conectado!
   IP: 192.168.0.11
   Sinal: -45 dBm (Excelente)
```

**Se mostrar erro:**
```
❌ Falha ao conectar WiFi
```

**Solução:**
- Verifique SSID e senha nas linhas 18-19 do código Arduino
- Certifique-se que o ESP32 está no alcance do roteador
- Use WiFi 2.4GHz (ESP32 não suporta 5GHz)

---

#### 3. **Heartbeat não está sendo enviado**

**Serial Monitor deve mostrar a cada 30 segundos:**
```
📡 Enviando heartbeat...
URL: https://rkdybjzwiwwqqzjfmerm.supabase.co/functions/v1/esp32-monitor?action=heartbeat
Payload: {"esp32_id":"lavadora_01","laundry_id":"8ace0bcb-...","ip_address":"192.168.0.11",...}
✅ Heartbeat enviado - HTTP 200
Resposta: {"success":true,"message":"Heartbeat received","next_interval":30}
```

**Se mostrar HTTP 401:**
```
❌ Erro no heartbeat - HTTP 401
```
**Solução:** Verifique se o `supabaseApiKey` na linha 29 está correto.

**Se mostrar HTTP 500:**
```
❌ Erro no heartbeat - HTTP 500
```
**Solução:** Verifique se o `LAUNDRY_ID` está cadastrado no banco de dados.

**Se não mostrar nada:**
- O loop pode estar travado
- Verifique se há erros de compilação
- Faça upload do código novamente

---

## 📊 **Verificar status no banco de dados**

### SQL para verificar ESP32s cadastrados:
```sql
SELECT 
  esp32_id, 
  is_online, 
  last_heartbeat, 
  ip_address,
  laundry_id,
  NOW() - last_heartbeat as tempo_offline
FROM esp32_status
WHERE laundry_id = '8ace0bcb-83a9-4555-a712-63ef5f52e709'
ORDER BY last_heartbeat DESC;
```

### SQL para verificar máquinas cadastradas:
```sql
SELECT 
  id,
  name,
  type,
  status,
  esp32_id,
  relay_pin,
  laundry_id
FROM machines
WHERE laundry_id = '8ace0bcb-83a9-4555-a712-63ef5f52e709';
```

---

## 🛠️ **Checklist de troubleshooting completo**

- [ ] **1. Código Arduino configurado:**
  - [ ] `LAUNDRY_ID` correto (linha 28)
  - [ ] `ESP32_ID` único (linha 29)
  - [ ] WiFi SSID correto (linha 18)
  - [ ] WiFi PASSWORD correto (linha 19)
  - [ ] `supabaseApiKey` correto (linha 29)

- [ ] **2. Hardware:**
  - [ ] ESP32 ligado e recebendo energia
  - [ ] LED piscando (indica atividade)
  - [ ] WiFi 2.4GHz disponível
  - [ ] Sinal WiFi forte (> -70 dBm)

- [ ] **3. Banco de dados:**
  - [ ] Lavanderia cadastrada com ID correto
  - [ ] Máquina cadastrada com `esp32_id` correto
  - [ ] Tabela `esp32_status` tem permissões corretas (RLS)

- [ ] **4. Logs do Serial Monitor:**
  - [ ] WiFi conectado com sucesso
  - [ ] Heartbeat enviado a cada 30 segundos
  - [ ] HTTP 200 na resposta do heartbeat
  - [ ] IP address visível

- [ ] **5. Painel Admin:**
  - [ ] ESP32 aparece na lista
  - [ ] Status "Online" (verde)
  - [ ] Last heartbeat < 2 minutos

---

## 🚀 **Processo de instalação correto (passo a passo)**

### **Passo 1: Cadastrar Lavanderia (se ainda não existe)**
```sql
INSERT INTO laundries (id, name, cnpj, address, city, state, is_active)
VALUES (
  '8ace0bcb-83a9-4555-a712-63ef5f52e709',
  'Top Lavanderia',
  '43652666000137',
  'Rua Exemplo, 123',
  'São Paulo',
  'SP',
  true
);
```

### **Passo 2: Cadastrar Máquina no banco**
```sql
INSERT INTO machines (
  id,
  laundry_id,
  name,
  type,
  status,
  esp32_id,
  relay_pin,
  price_per_kg,
  cycle_time_minutes,
  capacity_kg
) VALUES (
  gen_random_uuid(),
  '8ace0bcb-83a9-4555-a712-63ef5f52e709',
  'Lavadora 01',
  'LAVAR',
  'available',
  'lavadora_01',  -- ⚠️ Mesmo ID do código Arduino
  1,
  18.00,
  35,
  10
);
```

### **Passo 3: Configurar e fazer upload do código Arduino**
1. Abrir `ESP32_Lavadora_Individual_CORRIGIDO_v2.ino` no Arduino IDE
2. Editar linhas 18-19 (WiFi)
3. Editar linhas 28-30 (IDs)
4. Fazer upload para o ESP32
5. Abrir Serial Monitor (115200 baud)

### **Passo 4: Verificar funcionamento**
1. Serial Monitor deve mostrar heartbeats a cada 30 segundos
2. Painel Admin deve mostrar ESP32 online
3. Máquina deve aparecer como "DISPONÍVEL" (verde)

---

## 📞 **Precisa de ajuda?**

Se após seguir todos os passos o problema persistir, reúna as seguintes informações:

1. **Logs do Serial Monitor** (últimas 50 linhas)
2. **Screenshot do Painel Admin** (aba ESP32 Monitor)
3. **Resultado da query SQL** (esp32_status e machines)
4. **Versão do código** (linha 3 do Arduino)

E consulte a documentação completa em: `docs/DATABASE_STRUCTURE.md`
