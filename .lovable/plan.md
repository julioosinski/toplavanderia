
# Problema: Tablet com APK Desatualizado + Estratégia de Configuração Robusta

## Diagnóstico Real

O código já foi corrigido com a tela de configuração CNPJ (linha 327 do Totem.tsx) e a lógica de modo totem no LaundryContext. Porém o tablet continua mostrando "Lavanderia não configurada" porque está rodando um **APK antigo** — as alterações feitas no código web ainda não foram compiladas e instaladas no tablet.

Adicionalmente, há um risco secundário: mesmo com o APK novo, se o tablet não conseguir conexão imediata com o Supabase ao inicializar, o fluxo pode falhar. Precisamos tornar o sistema mais robusto.

## Solução em Duas Partes

### Parte 1 — Tornar o fluxo do totem mais resiliente (código)

Antes de recompilar o APK, vamos garantir que o código seja à prova de falhas para o ambiente tablet:

**`src/contexts/LaundryContext.tsx`** — Melhorar o tratamento de erro no modo totem:
- Adicionar `try/catch` mais defensivo em `supabase.auth.getUser()` — em redes instáveis, pode lançar erro de rede que hoje não é capturado corretamente
- Se `getUser()` lançar exceção (não apenas retornar erro), o código atual **não entra no bloco do modo totem** e deixa o loading indefinido
- Adicionar timeout de 5 segundos na chamada de autenticação para não bloquear o tablet indefinidamente

**`src/pages/Totem.tsx`** — Adicionar fallback visual adicional:
- Garantir que o campo CNPJ apareça mesmo se `laundryLoading` travar em `true` por mais de 8 segundos (timeout de segurança)

### Parte 2 — Comandos para recompilar e instalar o APK

O usuário precisa rodar estes comandos localmente após as correções:

```text
# 1. Sincronizar código web com Android
npm run build
npx cap sync android

# 2. Compilar APK
cd android
./gradlew assembleRelease

# 3. Instalar no tablet via USB (ADB)
adb install -r app/build/outputs/apk/release/app-release.apk
```

## Alterações Técnicas Detalhadas

### `src/contexts/LaundryContext.tsx`

Problema atual no código:
```text
const { data: { user }, error: authError } = await supabase.auth.getUser();

if (authError || !user) {
  // verifica totem_laundry_id
}
```

Se `supabase.auth.getUser()` **lançar uma exceção** (timeout de rede, DNS failure), o código cai no bloco `catch` externo e define `setError(errorMessage)` — nunca chegando ao modo totem.

Correção:
```text
let user = null;
try {
  const { data, error } = await supabase.auth.getUser();
  if (!error) user = data.user;
} catch (networkError) {
  console.warn('[LaundryContext] Auth check falhou (rede) - modo totem');
}

if (!user) {
  // verifica totem_laundry_id → funciona mesmo sem internet
}
```

Adicionalmente, adicionar `Preferences` do Capacitor como storage alternativo ao `localStorage`, pois em alguns builds Android o WebView pode não persistir o localStorage entre reinicializações. Isso requer usar `@capacitor/preferences` que já está disponível via `@capacitor/core`.

### `src/pages/Totem.tsx`

Adicionar um timeout de segurança: se após 8 segundos `laundryLoading` ainda for `true`, forçar exibição da tela de configuração CNPJ.

```text
const [loadingTimeout, setLoadingTimeout] = useState(false);

useEffect(() => {
  const timer = setTimeout(() => {
    if (laundryLoading) setLoadingTimeout(true);
  }, 8000);
  return () => clearTimeout(timer);
}, [laundryLoading]);

// Na renderização:
if ((!laundryLoading && !currentLaundry) || loadingTimeout) {
  return <tela de configuração CNPJ />
}
```

## Arquivos a Modificar

- `src/contexts/LaundryContext.tsx` — capturar exceções de rede no `getUser()` para não bloquear o modo totem
- `src/pages/Totem.tsx` — adicionar timeout de segurança de 8s para exibir tela de configuração mesmo se loading travar

## Resultado Esperado

Após recompilar e instalar o APK novo:
1. Tablet abre o app
2. `getUser()` falha silenciosamente (sem usuário logado)
3. Verifica `totem_laundry_id` no localStorage — não encontra (primeira vez)
4. Exibe tela de configuração com campo CNPJ
5. Usuário digita `43652666000137`
6. Totem configurado e funcionando

Em aberturas subsequentes:
1. `totem_laundry_id` encontrado no localStorage
2. Lavanderia carregada diretamente
3. Totem abre direto na tela de máquinas
