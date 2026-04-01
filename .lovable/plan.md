

## Plano: Corrigir erros de build e restaurar pré-visualização

### Problema

Dois problemas impedem o build:

1. **Vite não inicia** — `Failed to load native binding` no `@swc/core`. O pacote `@swc/core-linux-x64-gnu` não está no `package.json`, causando falha no ambiente Linux do Lovable.

2. **12 erros TypeScript nas Edge Functions** — Todas as funções usam `error.message` em blocos `catch`, mas o TypeScript (Deno strict) trata `error`/`e` como `unknown`. Precisa de cast para `(error as Error).message` ou `(e as Error).message`.

### Solução

#### 1. Adicionar dependências nativas no `package.json`

Adicionar em `devDependencies`:
- `@swc/core-linux-x64-gnu`: `"1.7.39"`
- `@rollup/rollup-linux-x64-gnu`: `"^4.24.0"`

Isso corrige o erro de binding nativo e restaura a pré-visualização.

#### 2. Corrigir `catch` blocks em 11 Edge Functions

Cada `catch (error)` ou `catch (e)` que acessa `.message` precisa de cast. A função `esp32-health-check` já usa `catch (error: any)`, então não precisa de correção. As 11 restantes:

| Arquivo | Linha | Correção |
|---|---|---|
| `auto-release-machines/index.ts` | 86 | `catch (e)` → `catch (e: any)` |
| `create-user/index.ts` | 165 | `catch (error)` → `catch (error: any)` |
| `esp32-control/index.ts` | 68 | `catch (error)` → `catch (error: any)` |
| `esp32-credit-release/index.ts` | 128 | `catch (error)` → `catch (error: any)` |
| `esp32-load-balancer/index.ts` | 91 | `catch (error)` → `catch (error: any)` |
| `esp32-monitor/index.ts` | 301 | `catch (error)` → `catch (error: any)` |
| `esp32-network-test/index.ts` | 95, 152, 187 | 3 blocos `catch` → `catch (error: any)` |
| `nfse-automation/index.ts` | 157 | `catch (error)` → `catch (error: any)` |
| `totem-settings/index.ts` | 35 | `catch (error)` → `catch (error: any)` |
| `transaction-webhook/index.ts` | TBD | `catch (error)` → `catch (error: any)` |
| `update-machine-status/index.ts` | 100 | `catch (e)` → `catch (e: any)` |

#### 3. Arquivos editados

| Arquivo | Mudança |
|---|---|
| `package.json` | Adicionar 2 dependências nativas em devDependencies |
| 11 arquivos em `supabase/functions/` | Adicionar `: any` nos blocos catch |

### Impacto

- Restaura a pré-visualização do projeto (Vite volta a funcionar)
- Elimina todos os 12 erros de TypeScript no build
- Nenhuma mudança de lógica — apenas tipagem e dependências de runtime

