

## Resposta às suas perguntas

### 1. Posso apenas trocar as credenciais e já funciona?

**Sim, em grande parte.** O sistema já está preparado para o SiTef/TPGWeb. O mapeamento dos campos é:

| Dado recebido | Campo no banco | Valor atual | Novo valor |
|---|---|---|---|
| Ponto de Captura | `tef_terminal_id` | `positivo_l4` | `109728` |
| Endereço servidor | `paygo_host` | `localhost` | `pos-transac-sb.tpgweb.io` |
| Porta | `paygo_port` | `8080` | `31735` |
| CNPJ | `paygo_cnpj_cpf` | `43.652.666/0001-37` | `43652666000137` (sem formatação) |
| Senha Técnica | `paygo_automation_key` | `314159` | `314159` (mantém - não veio nova) |

### 2. Para o PIX funcionar corretamente

O PIX no sandbox funciona assim:
- O sistema já roteia transações PIX pelo PayGO nativo no tablet (Smart POS / PPC930)
- No sandbox, após iniciar uma transação PIX, o **QR Code é gerado automaticamente** e a **aprovação acontece sozinha** após alguns segundos
- **Restrição importante**: o sandbox **só aceita valores inteiros** (ex: R$ 5,00 = ok; R$ 5,50 = negado). Precisamos garantir que os preços das máquinas sejam valores inteiros

### 3. O que será alterado

Atualizar as credenciais SiTef/TPGWeb nas duas lavanderias:

- **TOP LAVANDERIA SINUELO** (`8ace0bcb...`): configurar do zero (está vazia) e habilitar PayGO
- **Lavanderia Principal** (`567a7bb6...`): atualizar credenciais existentes com os novos dados

Campos atualizados em ambas:
- `tef_terminal_id` → `109728`
- `paygo_host` → `pos-transac-sb.tpgweb.io`
- `paygo_port` → `31735`
- `paygo_cnpj_cpf` → `43652666000137`
- `paygo_automation_key` → `314159`
- `paygo_enabled` → `true`

### Observação sobre ambiente

Estas são credenciais de **sandbox (homologação)**. Para produção futura, a TPGWeb enviará novas credenciais com endereço de produção diferente.

