
# Corrigir "Lavanderia não configurada" no Totem

## Diagnóstico

O problema é arquitetural: o `LaundryContext` foi projetado para o painel administrativo e exige autenticação no Supabase. No tablet, o app abre sem sessão de login, então `currentLaundry` fica `null` e o totem exibe a mensagem de erro.

O fluxo atual:
```text
App abre no tablet
  → LaundryContext verifica auth.getUser()
  → Sem usuário logado → retorna sem carregar lavanderia
  → Totem.tsx: if (!currentLaundry) → "Lavanderia não configurada"
```

A tabela `laundries` já tem a política `Allow public read access = true`, então é possível buscar os dados da lavanderia **sem autenticação**. O totem só precisa saber qual `laundry_id` usar.

## Solução: Configuração do Totem por CNPJ (sem login)

Adicionar ao `LaundryContext` um fluxo alternativo especificamente para o totem:

1. Se não houver usuário autenticado, verificar se há um `totem_laundry_id` salvo no `localStorage`
2. Se houver, carregar a lavanderia diretamente do Supabase (acesso público)
3. Se não houver, exibir uma tela de configuração inicial pedindo o CNPJ da lavanderia
4. Ao digitar o CNPJ, buscar a lavanderia publicamente, salvar o ID no `localStorage` e carregar normalmente

## Alterações Técnicas

### 1. `src/contexts/LaundryContext.tsx`

No método `initializeLaundryContext`, após verificar que não há usuário autenticado:

```text
if (authError || !user) {
  // NOVO: verificar se é modo totem (localStorage)
  const totemLaundryId = localStorage.getItem('totem_laundry_id');
  if (totemLaundryId) {
    → buscar lavanderia publicamente por ID
    → setar currentLaundry
    → setar loading = false
    → retornar
  }
  // sem configuração → loading = false, currentLaundry = null
}
```

Adicionar função `configureTotemByCNPJ(cnpj: string)` no contexto:
- Busca a lavanderia por CNPJ na tabela `laundries` (acesso público)
- Salva o `id` no `localStorage` como `totem_laundry_id`
- Recarrega o contexto

Adicionar `configureTotemByCNPJ` ao tipo `LaundryContextType` e ao valor do provider.

### 2. `src/pages/Totem.tsx`

Substituir a tela de erro atual ("Lavanderia não configurada") por uma **tela de configuração inicial**:

- Campo para digitar o CNPJ da lavanderia (14 dígitos)
- Botão "Configurar Totem"
- Validação: exatamente 14 dígitos numéricos
- Loading enquanto busca no Supabase
- Feedback de erro se CNPJ não encontrado
- Ao encontrar: salva e recarrega automaticamente

Isso substitui a mensagem de erro estática por um fluxo funcional idêntico ao descrito no `CHANGELOG_v2.1.md` do DEPLOYMENT_TOTEM.

## Dados disponíveis no Supabase

| CNPJ | Lavanderia |
|------|------------|
| 43652666000137 | TOP LAVANDERIA SINUELO |
| 43652666000138 | Lavanderia Principal |

O CNPJ correto para configurar o tablet é **43652666000137** (TOP LAVANDERIA SINUELO).

## Fluxo após a correção

```text
Primeira abertura:
  → Não há usuário logado
  → Não há totem_laundry_id no localStorage
  → Exibe tela de configuração com campo CNPJ
  → Usuário digita: 43652666000137
  → Busca pública no Supabase → encontra TOP LAVANDERIA SINUELO
  → Salva ID no localStorage
  → Recarrega → totem funcional

Aberturas seguintes:
  → Não há usuário logado
  → Encontra totem_laundry_id no localStorage
  → Carrega lavanderia publicamente
  → Totem funcional sem precisar digitar CNPJ novamente
```

## Arquivos a modificar

- `src/contexts/LaundryContext.tsx` — adicionar lógica de modo totem sem autenticação
- `src/pages/Totem.tsx` — substituir tela de erro por tela de configuração por CNPJ

## Notas de Segurança

- O acesso público à tabela `laundries` já está habilitado via RLS (`Allow public read access`)
- Não há exposição de dados sensíveis: apenas `id`, `name`, `cnpj`, `city`, `state`
- O `totem_laundry_id` no `localStorage` é lido apenas quando não há usuário autenticado, sem conflito com o painel admin
