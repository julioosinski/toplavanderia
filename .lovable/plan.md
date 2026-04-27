## O que está acontecendo

A tela branca aparece porque o bundle publicado (`index-DoUiPDmp.js`) foi gerado sem as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. O arquivo `src/integrations/supabase/client.ts` faz `throw` quando elas faltam, derrubando o app inteiro.

No Lovable não existe uma tela onde você cole variáveis de ambiente do frontend — o `.env` é gerado automaticamente pela conexão Supabase. A solução correta é embutir os valores públicos (URL do projeto + **anon key**, que já é pública por design) como **fallback no código**, garantindo que o app nunca quebre por falta de `.env`.

## Mudanças que vou fazer

**1. `src/integrations/supabase/client.ts`** — substituir o `throw` por fallbacks com os valores reais do projeto:

```ts
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://rkdybjzwiwwqqzjfmerm.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZHlianp3aXd3cXF6amZtZXJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMDgxNjcsImV4cCI6MjA2ODg4NDE2N30.CnRP8lrmGmvcbHmWdy72ZWlfZ28cDdNoxdADnyFAOXg";

if (!import.meta.env.VITE_SUPABASE_URL) {
  console.warn("[supabase] VITE_SUPABASE_URL ausente — usando fallback do projeto.");
}
```

Mantenho o resto do arquivo intacto.

**2. Verificar build** rodando `bun run build` para garantir que o bundle compila e o erro some.

**3. Validar preview** — confirmar que a tela branca foi resolvida.

## Depois disso

Para o domínio público (`paglav.com.br` / `toplavanderia.lovable.app`) refletir a correção, você precisa **clicar em Publish → Update** no canto superior direito. No celular: `...` no canto inferior direito → Publish.

## Segurança

- A **anon key** é pública por design (já é exposta a qualquer visitante do site). Pode ficar no código sem risco.
- Toda a proteção real continua via RLS no Supabase, que já está configurado.
- A `service_role_key` **não** é tocada — ela continua só nas Edge Functions.

## Fora de escopo

- Não vou corrigir os erros de TypeScript pendentes (ESP32Configuration, PinpadInfo, etc.) nesta passagem.
- Não vou alterar `.gitignore` nem mexer em outras integrações.

Aprove para eu aplicar.