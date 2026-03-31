

## Plano: Otimizar carregamento das paginas

### Diagnostico

Os logs mostram que `initializeLaundryContext` executa **2-3 vezes** a cada carregamento (INITIAL_SESSION + SIGNED_IN + useEffect). Alem disso:

1. **LaundryContext bloqueia todas as paginas** — inclusive a Home publica, que nao precisa de auth/laundry
2. **Sem lazy loading** — todos os 12+ modulos admin sao importados eagerly no bundle principal
3. **Timeouts longos para usuarios nao-autenticados** — `getUser()` com 5s timeout + `getItemWithTimeout` com 8s = ate 13s bloqueando na Home
4. **Inicializacao duplicada** — `onAuthStateChange` dispara `INITIAL_SESSION` e `SIGNED_IN` quase simultaneamente, rodando toda a logica duas vezes

### Solucao

**1. Lazy loading das rotas admin** (`src/App.tsx`)
- Trocar imports estaticos dos modulos admin por `React.lazy()` com `Suspense`
- Manter Home, Auth, Totem como imports diretos (sao rotas de entrada)
- Isso reduz o bundle inicial drasticamente

**2. Evitar inicializacao duplicada** (`src/contexts/LaundryContext.tsx`)
- Adicionar uma ref `initializingRef` para evitar execucoes concorrentes
- Se ja esta inicializando, ignorar chamadas subsequentes
- No `onAuthStateChange`, so re-inicializar em `SIGNED_IN` (ignorar `INITIAL_SESSION` pois o useEffect ja cobre)

**3. Reduzir timeouts para paginas publicas** (`src/contexts/LaundryContext.tsx`)
- Reduzir timeout do `getUser()` de 5s para 3s
- Reduzir timeout do `getItemWithTimeout` de 8s para 3s (no browser web, localStorage e sincrono e responde instantaneamente)
- Para usuario nao-autenticado em pagina web, o fluxo completo passara de ~13s para ~3s no pior caso

**4. Skeleton/loading rapido** (`src/layouts/AdminLayout.tsx`)
- Garantir que o Suspense fallback mostra um spinner leve enquanto os chunks admin carregam

### Arquivos editados

| Arquivo | Mudanca |
|---|---|
| `src/App.tsx` | Lazy imports para todas as paginas admin + Suspense wrapper |
| `src/contexts/LaundryContext.tsx` | Ref anti-duplicacao + reduzir timeouts + ignorar INITIAL_SESSION quando SIGNED_IN ja tratou |

### Impacto esperado

- Bundle inicial ~60-70% menor (modulos admin carregam sob demanda)
- Home e Auth renderizam instantaneamente sem esperar LaundryContext resolver
- Eliminacao de chamadas duplicadas ao Supabase a cada navegacao

