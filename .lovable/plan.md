

# Corrigir Configuração de Pagamento: TPGWeb/SiTef (não PayGO Desktop)

## Entendimento

Os dados que você recebeu **não são do PayGO Desktop** — são credenciais do **SiTef/TPGWeb** (gateway de pagamento). Os campos mapeiam assim:

| Dado Recebido | Campo no Sistema |
|---|---|
| Ponto de captura: `102251` | `tef_terminal_id` |
| Endereço: `pos-transac-sb.tpgweb.io:31735` | `paygo_host` + `paygo_port` |
| CNPJ: `43652666000137` | `paygo_cnpj_cpf` |
| Senha técnica: `314159` | `paygo_automation_key` |

O sufixo `-sb` no endereço indica **sandbox** (ambiente de homologação/testes).

## Mudanças Necessárias

### 1. Atualizar a seção PayGO no SettingsForm para refletir campos SiTef/TPGWeb

Renomear labels e placeholders na seção "Configurações PayGO (Maquininha)" em `src/components/admin/settings/SettingsForm.tsx`:

- **"Chave de Automação"** → **"Senha Técnica"** (placeholder: `314159`)
- **"Host do PayGO"** → **"Endereço do Servidor"** (placeholder: `pos-transac-sb.tpgweb.io`)
- Adicionar campo **"Ponto de Captura"** usando a coluna `tef_terminal_id`
- Atualizar descrições para mencionar SiTef/TPGWeb

### 2. Atualizar a seção TEF existente

A seção TEF atual (linhas 233-266) tem campos genéricos. Vamos integrá-la com a seção PayGO numa única seção coerente chamada **"Integração de Pagamentos (SiTef/TPGWeb)"** que contenha todos os campos necessários.

### 3. Preencher valores padrão com os dados fornecidos

Os campos terão os seguintes valores pré-preenchidos como placeholder/exemplo:
- Host: `pos-transac-sb.tpgweb.io`
- Porta: `31735`
- Ponto de Captura: `102251`
- Senha Técnica: (campo senha)
- CNPJ: `43652666000137`

### 4. Atualizar Totem.tsx para usar tef_terminal_id como ponto de captura

No `useEffect` que sincroniza `systemSettings` (linhas 94-109), mapear:
- `tef_terminal_id` → ponto de captura no config do TEF
- `paygo_host` → host do servidor SiTef
- `paygo_port` → porta do servidor
- `paygo_automation_key` → senha técnica

## Arquivos a Modificar

- `src/components/admin/settings/SettingsForm.tsx` — Unificar seções TEF + PayGO numa única seção "Integração de Pagamentos" com labels corretos
- `src/pages/Totem.tsx` — Ajustar mapeamento de `systemSettings` para refletir campos SiTef

## Nota sobre Ambiente

O endereço `pos-transac-sb.tpgweb.io` é o ambiente **sandbox** (testes). Quando for para produção, a credenciadora fornecerá o endereço de produção (provavelmente `pos-transac.tpgweb.io` sem o `-sb`).

