# Padronizar gerenciador de pacotes (pnpm)

## Diagnóstico

O repositório tem **três lockfiles** convivendo, o que causa builds diferentes entre ambientes:

| Lockfile | Última atualização | Quem usa |
|---|---|---|
| `bun.lock` | 27/04 17:21 | Sandbox Lovable (bun) |
| `pnpm-lock.yaml` | 27/04 17:19 | **Netlify** (`netlify.toml` → `pnpm build`) |
| `package-lock.json` | 27/04 16:56 | Ninguém — resíduo |

Problemas:
- `package.json` não declara `packageManager`, então cada ambiente escolhe o seu.
- Toda vez que o sandbox roda `bun add/remove`, só o `bun.lock` é regravado — `pnpm-lock.yaml` fica defasado e o Netlify pode resolver versões diferentes (ou falhar com `ERR_PNPM_OUTDATED_LOCKFILE`).
- Versões hoje batem para `@tanstack/react-query` 5.56.2, mas isso é coincidência; sem unificação, voltará a divergir.

## Decisão

Padronizar em **pnpm** (que já é o que o Netlify e os scripts `supabase:*` usam) e eliminar os outros dois lockfiles.

## Mudanças

1. **`package.json`**
   - Adicionar `"packageManager": "pnpm@9.x"` para que Lovable, Netlify e dev local usem a mesma ferramenta automaticamente.
   - Adicionar `"engines": { "node": ">=20" }`.

2. **Criar `.npmrc`** com:
   ```
   engine-strict=true
   auto-install-peers=true
   ```

3. **Remover lockfiles redundantes**
   - Apagar `bun.lock`
   - Apagar `package-lock.json`
   - Manter apenas `pnpm-lock.yaml`

4. **Regenerar `pnpm-lock.yaml`** rodando `pnpm install` para garantir consistência total com o `package.json` atual.

5. **`netlify.toml`** — sem mudança (já está correto: `pnpm build`).

## Validação

- Rodar `pnpm install` → deve completar sem warnings de lockfile desatualizado.
- Rodar `pnpm build` localmente no sandbox → deve gerar `dist/` igual ao que o Netlify produzirá.
- Após o merge, o próximo deploy do Netlify deve usar exatamente o mesmo `pnpm-lock.yaml`.

## O que NÃO muda

- Versões de dependências em `package.json` permanecem idênticas.
- Código da aplicação, configs do Vite, Capacitor, Supabase — intactos.
- Os erros de TypeScript pré-existentes (ESP32Configuration, PaymentPayload) não são tratados aqui — são tarefa separada.

## Detalhes técnicos

- `packageManager` no `package.json` é respeitado pelo Corepack, Netlify e Lovable, eliminando ambiguidade.
- `@rollup/rollup-linux-x64-gnu` e `@swc/core-linux-x64-gnu` continuam declarados como deps explícitas (necessárias para o ambiente Linux do Lovable/Netlify, conforme memória `build/native-binding-resolution`).
- Após aprovar, será necessário clicar em **Publish → Update** para refletir no domínio `paglav.com.br`.
