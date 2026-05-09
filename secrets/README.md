# Segredos locais (não versionados)

## Onde colar o token

| | |
|--|--|
| **Pasta (nome correto)** | `secrets/` na **raiz** do projeto (mesmo nível que `package.json`) |
| **Ficheiro (nome correto)** | `cli-access-token` **ou** `supabase-access-token` — **sem** extensão (também: `supabase-access-token.txt`). Use **`cli-access-token`** se existir uma pasta com o nome `supabase-access-token` (bug do Explorador) e não a conseguir apagar. |

Abra `secrets/supabase-access-token`, cole **uma linha** com o token e guarde.

**Não crie uma pasta** chamada `supabase-access-token`. Tem de ser **um ficheiro** com esse nome (no Explorador de ficheiros: “Novo” → “Documento de texto”, renomeie para `supabase-access-token` sem `.txt` — pode precisar ativar “Extensões de nome de ficheiro”). Se já existe uma pasta por engano: feche o Cursor/ficheiros abertos nessa pasta, apague-a e crie o ficheiro como acima. O script `pnpm run supabase:db:push` também tenta ler o token se estiver na primeira pasta dentro do caminho errado.

## Token de acesso Supabase CLI

1. Use o ficheiro **`supabase-access-token`** dentro desta pasta. Também é aceite **`supabase-access-token.txt`**.
2. Cole **uma única linha** com o token (Dashboard Supabase → Account → Access Tokens).

Pode copiar o modelo de `supabase-access-token.example` e renomear para `supabase-access-token`, depois substituir o texto pelo token real.

### Comando único (recomendado)

Com o ficheiro `supabase-access-token` preenchido, na raiz do projeto:

```bash
pnpm run supabase:db:push
```

O script lê automaticamente `secrets/supabase-access-token` ou `SUPABASE_ACCESS_TOKEN` no `.env`.

### PowerShell (sessão atual, manual)

```powershell
$env:SUPABASE_ACCESS_TOKEN = (Get-Content "secrets/supabase-access-token" -Raw).Trim()
pnpm run supabase:db:push
```

### Bash (manual)

```bash
export SUPABASE_ACCESS_TOKEN="$(tr -d '\r\n' < secrets/supabase-access-token)"
pnpm run supabase:db:push
```

**Nunca** faça commit do ficheiro com o token real; este diretório está configurado para ignorar ficheiros que não sejam `.example` ou este README.
